import { PDFDocument } from "pdf-lib";
import {
  createCipheriv,
  createDecipheriv,
  randomBytes,
  createHash,
} from "node:crypto";
import { connect } from "node:net";
import { StorageClient } from "@supabase/storage-js";
import { fileTypeFromBuffer } from "file-type";
import { fileMime, MAX_FILE_BYTES } from "@lims/core";
import { DomainError } from "../domain.js";
export interface StoredObject {
  id: string;
  path: string;
}
export interface FileStorage {
  ready(): boolean;
  scan(data: Buffer): Promise<void>;
  put(id: string, data: Buffer): Promise<StoredObject>;
  get(object: StoredObject): Promise<Buffer>;
  remove(id: string, object?: StoredObject): Promise<void>;
}
export const hashFile = (data: Buffer) =>
  createHash("sha256").update(data).digest("hex");
export async function validateFile(data: Buffer, name: string) {
  const expected = fileMime(name);
  const detected = await fileTypeFromBuffer(data);
  if (!expected || !detected || detected.mime !== expected)
    throw new DomainError(
      422,
      "File contents do not match the supported filename type",
    );
  if (!data.length || data.length > MAX_FILE_BYTES)
    throw new DomainError(413, "File must be between 1 byte and 24 MB");
  return expected;
}
export function encryptFile(data: Buffer, key: Buffer) {
  const iv = randomBytes(12);
  const c = createCipheriv("aes-256-gcm", key, iv);
  const encrypted = Buffer.concat([c.update(data), c.final()]);
  return Buffer.concat([iv, c.getAuthTag(), encrypted]);
}
export function decryptFile(data: Buffer, key: Buffer) {
  if (data.length < 28) throw new Error("Invalid stored file");
  const d = createDecipheriv("aes-256-gcm", key, data.subarray(0, 12));
  d.setAuthTag(data.subarray(12, 28));
  return Buffer.concat([d.update(data.subarray(28)), d.final()]);
}
export function clamScan(data: Buffer, host: string, port: number) {
  return new Promise<void>((resolve, reject) => {
    const socket = connect({ host, port });
    let response = "";
    let done = false;
    const finish = (error?: Error) => {
      if (done) return;
      done = true;
      socket.destroy();
      error ? reject(error) : resolve();
    };
    socket.setTimeout(60_000, () =>
      finish(new DomainError(503, "File scanner timed out; retry later")),
    );
    socket.on("error", () =>
      finish(new DomainError(503, "File scanner unavailable")),
    );
    socket.on("data", (chunk) => {
      response += chunk.toString();
      if (response.length > 8192)
        return finish(new DomainError(503, "Invalid scanner response"));
      if (response.includes("\0")) {
        if (/^stream: OK\0/.test(response)) finish();
        else finish(new DomainError(422, "File did not pass the malware scan"));
      }
    });
    socket.on("close", () => {
      if (!done) finish(new DomainError(503, "Incomplete scanner response"));
    });
    socket.on("connect", async () => {
      try {
        socket.write("zINSTREAM\0");
        for (let i = 0; i < data.length; i += 65536) {
          const chunk = data.subarray(i, i + 65536);
          const length = Buffer.alloc(4);
          length.writeUInt32BE(chunk.length);
          socket.write(length);
          if (!socket.write(chunk))
            await new Promise<void>((r, j) => {
              socket.once("drain", r);
              socket.once("close", () => j(new Error("Scanner closed")));
            });
        }
        socket.write(Buffer.alloc(4));
      } catch {
        finish(new DomainError(503, "Scanner connection interrupted"));
      }
    });
  });
}
export class SupabaseStorage implements FileStorage {
  private client() {
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY!;
    return new StorageClient(
      process.env.SUPABASE_URL! + "/storage/v1",
      {
        apikey: key,
        Authorization: "Bearer " + key,
      },
      (input, init) =>
        fetch(input, {
          ...init,
          redirect: "error",
          signal: AbortSignal.timeout(90_000),
        }),
    );
  }
  private bucket() {
    return process.env.SUPABASE_STORAGE_BUCKET || "lims-private";
  }
  private key() {
    const key = Buffer.from(process.env.FILE_ENCRYPTION_KEY ?? "", "base64");
    if (key.length !== 32)
      throw new DomainError(503, "File encryption key is not configured");
    return key;
  }
  ready() {
    return Boolean(
      process.env.SUPABASE_SERVICE_ROLE_KEY &&
      /^https:\/\/[a-z0-9-]+\.supabase\.co$/.test(
        process.env.SUPABASE_URL ?? "",
      ) &&
      /^[a-z0-9-]+$/.test(this.bucket()) &&
      Buffer.from(process.env.FILE_ENCRYPTION_KEY ?? "", "base64").length ===
        32 &&
      process.env.CLAMAV_HOST,
    );
  }
  async scan(data: Buffer) {
    if (!this.ready())
      throw new DomainError(
        503,
        "Configure Supabase, encryption and malware scanning before uploading",
      );
    const { data: bucket, error } = await this.client().getBucket(
      this.bucket(),
    );
    if (error || !bucket || bucket.public !== false)
      throw new DomainError(503, "Storage bucket must exist and be private");
    await clamScan(
      data,
      process.env.CLAMAV_HOST!,
      Number(process.env.CLAMAV_PORT ?? 3310),
    );
  }
  private path(id: string) {
    if (!/^[a-f0-9]{24}$/.test(id)) throw new Error("Invalid upload ID");
    return "versions/" + id + ".bin";
  }
  async put(id: string, data: Buffer) {
    const path = this.path(id);
    const result = await this.client()
      .from(this.bucket())
      .upload(path, encryptFile(data, this.key()), {
        contentType: "application/octet-stream",
        upsert: false,
      });
    if (result.error || !result.data)
      throw new DomainError(502, "Storage could not confirm the upload");
    return { id: path, path };
  }
  async get(object: StoredObject) {
    if (!/^versions\/[a-f0-9]{24}\.bin$/.test(object.path))
      throw new DomainError(500, "Invalid storage path");
    const { data, error } = await this.client()
      .from(this.bucket())
      .download(object.path);
    if (error || !data)
      throw new DomainError(502, "Stored file is temporarily unavailable");
    if (data.size > MAX_FILE_BYTES + 28)
      throw new DomainError(502, "Unexpected stored file size");
    try {
      return decryptFile(Buffer.from(await data.arrayBuffer()), this.key());
    } catch {
      throw new DomainError(502, "Stored file integrity check failed");
    }
  }
  async remove(id: string, object?: StoredObject) {
    const path = this.path(id);
    if (object && object.path !== path)
      throw new Error("Mismatched storage path");
    const { error } = await this.client().from(this.bucket()).remove([path]);
    if (error) throw new DomainError(502, "Storage cleanup unavailable");
  }
}

export async function filePages(data: Buffer, mime: string) {
  if (mime !== "application/pdf") return 1;
  try {
    const pdf = await PDFDocument.load(data);
    if (pdf.getPageCount() > 1000) throw new Error("Too many pages");
    return pdf.getPageCount();
  } catch {
    throw new DomainError(
      422,
      "PDF must be readable, unencrypted and no more than 1,000 pages",
    );
  }
}
