import {
  fileMetadata,
  fileUploadInput,
  folderInput,
  fileName,
  fileAccess,
  canManageFiles,
  fileMime,
  MAX_FILE_BYTES,
  FILE_BUDGET_BYTES,
  type ClientFile,
  type ClientFolder,
  type FileRevision,
} from "@lims/core";
import { PDFDocument, StandardFonts } from "pdf-lib";
export function createDemoFiles(
  getRecords: () => any,
  getActor: () => any,
  onAudit: (id: string, action: string, detail: any) => void,
) {
  let folders: ClientFolder[] = [],
    assets: ClientFile[] = [],
    versions: FileRevision[] = [],
    blobs = new Map<string, Blob>(),
    jobs = new Map<string, string>();
  let counter = 50000,
    initialized: Promise<void> | null = null;
  const id = () => (++counter).toString(16).padStart(24, "0");
  const now = () => new Date().toISOString();
  const permission = (category: string, write = false) => {
    if (!fileAccess(getActor().roles, category, write))
      throw new Error("Your role does not have permission for this file");
  };
  const scope = () => {
    if (
      !getActor().roles.some((r: string) =>
        [
          "admin",
          "manager",
          "reception",
          "reviewer",
          "signatory",
          "accounts",
        ].includes(r),
      )
    )
      throw new Error("No file workspace permission");
  };
  const sha = async (blob: Blob) =>
    Array.from(
      new Uint8Array(
        await crypto.subtle.digest("SHA-256", await blob.arrayBuffer()),
      ),
    )
      .map((n) => n.toString(16).padStart(2, "0"))
      .join("");
  const init = () =>
    (initialized ??= (async () => {
      const r = getRecords(),
        client = r.clients[0],
        trf = r.trfs.find((t: any) => t.clientId === client._id);
      for (const name of [
        "Client shared",
        "Laboratory working files",
        "Sample photos",
      ])
        folders.push({
          _id: id(),
          clientId: client._id,
          parentId: null,
          name,
          version: 0,
        });
      for (const [name, folder, source, visibility] of [
        [
          "Client instructions.pdf",
          folders[0]._id,
          "client",
          "report_eligible",
        ],
        [
          "Internal worksheet notes.pdf",
          folders[1]._id,
          "laboratory",
          "internal",
        ],
      ]) {
        const p = await PDFDocument.create(),
          page = p.addPage([595, 842]),
          font = await p.embedFont(StandardFonts.Helvetica);
        page.drawText("SYNTHETIC DEMO DOCUMENT", {
          x: 50,
          y: 760,
          size: 20,
          font,
        });
        page.drawText(name, { x: 50, y: 720, size: 15, font });
        page.drawText(
          "Example only. No client information. Not a laboratory result.",
          { x: 50, y: 680, size: 12, font },
        );
        const blob = new Blob([new Uint8Array(await p.save())], {
            type: "application/pdf",
          }),
          aid = id(),
          vid = id();
        const asset: ClientFile = {
          _id: aid,
          clientId: client._id,
          folderId: folder,
          name,
          description: "Synthetic demonstration file",
          category: "technical",
          source,
          visibility,
          trfId: trf ? trf._id : null,
          sampleId: null,
          archived: false,
          version: 0,
          currentId: vid,
          createdAt: now(),
          updatedAt: now(),
        };
        assets.push(asset);
        versions.push({
          _id: vid,
          assetId: aid,
          revision: 1,
          name,
          mime: "application/pdf",
          size: blob.size,
          sha256: await sha(blob),
          status: "ready",
          uploadedBy: getActor().id,
          createdAt: now(),
          reason: "Synthetic demonstration",
        });
        blobs.set(vid, blob);
      }
    })());
  const links = (v: any) => {
    const r = getRecords();
    if (!r.clients.some((c: any) => c._id === v.clientId))
      throw new Error("Client not found");
    if (
      v.folderId &&
      !folders.some((f) => f._id === v.folderId && f.clientId === v.clientId)
    )
      throw new Error("Folder is outside this client");
    if (
      v.trfId &&
      !r.trfs.some((t: any) => t._id === v.trfId && t.clientId === v.clientId)
    )
      throw new Error("Request does not belong to this client");
    if (
      v.sampleId &&
      !r.samples.some((s: any) => s._id === v.sampleId && s.trfId === v.trfId)
    )
      throw new Error("Sample does not belong to this request");
  };
  const withCurrent = (a: ClientFile) => ({
    ...a,
    current: versions.find((v) => v._id === a.currentId),
  });
  const changed = (a: any, v: number) => {
    if (!a || a.version !== v) throw new Error("Record changed; refresh");
  };
  async function request(path: string, method: string, input: any = {}) {
    scope();
    await init();
    const u = new URL(path, "http://demo"),
      parts = u.pathname.split("/").filter(Boolean),
      [, kind, key] = parts;
    if (kind === "status")
      return {
        ready: true,
        demo: true,
        usedBytes: versions.reduce(
          (n, v) => n + (v.status === "ready" ? v.size : 0),
          0,
        ),
        limitBytes: FILE_BUDGET_BYTES,
        maxFileBytes: MAX_FILE_BYTES,
        provider: "Browser-only demonstration",
        message:
          "Demo files stay in this browser session. No Supabase upload or malware scan. Reload clears your changes.",
        cleanupCount: 0,
      };
    if (kind === "clients") {
      const q = (u.searchParams.get("q") ?? "").toLowerCase();
      return getRecords()
        .clients.filter((c: any) =>
          (c.name + " " + c.number).toLowerCase().includes(q),
        )
        .slice(0, 100);
    }
    if (kind === "links") {
      const requests = getRecords().trfs.filter((r: any) => r.clientId === key);
      return {
        requests,
        samples: getRecords().samples.filter((s: any) =>
          requests.some((r: any) => r._id === s.trfId),
        ),
      };
    }
    if (kind === "folders") {
      if (method === "GET")
        return structuredClone(folders.filter((f) => f.clientId === key));
      if (
        !getActor().roles.some((r: string) =>
          ["admin", "manager", "reception"].includes(r),
        )
      )
        throw new Error("No folder management permission");
      if (method === "POST") {
        const v = folderInput.parse(input);
        links({ ...v, folderId: v.parentId });
        const old = folders.find(
          (f) =>
            f.clientId === v.clientId &&
            f.parentId === v.parentId &&
            f.name.toLowerCase() === v.name.toLowerCase(),
        );
        if (old) return structuredClone(old);
        const row = { _id: id(), ...v, version: 0 };
        folders.push(row);
        onAudit(row._id, "folder_created", row);
        return structuredClone(row);
      }
      const f = folders.find((f) => f._id === key)!;
      changed(f, input.version);
      fileName.parse(input.name);
      const seen = new Set([key]);
      let parent = input.parentId;
      while (parent) {
        if (seen.has(parent))
          throw new Error("Cannot move a folder into its descendants");
        seen.add(parent);
        const p = folders.find(
          (p) => p._id === parent && p.clientId === f.clientId,
        );
        if (!p) throw new Error("Parent folder is outside this client");
        parent = p.parentId;
      }
      if (
        folders.some(
          (x) =>
            x._id !== key &&
            x.clientId === f.clientId &&
            x.parentId === input.parentId &&
            x.name.toLowerCase() === input.name.toLowerCase(),
        )
      )
        throw new Error("Folder already exists");
      Object.assign(f, {
        name: input.name,
        parentId: input.parentId,
        version: f.version + 1,
      });
      onAudit(key, "folder_updated", f);
      return structuredClone(f);
    }
    if (kind === "list") {
      const clientId = u.searchParams.get("clientId"),
        folder = u.searchParams.get("folderId") ?? "all",
        page = Number(u.searchParams.get("page") ?? 1);
      let rows = assets.filter(
        (a) =>
          a.clientId === clientId &&
          a.archived === (u.searchParams.get("archived") === "true") &&
          fileAccess(getActor().roles, a.category),
      );
      if (u.searchParams.get("eligible") === "true")
        rows = rows.filter(
          (a) =>
            a.visibility === "report_eligible" &&
            a.category !== "commercial" &&
            (!a.trfId || a.trfId === u.searchParams.get("trfId")) &&
            versions.some(
              (v) =>
                v._id === a.currentId &&
                ["application/pdf", "image/png", "image/jpeg"].includes(v.mime),
            ),
        );
      if (folder !== "all")
        rows = rows.filter(
          (a) => a.folderId === (folder === "root" ? null : folder),
        );
      for (const field of ["category", "source"] as const) {
        const value = u.searchParams.get(field);
        if (value) rows = rows.filter((a) => a[field] === value);
      }
      const q = (u.searchParams.get("q") ?? "").toLowerCase();
      rows = rows.filter((a) =>
        (a.name + " " + a.description).toLowerCase().includes(q),
      );
      const mime = u.searchParams.get("mime");
      if (mime)
        rows = rows.filter(
          (a) => versions.find((v) => v._id === a.currentId)?.mime === mime,
        );
      const from = u.searchParams.get("from"),
        to = u.searchParams.get("to");
      if (from) rows = rows.filter((a) => a.createdAt.slice(0, 10) >= from);
      if (to) rows = rows.filter((a) => a.createdAt.slice(0, 10) <= to);
      rows.reverse();
      return structuredClone({
        items: rows.slice((page - 1) * 50, page * 50).map(withCurrent),
        total: rows.length,
        page,
      });
    }
    if (kind === "assets") {
      const a = assets.find((a) => a._id === key)!;
      if (!a) throw new Error("File not found");
      permission(a.category, method !== "GET");
      if (method === "GET")
        return structuredClone({
          ...a,
          versions: versions.filter((v) => v.assetId === key).reverse(),
        });
      changed(a, input.version);
      const { version, reason, ...rest } = input;
      const v = fileMetadata.parse(rest);
      if (v.clientId !== a.clientId)
        throw new Error("Cannot move files between clients");
      permission(v.category, true);
      links(v);
      const current = versions.find((v) => v._id === a.currentId);
      if (current && fileMime(v.name) !== current.mime)
        throw new Error("Keep the original extension");
      Object.assign(a, v, { version: a.version + 1, updatedAt: now() });
      onAudit(key, "file_details_updated", a);
      return structuredClone(a);
    }
    if (kind === "bulk") {
      if (!canManageFiles(getActor().roles))
        throw new Error("No file management permission");
      if (input.items.length > 100) throw new Error("Select up to 100 files");
      const rows = input.items.map((i: any) => {
        const a = assets.find(
          (a) => a._id === i.id && a.clientId === input.clientId,
        )!;
        changed(a, i.version);
        permission(a.category, true);
        return a;
      });
      if (input.action === "move")
        links({ clientId: input.clientId, folderId: input.folderId });
      if (input.action === "categorize") permission(input.category, true);
      for (const a of rows) {
        if (input.action === "move") a.folderId = input.folderId;
        else if (input.action === "categorize") a.category = input.category;
        else a.archived = input.action === "archive";
        a.version++;
        a.updatedAt = now();
        onAudit(a._id, input.action, a);
      }
      return { updated: rows.length };
    }
    if (kind === "uploads") {
      const v = fileUploadInput.parse(input);
      permission(v.category, true);
      links(v);
      const existing = jobs.get(v.requestKey);
      if (existing) {
        const old = versions.find((x) => x._id === existing)!;
        if (old.sha256 !== v.sha256 || old.size !== v.size)
          throw new Error("Upload key belongs to another request");
        return { upload: structuredClone(old) };
      }
      let a = v.assetId ? assets.find((a) => a._id === v.assetId) : undefined;
      if (v.assetId) {
        changed(a, v.assetVersion!);
        if (a!.clientId !== v.clientId || a!.archived)
          throw new Error("Invalid replacement");
        permission(a!.category, true);
        if (fileMime(a!.name) !== fileMime(v.name))
          throw new Error("Replacement must keep the same file type");
      }
      if (!a && v.duplicate === "skip") {
        const duplicate = assets.find(
          (a) =>
            a.clientId === v.clientId &&
            a.folderId === v.folderId &&
            !a.archived &&
            fileAccess(getActor().roles, a.category) &&
            versions.some(
              (r) =>
                r.assetId === a._id &&
                r.sha256 === v.sha256 &&
                r.status === "ready",
            ),
        );
        if (duplicate) return { skipped: true, assetId: duplicate._id };
      }
      if (!a) {
        a = {
          _id: id(),
          ...fileMetadata.parse(
            Object.fromEntries(
              Object.keys(fileMetadata.shape).map((k) => [k, (v as any)[k]]),
            ),
          ),
          archived: false,
          version: 0,
          currentId: null,
          createdAt: now(),
          updatedAt: now(),
        };
        assets.push(a);
      }
      const version: FileRevision = {
        _id: id(),
        assetId: a._id,
        revision: versions.filter((r) => r.assetId === a!._id).length + 1,
        name: v.name,
        mime: fileMime(v.name),
        size: v.size,
        sha256: v.sha256,
        status: "pending",
        uploadedBy: getActor().id,
        createdAt: now(),
        reason: v.reason,
      };
      versions.push(version);
      jobs.set(v.requestKey, version._id);
      return { upload: structuredClone(version) };
    }
    throw new Error("Unknown file operation");
  }
  async function upload(id: string, file: Blob) {
    scope();
    await init();
    const v = versions.find((v) => v._id === id)!;
    if (!v) throw new Error("Upload not found");
    const a = assets.find((a) => a._id === v.assetId)!;
    permission(a.category, true);
    if (v.status === "ready") return { upload: structuredClone(v) };
    if (file.size !== v.size || (await sha(file)) !== v.sha256)
      throw new Error("Checksum mismatch");
    if (
      [...blobs.values()].reduce((sum, b) => sum + b.size, 0) + file.size >
      100_000_000
    ) {
      throw new Error(
        "Demo session limit is 100 MB. Reload to clear local files.",
      );
    }
    blobs.set(id, file);
    v.status = "ready";
    a.currentId = id;
    a.version++;
    a.updatedAt = now();
    onAudit(a._id, "demo_file_uploaded", {
      versionId: id,
      scan: "not_scanned_demo",
    });
    return { upload: structuredClone(v) };
  }
  async function download(id: string) {
    scope();
    await init();
    const v = versions.find((v) => v._id === id);
    const a = v && assets.find((a) => a._id === v.assetId);
    if (!v || !a || v.status !== "ready")
      throw new Error("File version not found");
    permission(a.category);
    onAudit(a._id, "file_downloaded", { versionId: id });
    return blobs.get(id)!;
  }
  async function appendices(ids: string[], clientId: string, trfId: string) {
    await init();
    let size = 0;
    return ids.map((id) => {
      const v = versions.find((v) => v._id === id),
        a = v && assets.find((a) => a._id === v.assetId);
      if (
        !v ||
        !a ||
        a.archived ||
        a.clientId !== clientId ||
        a.visibility !== "report_eligible" ||
        a.category === "commercial" ||
        v.status !== "ready" ||
        (a.trfId && a.trfId !== trfId)
      )
        throw new Error("Appendix is not eligible");
      permission(a.category);
      if (!["application/pdf", "image/png", "image/jpeg"].includes(v.mime))
        throw new Error("Appendices support PDF, PNG or JPG");
      size += v.size;
      if (size > 50_000_000) throw new Error("Appendices exceed 50 MB");
      return {
        versionId: id,
        assetId: a._id,
        name: v.name,
        mime: v.mime,
        size: v.size,
        sha256: v.sha256,
        revision: v.revision,
      };
    });
  }
  return { request, upload, download, appendices };
}
