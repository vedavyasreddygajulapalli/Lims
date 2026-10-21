import { test } from "node:test";
import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import {
  encryptFile,
  decryptFile,
  validateFile,
  SupabaseStorage,
} from "../src/files/storage.js";
import {
  fileUploadInput,
  fileAccess,
  folderPath,
  appendReportFiles,
} from "@lims/core";
import { PDFDocument } from "pdf-lib";
test("file encryption preserves bytes and rejects tampering or a wrong key", () => {
  const key = randomBytes(32),
    data = Buffer.from("exact private data 0001.2300");
  const encrypted = encryptFile(data, key);
  assert.equal(encrypted.length, data.length + 28);
  assert.deepEqual(decryptFile(encrypted, key), data);
  assert.throws(() => decryptFile(encrypted, randomBytes(32)));
  encrypted[30] ^= 1;
  assert.throws(() => decryptFile(encrypted, key));
});
test("file schemas and signatures reject executable, path and oversized uploads", async () => {
  const p = await PDFDocument.create();
  p.addPage();
  const data = Buffer.from(await p.save());
  assert.equal(await validateFile(data, "document.pdf"), "application/pdf");
  await assert.rejects(validateFile(data, "photo.png"));
  await assert.rejects(validateFile(Buffer.from("MZ fake"), "fake.pdf"));
  const base = {
    clientId: "0".repeat(24),
    name: "test.pdf",
    size: 1,
    sha256: "a".repeat(64),
    requestKey: "11111111-1111-4111-8111-111111111111",
    reason: "Test upload",
  };
  assert.ok(fileUploadInput.safeParse(base).success);
  for (const patch of [
    { name: "../test.pdf" },
    { size: 25_000_000 },
    { name: "test.exe" },
    { assetId: "1".repeat(24) },
    { sampleId: "2".repeat(24) },
  ])
    assert.equal(
      fileUploadInput.safeParse({ ...base, ...patch }).success,
      false,
    );
});
test("file roles separate commercial and technical records, and cycles are rejected", () => {
  assert.equal(fileAccess(["accounts"], "technical"), false);
  assert.equal(fileAccess(["accounts"], "commercial", true), true);
  assert.equal(fileAccess(["reviewer"], "technical", true), false);
  assert.equal(fileAccess(["reviewer"], "commercial"), false);
  assert.equal(fileAccess(["technician"], "general"), false);
  assert.throws(() =>
    folderPath(
      [
        { _id: "1", parentId: "2", name: "A" },
        { _id: "2", parentId: "1", name: "B" },
      ],
      "1",
    ),
  );
});
test("PDF appendices add the selected pages without changing base report pages", async () => {
  const base = await PDFDocument.create();
  base.addPage();
  const attachment = await PDFDocument.create();
  attachment.addPage();
  attachment.addPage();
  const out = await appendReportFiles(await base.save(), "CTR-1", 0, [
    {
      meta: {
        versionId: "x",
        assetId: "y",
        name: "evidence.pdf",
        mime: "application/pdf",
        size: 100,
        sha256: "a",
        revision: 1,
      },
      bytes: await attachment.save(),
    },
  ]);
  assert.equal((await PDFDocument.load(out)).getPageCount(), 3);
});

test("Supabase adapter checks private buckets and stores only encrypted opaque objects", async () => {
  const originalFetch = globalThis.fetch;
  const saved = { ...process.env };
  const id = "a".repeat(24);
  const data = Buffer.from("private original bytes");
  let stored: Buffer | undefined;
  let publicBucket = false;
  Object.assign(process.env, {
    SUPABASE_URL: "https://test-project.supabase.co",
    SUPABASE_SERVICE_ROLE_KEY: "test-server-only-key",
    FILE_ENCRYPTION_KEY: randomBytes(32).toString("base64"),
    CLAMAV_HOST: "127.0.0.1",
  });
  globalThis.fetch = async (input, init) => {
    const url = String(input);
    assert.equal(
      new Headers(init?.headers).get("Authorization"),
      "Bearer test-server-only-key",
    );
    if (url.endsWith("/bucket/lims-private"))
      return Response.json({
        id: "lims-private",
        name: "lims-private",
        public: publicBucket,
      });
    if (init?.method === "POST") {
      stored = Buffer.from(init.body as any);
      return Response.json({
        Key: "lims-private/versions/" + id + ".bin",
        Id: id,
      });
    }
    if (init?.method === "DELETE") {
      stored = undefined;
      return Response.json([]);
    }
    return new Response(new Uint8Array(stored!));
  };
  try {
    const adapter = new SupabaseStorage();
    assert.ok(adapter.ready());
    const object = await adapter.put(id, data);
    assert.equal(object.path, "versions/" + id + ".bin");
    assert.notDeepEqual(stored, data);
    assert.deepEqual(await adapter.get(object), data);
    await adapter.remove(id, object);
    assert.equal(stored, undefined);
    publicBucket = true;
    await assert.rejects(adapter.scan(data), /must exist and be private/);
  } finally {
    globalThis.fetch = originalFetch;
    for (const k of Object.keys(process.env))
      if (!(k in saved)) delete process.env[k];
    Object.assign(process.env, saved);
  }
});
