import { beforeEach, it, expect } from "vitest";
import {
  resetDemo,
  demoRequest as request,
  demoFileDownload,
  demoFileUpload,
  demoConsolidatedPdf,
} from "./adapter";
import { PDFDocument } from "pdf-lib";
import { digestFile } from "../features/files/api";
beforeEach(resetDemo);
it("organizes folders, bulk files, versions, archive/restore and selected report appendices", async () => {
  const clients: any = await request("/files/clients", "GET"),
    clientId = clients[0]._id;
  let list: any = await request("/files/list?clientId=" + clientId, "GET");
  const initial = list.items.find(
    (r: any) => r.visibility === "report_eligible",
  );
  const folder: any = await request("/files/folders", "POST", {
    clientId,
    parentId: null,
    name: "Project A",
  });
  const child: any = await request("/files/folders", "POST", {
    clientId,
    parentId: folder._id,
    name: "Evidence",
  });
  await expect(
    request("/files/folders/" + folder._id, "PATCH", {
      version: 0,
      name: "Project A",
      parentId: child._id,
      reason: "Cycle test",
    }),
  ).rejects.toThrow(/descendants/);
  const file = await demoFileDownload(initial.currentId);
  const hash = await digestFile(file);
  const meta = {
    clientId,
    folderId: child._id,
    name: "evidence.pdf",
    category: "technical",
    source: "client",
    visibility: "report_eligible",
    trfId: initial.trfId,
    sampleId: null,
    size: file.size,
    sha256: hash,
    reason: "Received evidence",
  };
  const queued: any = await request("/files/uploads", "POST", {
    ...meta,
    requestKey: crypto.randomUUID(),
  });
  await demoFileUpload(queued.upload._id, file);
  const dup: any = await request("/files/uploads", "POST", {
    ...meta,
    requestKey: crypto.randomUUID(),
  });
  expect(dup.skipped).toBe(true);
  const a: any = await request("/files/assets/" + queued.upload.assetId, "GET");
  await request("/files/bulk", "POST", {
    clientId,
    items: [{ id: a._id, version: a.version }],
    action: "archive",
    reason: "Archive test",
  });
  await expect(
    request("/files/bulk", "POST", {
      clientId,
      items: [{ id: a._id, version: a.version }],
      action: "restore",
      reason: "Stale restore",
    }),
  ).rejects.toThrow(/changed/);
  await request("/files/bulk", "POST", {
    clientId,
    items: [{ id: a._id, version: a.version + 1 }],
    action: "restore",
    reason: "Restore test",
  });
  const context: any = await request(
    "/consolidated/options/" + initial.trfId,
    "GET",
  );
  const report: any = await request("/consolidated", "POST", {
    trfId: initial.trfId,
    title: "Draft with appendix",
    reason: "Review evidence",
    selections: context.tests
      .slice(0, 1)
      .map((t: any) => ({ id: t.id, version: t.version })),
    appendixIds: [queued.upload._id],
  });
  expect(report.snapshot.appendices[0].sha256).toBe(hash);
  const pdf = await PDFDocument.load(await demoConsolidatedPdf(report._id));
  expect(pdf.getPageCount()).toBe(6);
  await request("/auth/persona", "POST", { id: "000000000000000000000003" });
  await expect(
    request("/files/folders", "POST", { clientId, name: "Denied" }),
  ).rejects.toThrow(/permission/);
});
it("handles a batch of 100 independent files without overwriting same-name files", async () => {
  const clients: any = await request("/files/clients", "GET"),
    clientId = clients[0]._id;
  const list: any = await request("/files/list?clientId=" + clientId, "GET");
  const blob = await demoFileDownload(list.items[0].currentId),
    hash = await digestFile(blob);
  for (let i = 0; i < 100; i++) {
    const r: any = await request("/files/uploads", "POST", {
      clientId,
      name: "same-name.pdf",
      size: blob.size,
      sha256: hash,
      requestKey: crypto.randomUUID(),
      reason: "Bulk acceptance",
      duplicate: "keep",
    });
    await demoFileUpload(r.upload._id, blob);
  }
  const first: any = await request(
      "/files/list?clientId=" + clientId + "&page=1",
      "GET",
    ),
    second: any = await request(
      "/files/list?clientId=" + clientId + "&page=2",
      "GET",
    );
  expect(first.total).toBe(102);
  expect(first.items).toHaveLength(50);
  expect(second.items).toHaveLength(50);
  expect(
    new Set([...first.items, ...second.items].map((r: any) => r._id)).size,
  ).toBe(100);
});
