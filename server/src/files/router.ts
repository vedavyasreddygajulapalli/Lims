import express, { Router } from "express";
import mongoose from "mongoose";
import { z } from "zod";
import rateLimit from "express-rate-limit";
import {
  fileMetadata,
  fileUploadInput,
  folderInput,
  fileName,
  fileAccess,
  canManageFiles,
  FILE_BUDGET_BYTES,
  MAX_FILE_BYTES,
  objectId,
  fileMime,
} from "@lims/core";
import { Client, Trf, Sample, Audit } from "../models.js";
import { DomainError, allow } from "../domain.js";
import { FileFolder, FileAsset, FileVersion, FileBudget } from "./models.js";
import {
  SupabaseStorage,
  validateFile,
  hashFile,
  filePages,
  type FileStorage,
  type StoredObject,
} from "./storage.js";
type Session = mongoose.ClientSession;
const roles = [
  "admin",
  "manager",
  "reception",
  "reviewer",
  "signatory",
  "accounts",
];
const reason = z.string().trim().min(3).max(500);
const ver = z.number().int().min(0);
const ids = z
  .array(z.object({ id: objectId, version: ver }).strict())
  .min(1)
  .max(100)
  .refine(
    (a) => new Set(a.map((x) => x.id)).size === a.length,
    "Duplicate selection",
  );
