import { Router } from "express";
import mongoose from "mongoose";
import { z } from "zod";
import {
  captureConsolidated,
  consolidatedInput,
  consolidatedPdf,
  objectId,
  type ConsolidatedTest,
} from "@lims/core";
import {
  Consolidated,
  Trf,
  Client,
  Sample,
  Assignment,
  Audit,
  nextNumber,
} from "../models.js";
import { allow, DomainError } from "../domain.js";
export const consolidatedRouter = Router();
const roles = ["admin", "manager", "reviewer", "signatory"];
consolidatedRouter.use("/consolidated", (_req, res, next) => {
  allow(res.locals.user.roles, roles);
  next();
});
async function context(id: string, session?: mongoose.ClientSession) {
  const trf: any = await Trf.findById(id)
    .session(session ?? null)
    .lean();
  if (!trf) throw new DomainError(404, "Test request not found");
  const client: any = await Client.findById(trf.clientId)
    .session(session ?? null)
    .lean();
  if (!client) throw new DomainError(409, "Linked client is missing");
  const samples: any[] = await Sample.find({ trfId: id })
    .session(session ?? null)
    .lean();
  const assignments: any[] = await Assignment.find({
    sampleId: { $in: samples.map((s) => s._id) },
  })
    .session(session ?? null)
    .populate("methodId technicianId reviewerId authorizedBy equipmentId")
    .sort({ number: 1 })
    .lean();
  const tests: ConsolidatedTest[] = assignments.map((a) => {
    const s = samples.find((s) => String(s._id) === String(a.sampleId));
    return {
      id: String(a._id),
      version: a.version,
      assignmentNumber: a.number,
      sampleId: String(s._id),
      sampleNumber: s.number,
      description: s.description,
      material: s.material,
      condition: s.condition,
      storage: s.storage,
      receiptStatus: s.receiptStatus,
      method: a.methodId?.name ?? "Missing method",
      methodVersion: a.methodId?.version ?? "unconfigured",
      status: a.status,
      observations: a.observations ?? {},
      technician: a.technicianId?.name ?? "",
      reviewer: a.reviewerId?.name ?? "",
      signatory: a.authorizedBy?.name ?? "",
      equipment: a.equipmentId
        ? a.equipmentId.number + " / " + a.equipmentId.name
        : "",
    };
  });
  return {
    client: {
      name: client.name,
      contact: client.contact,
      email: client.email,
      phone: client.phone,
      address: client.address,
    },
    request: {
      id: String(trf._id),
      number: trf.number,
      project: trf.project,
      site: trf.site,
      dueDate: trf.dueDate,
      requestedTests: trf.requestedTests,
    },
    tests,
  };
}
consolidatedRouter.get("/consolidated", async (_req, res) => {
  res.json(await Consolidated.find().sort({ createdAt: -1 }).limit(200).lean());
});
consolidatedRouter.get("/consolidated/options/:id", async (req, res) =>
  res.json(await context(objectId.parse(req.params.id))),
);
consolidatedRouter.post("/consolidated", async (req, res) => {
  const input = consolidatedInput.parse(req.body);
  let result: any;
  await mongoose.connection.transaction(async (session) => {
    let original: any = null;
    if (input.sourceId) {
      original = await Consolidated.findOne({
        _id: input.sourceId,
        status: "draft",
        version: input.sourceVersion,
        trfId: input.trfId,
      })
        .session(session)
        .lean();
      if (!original)
        throw new DomainError(
          409,
          "Source draft changed or is no longer current",
        );
      const updated = await Consolidated.updateOne(
        { _id: original._id, status: "draft", version: input.sourceVersion },
        { $set: { status: "superseded" }, $inc: { version: 1 } },
        { session },
      );
      if (!updated.modifiedCount)
        throw new DomainError(409, "Source draft changed");
    }
    let snapshot;
    try {
      snapshot = captureConsolidated(input, {
        ...(await context(input.trfId, session)),
        preparedBy: res.locals.user.name,
        capturedAt: new Date().toISOString(),
      });
    } catch (e) {
      if (e instanceof DomainError) throw e;
      throw new DomainError(409, (e as Error).message);
    }
    const [doc] = await Consolidated.create(
      [
        {
          number: original?.number ?? (await nextNumber("CTR", session)),
          trfId: input.trfId,
          revision: original ? original.revision + 1 : 0,
          status: "draft",
          snapshot,
          reason: input.reason,
        },
      ],
      { session },
    );
    result = doc.toObject();
    await Audit.create(
      [
        {
          actorId: res.locals.user._id,
          entity: "consolidated",
          entityId: doc._id,
          action: original ? "revision_created" : "draft_created",
          before: original,
          after: result,
          reason: input.reason,
        },
      ],
      { session },
    );
  });
  res.status(201).json(result);
});
consolidatedRouter.post("/consolidated/:id/withdraw", async (req, res) => {
  const id = objectId.parse(req.params.id);
  const input = z
    .object({
      version: z.number().int().min(0),
      reason: z.string().trim().min(3).max(500),
    })
    .strict()
    .parse(req.body);
  let result: any;
  await mongoose.connection.transaction(async (session) => {
    const before = await Consolidated.findOne({
      _id: id,
      status: "draft",
      version: input.version,
    })
      .session(session)
      .lean();
    if (!before)
      throw new DomainError(409, "Draft changed or is no longer current");
    result = await Consolidated.findOneAndUpdate(
      { _id: id, status: "draft", version: input.version },
      { $set: { status: "withdrawn" }, $inc: { version: 1 } },
      { new: true, session },
    ).lean();
    if (!result) throw new DomainError(409, "Draft changed");
    await Audit.create(
      [
        {
          actorId: res.locals.user._id,
          entity: "consolidated",
          entityId: id,
          action: "withdraw",
          before,
          after: result,
          reason: input.reason,
        },
      ],
      { session },
    );
  });
  res.json(result);
});
consolidatedRouter.get("/consolidated/:id/pdf", async (req, res) => {
  const doc: any = await Consolidated.findById(
    objectId.parse(req.params.id),
  ).lean();
  if (!doc) throw new DomainError(404, "Report not found");
  res
    .type("application/pdf")
    .set(
      "Content-Disposition",
      `attachment; filename="${doc.number}-R${doc.revision}-DRAFT.pdf"`,
    )
    .send(Buffer.from(await consolidatedPdf(doc)));
});
