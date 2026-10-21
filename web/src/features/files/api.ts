import { isDemo, request } from "../../lib/client";
import type { ClientFile } from "@lims/core";
export async function digestFile(file: Blob) {
  return Array.from(
    new Uint8Array(
      await crypto.subtle.digest("SHA-256", await file.arrayBuffer()),
    ),
  )
    .map((n) => n.toString(16).padStart(2, "0"))
    .join("");
}
export async function uploadFile(
  file: File,
  meta: Record<string, unknown>,
  progress: (n: number) => void,
  key: string,
) {
  const sha256 = await digestFile(file);
  let result: any = await request("/files/uploads", "POST", {
    ...meta,
    name: file.name,
    size: file.size,
    sha256,
    requestKey: key,
  });
  if (result.skipped) return "skipped";
  if (result.upload.status === "ready") return "complete";
  if (["failed", "cleanup"].includes(result.upload.status)) {
    if (result.upload.status === "cleanup")
      throw new Error("Storage cleanup is required; ask an administrator");
    result = await request("/files/uploads", "POST", {
      ...meta,
      name: file.name,
      size: file.size,
      sha256,
      requestKey: crypto.randomUUID(),
    });
  }
  if (result.skipped) return "skipped";
  if (result.upload.status === "ready") return "complete";
  if (isDemo) {
    const { demoFileUpload } = await import("../../demo/adapter");
    await demoFileUpload(result.upload._id, file);
    progress(100);
    return "complete";
  }
  await new Promise<void>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("PUT", "/api/files/uploads/" + result.upload._id);
    xhr.setRequestHeader("Content-Type", "application/octet-stream");
    xhr.timeout = 180000;
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable) progress(Math.round((e.loaded / e.total) * 100));
    };
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) resolve();
      else {
        let message = "Upload failed; retry this file";
        try {
          message = JSON.parse(xhr.responseText).error ?? message;
        } catch {}
        reject(new Error(message));
      }
    };
    xhr.onerror = () =>
      reject(new Error("Connection interrupted; retry this file"));
    xhr.ontimeout = () =>
      reject(new Error("Upload timed out; retry to check its saved status"));
    xhr.send(file);
  });
  return "complete";
}
export async function getFileBlob(versionId: string) {
  if (isDemo) {
    const { demoFileDownload } = await import("../../demo/adapter");
    return demoFileDownload(versionId);
  }
  const r = await fetch("/api/files/versions/" + versionId + "/download", {
    credentials: "same-origin",
  });
  if (!r.ok) {
    const error = await r.json().catch(() => ({}));
    throw new Error(error.error ?? "Download failed");
  }
  return r.blob();
}
export function saveBlob(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob),
    a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
export async function downloadFiles(rows: ClientFile[]) {
  const available = rows.filter((r) => r.current?.status === "ready");
  if (!available.length) throw new Error("Select files with completed uploads");
  if (available.reduce((n, r) => n + r.current!.size, 0) > 100_000_000)
    throw new Error("Download at most 100 MB per ZIP");
  const { zipSync, strToU8 } = await import("fflate");
  const entries: Record<string, Uint8Array> = {};
  for (const r of available)
    entries[r._id + "/" + r.name] = new Uint8Array(
      await (await getFileBlob(r.currentId!)).arrayBuffer(),
    );
  entries["manifest.json"] = strToU8(JSON.stringify(available, null, 2));
  saveBlob(
    new Blob([new Uint8Array(zipSync(entries, { level: 0 }))], {
      type: "application/zip",
    }),
    "client-files.zip",
  );
}
export const formatBytes = (n: number) =>
  n >= 1_000_000
    ? (n / 1_000_000).toFixed(1) + " MB"
    : Math.max(1, Math.round(n / 1000)) + " KB";