const access = (u: any, c: string, write = false) => {
  if (!fileAccess(u.roles, c, write))
    throw new DomainError(
      403,
      "Your role does not have permission for this file",
    );
};
const categoryFilter = (u: any) => ({
  category: {
    $in: ["general", "technical", "commercial", "report", "photo"].filter((c) =>
      fileAccess(u.roles, c),
    ),
  },
});
const audit = async (
  u: any,
  entityId: any,
  action: string,
  before: any,
  after: any,
  note: string,
  session?: Session,
) => {
  await Audit.create(
    [
      {
        actorId: u._id,
        entity: "files",
        entityId,
        action,
        before,
        after,
        reason: note,
      },
    ],
    session ? { session } : {},
  );
};
const lock = async (s: Session) => {
  await FileBudget.updateOne(
    { _id: "client-files" },
    { $inc: { folderLock: 1 } },
    { session: s },
  );
};
async function validateLinks(v: any, s?: Session) {
  if (!(await Client.exists({ _id: v.clientId }).session(s ?? null)))
    throw new DomainError(404, "Client not found");
  if (
    v.folderId &&
    !(await FileFolder.exists({
      _id: v.folderId,
      clientId: v.clientId,
    }).session(s ?? null))
  )
    throw new DomainError(
      422,
      "Folder belongs to another client or is missing",
    );
  if (
    v.trfId &&
    !(await Trf.exists({ _id: v.trfId, clientId: v.clientId }).session(
      s ?? null,
    ))
  )
    throw new DomainError(422, "Request does not belong to this client");
  if (
    v.sampleId &&
    (!v.trfId ||
      !(await Sample.exists({ _id: v.sampleId, trfId: v.trfId }).session(
        s ?? null,
      )))
  )
    throw new DomainError(
      422,
      "Sample does not belong to the selected request",
    );
}
function publicVersion(v: any) {
  if (!v) return null;
  const { providerId, providerPath, requestKey, __v, ...rest } = v;
  return rest;
}
async function withCurrent(rows: any[]) {
  const versions: any[] = await FileVersion.find({
    _id: { $in: rows.map((r) => r.currentId).filter(Boolean) },
  }).lean();
  return rows.map((r) => ({
    ...r,
    current: publicVersion(
      versions.find((v) => String(v._id) === String(r.currentId)),
    ),
  }));
}
export async function readFileVersion(storage: FileStorage, id: string) {
  const v: any = await FileVersion.findOne({ _id: id, status: "ready" }).lean();
  if (!v) throw new DomainError(404, "File version not found");
  const data = await storage.get({ id: v.providerId, path: v.providerPath });
  if (data.length !== v.size || hashFile(data) !== v.sha256)
    throw new DomainError(502, "File integrity check failed");
  return { data, version: v };
}
export function fileRouter(storage: FileStorage = new SupabaseStorage()) {
  const router = Router();
  router.use("/files", (_req, res, next) => {
    allow(res.locals.user.roles, roles);
    res.set("Cache-Control", "no-store");
    next();
  });
  router.get("/files/status", async (_req, res) => {
    const b: any = await FileBudget.findById("client-files").lean();
    res.json({
      ready: storage.ready(),
      usedBytes: b?.bytes ?? 0,
      limitBytes: FILE_BUDGET_BYTES,
      maxFileBytes: MAX_FILE_BYTES,
      provider: "Supabase · encrypted private files",
      message: storage.ready()
        ? "Storage configured; uploads require a successful malware scan."
        : "Live uploads need Supabase credentials, an encryption key and a ClamAV scanner.",
      cleanupCount: res.locals.user.roles.includes("admin")
        ? await FileVersion.countDocuments({
            status: { $in: ["pending", "processing", "cleanup"] },
            updatedAt: { $lt: new Date(Date.now() - 3600_000) },
          })
        : 0,
    });
  });
  router.get("/files/clients", async (req, res) => {
    const q = String(req.query.q ?? "")
      .slice(0, 150)
      .replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    res.json(
      await Client.find(
        q
          ? {
              $or: [
                { name: { $regex: q, $options: "i" } },
                { number: { $regex: q, $options: "i" } },
              ],
            }
          : {},
      )
        .select("name number")
        .sort({ name: 1 })
        .limit(100)
        .lean(),
    );
  });
  router.get("/files/links/:clientId", async (req, res) => {
    const clientId = objectId.parse(req.params.clientId);
    const requests: any[] = await Trf.find({ clientId })
      .select("number project")
      .sort({ createdAt: -1 })
      .limit(500)
      .lean();
    const samples = await Sample.find({
      trfId: { $in: requests.map((r) => r._id) },
    })
      .select("number description trfId")
      .sort({ createdAt: -1 })
      .limit(1000)
      .lean();
    res.json({ requests, samples });
  });
  router.get("/files/folders/:clientId", async (req, res) =>
    res.json(
      await FileFolder.find({ clientId: objectId.parse(req.params.clientId) })
        .sort({ name: 1 })
        .lean(),
    ),
  );
  router.post("/files/folders", async (req, res) => {
    allow(res.locals.user.roles, ["admin", "manager", "reception"]);
    const v = folderInput.parse(req.body);
    let result: any;
    await mongoose.connection.transaction(async (s) => {
      await lock(s);
      await validateLinks({ ...v, folderId: v.parentId }, s);
      if (
        (await FileFolder.countDocuments({ clientId: v.clientId }).session(
          s,
        )) >= 1000
      )
        throw new DomainError(422, "Maximum 1,000 folders per client");
      const existing = await FileFolder.findOne({
        clientId: v.clientId,
        parentId: v.parentId,
        key: v.name.toLowerCase(),
      })
        .session(s)
        .lean();
      if (existing) {
        result = existing;
        return;
      }
      [result] = await FileFolder.create(
        [{ ...v, key: v.name.toLowerCase() }],
        { session: s },
      );
      await audit(
        res.locals.user,
        result._id,
        "folder_created",
        null,
        result,
        "Created named folder",
        s,
      );
    });
    res.status(201).json(result);
  });
  router.patch("/files/folders/:id", async (req, res) => {
    allow(res.locals.user.roles, ["admin", "manager", "reception"]);
    const id = objectId.parse(req.params.id),
      v = z
        .object({
          version: ver,
          name: fileName,
          parentId: objectId.nullable(),
          reason,
        })
        .strict()
        .parse(req.body);
    let result;
    await mongoose.connection.transaction(async (s) => {
      await lock(s);
      const f: any = await FileFolder.findOne({ _id: id, version: v.version })
        .session(s)
        .lean();
      if (!f) throw new DomainError(409, "Folder changed; refresh");
      const seen = new Set([id]);
      let parent = v.parentId;
      while (parent) {
        if (seen.has(parent))
          throw new DomainError(
            422,
            "Cannot move a folder into itself or its descendants",
          );
        seen.add(parent);
        const p: any = await FileFolder.findOne({
          _id: parent,
          clientId: f.clientId,
        })
          .session(s)
          .lean();
        if (!p)
          throw new DomainError(422, "Parent folder is not in this client");
        parent = p.parentId ? String(p.parentId) : null;
      }
      result = await FileFolder.findOneAndUpdate(
        { _id: id, version: v.version },
        {
          $set: {
            name: v.name,
            key: v.name.toLowerCase(),
            parentId: v.parentId,
          },
          $inc: { version: 1 },
        },
        { new: true, session: s },
      ).lean();
      await audit(
        res.locals.user,
        id,
        "folder_updated",
        f,
        result,
        v.reason,
        s,
      );
    });
    res.json(result);
  });
  router.get("/files/list", async (req, res) => {
    const v = z
      .object({
        clientId: objectId,
        eligible: z.enum(["true", "false"]).default("false"),
        trfId: objectId.optional(),
        folderId: z
          .union([objectId, z.literal("all"), z.literal("root")])
          .default("all"),
        q: z.string().max(150).default(""),
        category: z
          .enum(["", "general", "technical", "commercial", "report", "photo"])
          .default(""),
        source: z.enum(["", "client", "laboratory"]).default(""),
        archived: z.enum(["true", "false"]).default("false"),
        page: z.coerce.number().int().min(1).max(100000).default(1),
        mime: z.string().max(100).default(""),
        from: z.string().max(10).default(""),
        to: z.string().max(10).default(""),
      })
      .strict()
      .parse(req.query);
    const filter: any = {
      clientId: v.clientId,
      archived: v.archived === "true",
      ...categoryFilter(res.locals.user),
    };
    if (v.eligible === "true") {
      filter.visibility = "report_eligible";
      filter.$nor = [{ category: "commercial" }];
      filter.currentId = {
        $in: (
          await FileVersion.find({
            status: "ready",
            clientId: v.clientId,
            mime: { $in: ["application/pdf", "image/png", "image/jpeg"] },
          })
            .select("_id")
            .lean()
        ).map((x) => x._id),
      };
      if (v.trfId) {
        await validateLinks({ clientId: v.clientId, trfId: v.trfId });
        filter.$and = [{ $or: [{ trfId: null }, { trfId: v.trfId }] }];
      }
    }
    if (v.category) {
      access(res.locals.user, v.category);
      filter.category = v.category;
    }
    if (v.source) filter.source = v.source;
    if (v.folderId !== "all")
      filter.folderId = v.folderId === "root" ? null : v.folderId;
    if (v.q) {
      const q = v.q.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      filter.$or = [
        { name: { $regex: q, $options: "i" } },
        { description: { $regex: q, $options: "i" } },
      ];
    }
    if (v.from || v.to) {
      filter.createdAt = {};
      for (const [k, d] of [
        ["$gte", v.from],
        ["$lt", v.to],
      ])
        if (d) {
          const date = new Date(d + "T00:00:00Z");
          if (!Number.isFinite(date.getTime()))
            throw new DomainError(400, "Invalid date filter");
          if (k === "$lt") date.setUTCDate(date.getUTCDate() + 1);
          filter.createdAt[k] = date;
        }
    }
    if (v.mime) {
      const vv = await FileVersion.find({ mime: v.mime, status: "ready" })
        .select("_id")
        .lean();
      filter.currentId = { $in: vv.map((x) => x._id) };
    }
    const total = await FileAsset.countDocuments(filter);
    const rows = await FileAsset.find(filter)
      .sort({ createdAt: -1, _id: -1 })
      .skip((v.page - 1) * 50)
      .limit(50)
      .lean();
    res.json({ items: await withCurrent(rows), total, page: v.page });
  });
  router.get("/files/assets/:id", async (req, res) => {
    const a: any = await FileAsset.findById(
      objectId.parse(req.params.id),
    ).lean();
    if (!a) throw new DomainError(404, "File not found");
    access(res.locals.user, a.category);
    const versions = await FileVersion.find({ assetId: a._id })
      .sort({ revision: -1 })
      .lean();
    res.json({ ...a, versions: versions.map(publicVersion) });
  });
  router.post("/files/bulk", async (req, res) => {
    const v = z
      .object({
        clientId: objectId,
        items: ids,
        action: z.enum(["move", "archive", "restore", "categorize"]),
        folderId: objectId.nullable().optional(),
        category: z
          .enum(["general", "technical", "commercial", "report", "photo"])
          .optional(),
        reason,
      })
      .strict()
      .parse(req.body);
    if (!canManageFiles(res.locals.user.roles))
      throw new DomainError(403, "No file management permission");
    await mongoose.connection.transaction(async (s) => {
      await lock(s);
      if (v.action === "move") {
        if (v.folderId === undefined)
          throw new DomainError(400, "Select a destination folder");
        await validateLinks({ clientId: v.clientId, folderId: v.folderId }, s);
      }
      for (const item of v.items) {
        const a: any = await FileAsset.findOne({
          _id: item.id,
          clientId: v.clientId,
          version: item.version,
          activeUpload: null,
        })
          .session(s)
          .lean();
        if (!a)
          throw new DomainError(
            409,
            "A selected file changed or is uploading; refresh",
          );
        access(res.locals.user, a.category, true);
        const patch: any = {};
        if (v.action === "move") patch.folderId = v.folderId;
        else if (v.action === "categorize") {
          if (!v.category) throw new DomainError(400, "Select a category");
          access(res.locals.user, v.category, true);
          patch.category = v.category;
        } else patch.archived = v.action === "archive";
        const after = await FileAsset.findOneAndUpdate(
          { _id: a._id, version: item.version },
          { $set: patch, $inc: { version: 1 } },
          { new: true, session: s },
        ).lean();
        await audit(res.locals.user, a._id, v.action, a, after, v.reason, s);
      }
    });
    res.json({ updated: v.items.length });
  });
  router.patch("/files/assets/:id", async (req, res) => {
    const id = objectId.parse(req.params.id);
    const v = fileMetadata.extend({ version: ver, reason }).parse(req.body);
    let after;
    await mongoose.connection.transaction(async (s) => {
      await lock(s);
      const a: any = await FileAsset.findOne({
        _id: id,
        clientId: v.clientId,
        version: v.version,
        activeUpload: null,
      })
        .session(s)
        .lean();
      if (!a)
        throw new DomainError(409, "File changed or is uploading; refresh");
      access(res.locals.user, a.category, true);
      access(res.locals.user, v.category, true);
      await validateLinks(v, s);
      if (a.currentId) {
        const current: any = await FileVersion.findById(a.currentId)
          .session(s)
          .lean();
        if (fileMime(v.name) !== current?.mime)
          throw new DomainError(
            422,
            "Keep the original file extension when renaming",
          );
      }
      const { version, reason: note, ...patch } = v;
      after = await FileAsset.findOneAndUpdate(
        { _id: id, version },
        { $set: patch, $inc: { version: 1 } },
        { new: true, session: s },
      ).lean();
      await audit(
        res.locals.user,
        id,
        "file_details_updated",
        a,
        after,
        note,
        s,
      );
    });
    res.json(after);
  });
  router.post(
    "/files/uploads",
    rateLimit({ windowMs: 60000, limit: 200 }),
    async (req, res) => {
      const v = fileUploadInput.parse(req.body);
      access(res.locals.user, v.category, true);
      if (!storage.ready())
        throw new DomainError(503, "Live storage is not configured");
      let result: any;
      await mongoose.connection.transaction(async (s) => {
        await lock(s);
        await validateLinks(v, s);
        const old: any = await FileVersion.findOne({ requestKey: v.requestKey })
          .session(s)
          .lean();
        if (old) {
          if (
            String(old.uploadedBy) !== String(res.locals.user._id) ||
            String(old.clientId) !== v.clientId ||
            old.sha256 !== v.sha256 ||
            old.size !== v.size
          )
            throw new DomainError(409, "Upload key belongs to another request");
          result = { upload: publicVersion(old) };
          return;
        }
        let a: any;
        if (v.assetId) {
          a = await FileAsset.findOne({
            _id: v.assetId,
            clientId: v.clientId,
            version: v.assetVersion,
            archived: false,
            activeUpload: null,
          })
            .session(s)
            .lean();
          if (!a)
            throw new DomainError(409, "File changed or is already uploading");
          access(res.locals.user, a.category, true);
          if (fileMime(a.name) !== fileMime(v.name))
            throw new DomainError(
              422,
              "Replacement must keep the same file type",
            );
        }
        if (!a && v.duplicate === "skip") {
          const duplicates: any[] = await FileVersion.find({
            clientId: v.clientId,
            sha256: v.sha256,
            status: "ready",
          })
            .session(s)
            .lean();
          if (duplicates.length) {
            const asset: any = await FileAsset.findOne({
              _id: { $in: duplicates.map((d) => d.assetId) },
              archived: false,
              folderId: v.folderId,
              ...categoryFilter(res.locals.user),
            })
              .session(s)
              .lean();
            if (asset) {
              result = { skipped: true, assetId: String(asset._id) };
              return;
            }
          }
        }
        const budget: any = await FileBudget.findOneAndUpdate(
          {
            _id: "client-files",
            bytes: { $lte: FILE_BUDGET_BYTES - v.size - 28 },
          },
          { $inc: { bytes: v.size + 28 } },
          { new: true, session: s },
        ).lean();
        if (!budget)
          throw new DomainError(
            409,
            "Storage allowance reached; no paid upgrade will be started",
          );
        if (!a) {
          const meta = fileMetadata.parse(
            Object.fromEntries(
              Object.keys(fileMetadata.shape).map((k) => [k, (v as any)[k]]),
            ),
          );
          const [created] = await FileAsset.create([meta], { session: s });
          a = created.toObject();
        }
        const revision = Number(a.nextRevision) + 1;
        const [job] = await FileVersion.create(
          [
            {
              assetId: a._id,
              clientId: v.clientId,
              revision,
              name: v.name,
              mime: fileMime(v.name),
              size: v.size,
              sha256: v.sha256,
              requestKey: v.requestKey,
              uploadedBy: res.locals.user._id,
              uploaderName: res.locals.user.name,
              reason: v.reason,
            },
          ],
          { session: s },
        );
        await FileAsset.updateOne(
          { _id: a._id },
          {
            $set: { activeUpload: job._id, nextRevision: revision },
            $inc: { version: 1 },
          },
          { session: s },
        );
        await audit(
          res.locals.user,
          a._id,
          "upload_reserved",
          null,
          { uploadId: job._id, size: v.size, revision },
          v.reason,
          s,
        );
        result = { upload: publicVersion(job.toObject()) };
      });
      res.status(201).json(result);
    },
  );
  const active = new Set<string>();
  router.put(
    "/files/uploads/:id",
    async (req, res, next) => {
      if (active.size >= 2)
        return next(
          new DomainError(429, "Two uploads are processing; retry this file"),
        );
      const id = objectId.parse(req.params.id);
      if (active.has(id))
        return next(new DomainError(409, "Upload is already processing"));
      const job: any = await FileVersion.findById(id).lean();
      if (!job || String(job.uploadedBy) !== String(res.locals.user._id))
        throw new DomainError(404, "Upload not found");
      const a: any = await FileAsset.findById(job.assetId).lean();
      access(res.locals.user, a?.category, true);
      if (job.status === "ready")
        return res.json({ upload: publicVersion(job) });
      if (job.status !== "pending")
        throw new DomainError(
          409,
          "Upload is not pending; create a new attempt",
        );
      if (!req.is("application/octet-stream"))
        throw new DomainError(415, "Upload binary file content");
      active.add(id);
      res.once("close", () => active.delete(id));
      next();
    },
    express.raw({ type: "application/octet-stream", limit: MAX_FILE_BYTES }),
    async (req, res) => {
      const id = String(req.params.id);
      let job: any;
      let object: StoredObject | undefined;
      let providerStarted = false;
      try {
        job = await FileVersion.findOneAndUpdate(
          { _id: id, status: "pending", uploadedBy: res.locals.user._id },
          { $set: { status: "processing" } },
          { new: true },
        ).lean();
        if (!job) throw new DomainError(409, "Upload is already processing");
        const data = req.body as Buffer;
        if (
          !Buffer.isBuffer(data) ||
          data.length !== job.size ||
          hashFile(data) !== job.sha256
        )
          throw new DomainError(422, "Upload size or checksum does not match");
        await validateFile(data, job.name);
        const pageCount = await filePages(data, job.mime);
        await storage.scan(data);
        providerStarted = true;
        object = await storage.put(id, data);
        await FileVersion.updateOne(
          { _id: id, status: "processing" },
          {
            $set: {
              providerId: object.id,
              providerPath: object.path,
              pageCount,
            },
          },
        );
        await mongoose.connection.transaction(async (s) => {
          const a: any = await FileAsset.findOne({
            _id: job.assetId,
            activeUpload: id,
            archived: false,
          })
            .session(s)
            .lean();
          if (!a) throw new DomainError(409, "Upload was cancelled");
          const ready = await FileVersion.updateOne(
            { _id: id, status: "processing" },
            { $set: { status: "ready", error: "" } },
            { session: s },
          );
          if (!ready.modifiedCount)
            throw new DomainError(409, "Upload state changed");
          await FileAsset.updateOne(
            { _id: a._id, activeUpload: id },
            {
              $set: { currentId: id, activeUpload: null },
              $inc: { version: 1 },
            },
            { session: s },
          );
          await audit(
            res.locals.user,
            a._id,
            "file_uploaded",
            null,
            { versionId: id, sha256: job.sha256, revision: job.revision },
            job.reason,
            s,
          );
        });
        res.json({
          upload: publicVersion(await FileVersion.findById(id).lean()),
        });
      } catch (e) {
        if (job) {
          let cleaned = !providerStarted;
          try {
            if (providerStarted) {
              await storage.remove(id, object);
              cleaned = true;
            }
          } catch {
            cleaned = false;
          }
          await mongoose.connection.transaction(async (s) => {
            const changed = await FileVersion.updateOne(
              { _id: id, status: "processing" },
              {
                $set: {
                  status: cleaned ? "failed" : "cleanup",
                  error: cleaned
                    ? "Upload failed; retry this file"
                    : "Storage cleanup required before retry",
                },
              },
              { session: s },
            );
            if (changed.modifiedCount && cleaned) {
              await FileBudget.updateOne(
                { _id: "client-files" },
                { $inc: { bytes: -(job.size + 28) } },
                { session: s },
              );
              await FileAsset.updateOne(
                { _id: job.assetId, activeUpload: id },
                { $set: { activeUpload: null }, $inc: { version: 1 } },
                { session: s },
              );
            }
            await audit(
              res.locals.user,
              job.assetId,
              "upload_failed",
              null,
              { uploadId: id, status: cleaned ? "failed" : "cleanup" },
              "Upload did not complete",
              s,
            );
          });
        }
        if (e instanceof DomainError) throw e;
        throw new DomainError(
          502,
          "Storage operation failed; retry after checking upload status",
        );
      } finally {
        active.delete(id);
      }
    },
  );
  router.post("/files/recover", async (_req, res) => {
    allow(res.locals.user.roles, ["admin"]);
    if (!storage.ready())
      throw new DomainError(503, "Storage is not configured");
    const stale: any[] = await FileVersion.find({
      status: { $in: ["pending", "processing", "cleanup"] },
      updatedAt: { $lt: new Date(Date.now() - 3600_000) },
    })
      .limit(100)
      .lean();
    let recovered = 0;
    for (const v of stale) {
      const claimed = await FileVersion.findOneAndUpdate(
        { _id: v._id, status: v.status, updatedAt: v.updatedAt },
        { $set: { status: "cleanup" } },
        { new: true },
      ).lean();
      if (!claimed) continue;
      try {
        await storage.remove(
          String(v._id),
          v.providerId ? { id: v.providerId, path: v.providerPath } : undefined,
        );
        await mongoose.connection.transaction(async (s) => {
          const changed = await FileVersion.updateOne(
            { _id: v._id, status: "cleanup" },
            {
              $set: {
                status: "failed",
                error: "Expired upload recovered; retry the file",
              },
            },
            { session: s },
          );
          if (changed.modifiedCount) {
            await FileBudget.updateOne(
              { _id: "client-files" },
              { $inc: { bytes: -(v.size + 28) } },
              { session: s },
            );
            await FileAsset.updateOne(
              { _id: v.assetId, activeUpload: v._id },
              { $set: { activeUpload: null }, $inc: { version: 1 } },
              { session: s },
            );
            await audit(
              res.locals.user,
              v.assetId,
              "upload_recovered",
              null,
              { uploadId: v._id },
              "Recovered expired upload",
              s,
            );
          }
        });
        recovered++;
      } catch {
        /* keep reservation until deletion is confirmed */
      }
    }
    res.json({ recovered, remaining: stale.length - recovered });
  });
  router.get("/files/versions/:id/download", async (req, res) => {
    const id = objectId.parse(req.params.id);
    const v: any = await FileVersion.findOne({
      _id: id,
      status: "ready",
    }).lean();
    if (!v) throw new DomainError(404, "File version not found");
    const a: any = await FileAsset.findById(v.assetId).lean();
    if (!a) throw new DomainError(404, "File not found");
    access(res.locals.user, a.category);
    const { data } = await readFileVersion(storage, id);
    await audit(
      res.locals.user,
      a._id,
      "file_downloaded",
      null,
      { versionId: id },
      "Authenticated file download",
    );
    res
      .set({
        "Content-Disposition": `attachment; filename="download.${v.name.split(".").pop()}"; filename*=UTF-8''${encodeURIComponent(v.name).replace(/'/g, "%27")}`,
        "Content-Type": v.mime,
        "X-Content-Type-Options": "nosniff",
        "Content-Security-Policy": "sandbox; default-src 'none'",
      })
      .send(data);
  });
  return router;
}
