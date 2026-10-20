import { Router } from "express";
import mongoose from "mongoose";
import { z } from "zod";
import {
  transition,
  workflowAction,
  equipmentUsable,
  objectId,
  draftReportPdf,
} from "@lims/core";
import {
  Assignment,
  Audit,
  Equipment,
  Report,
  User,
  Sample,
  Method,
  nextNumber,
} from "../models.js";
import { allow, DomainError } from "../domain.js";
export const workflowRouter = Router();
workflowRouter.get("/review", async (_req, res) => {
  allow(res.locals.user.roles, [
    "admin",
    "manager",
    "technician",
    "reviewer",
    "signatory",
  ]);
  res.json(
    await Assignment.find({
      status: {
        $in: [
          "observations_draft",
          "returned",
          "awaiting_review",
          "reviewed",
          "authorized",
        ],
      },
    })
      .sort({ updatedAt: -1 })
      .limit(200)
      .populate(
        "sampleId methodId technicianId reviewerId authorizedBy equipmentId",
      )
      .lean(),
  );
});
workflowRouter.post("/assignments/:id/workflow", async (req, res) => {
  const id = objectId.parse(req.params.id);
  const input = workflowAction.parse(req.body);
  let result: any;
  await mongoose.connection.transaction(async (session) => {
    const before: any = await Assignment.findById(id).session(session).lean();
    if (!before) throw new DomainError(404, "Assignment not found");
    if (input.action === "submit" && before.equipmentId) {
      const equipment: any = await Equipment.findById(
        before.equipmentId,
      ).session(session);
      if (!equipment || !equipmentUsable(equipment))
        throw new DomainError(
          409,
          "Selected equipment is unavailable or calibration is overdue",
        );
    }
    let change;
    try {
      change = transition(
        {
          ...before,
          technicianId: String(before.technicianId),
          methodId: String(before.methodId),
          reviewerId: before.reviewerId ? String(before.reviewerId) : null,
        },
        {
          id: String(res.locals.user._id),
          roles: res.locals.user.roles,
          methodIds: res.locals.user.methodIds,
        },
        input,
      );
    } catch (e) {
      throw new DomainError(409, (e as Error).message);
    }
    result = await Assignment.findOneAndUpdate(
      { _id: id, version: input.version },
      { $set: change },
      { new: true, session },
    ).lean();
    if (!result) throw new DomainError(409, "Record changed. Reload.");
    if (input.action === "reopen") {
      await Assignment.updateOne(
        { _id: id },
        { $set: { draftReportId: null } },
        { session },
      );
      await Report.updateMany(
        { assignmentId: id, status: "draft" },
        { $set: { status: "superseded" }, $inc: { version: 1 } },
        { session },
      );
    }
    await Audit.create(
      [
        {
          actorId: res.locals.user._id,
          entity: "assignments",
          entityId: id,
          action: input.action,
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
workflowRouter.patch("/assignments/:id/equipment", async (req, res) => {
  allow(res.locals.user.roles, ["manager", "admin"]);
  const id = objectId.parse(req.params.id);
  const input = z
    .object({
      version: z.number().int().min(0),
      equipmentId: objectId,
      reason: z.string().trim().min(3).max(500),
    })
    .strict()
    .parse(req.body);
  let result: any;
  await mongoose.connection.transaction(async (session) => {
    const eq: any = await Equipment.findById(input.equipmentId).session(
      session,
    );
    if (!eq || !equipmentUsable(eq))
      throw new DomainError(
        409,
        "Equipment must be active with current calibration",
      );
    const before = await Assignment.findOne({
      _id: id,
      version: input.version,
      status: { $in: ["assigned", "observations_draft", "returned"] },
    })
      .session(session)
      .lean();
    if (!before) throw new DomainError(409, "Record changed or locked");
    result = await Assignment.findOneAndUpdate(
      { _id: id, version: input.version },
      { $set: { equipmentId: input.equipmentId }, $inc: { version: 1 } },
      { new: true, session },
    ).lean();
    if (!result) throw new DomainError(409, "Record changed");
    await Audit.create(
      [
        {
          actorId: res.locals.user._id,
          entity: "assignments",
          entityId: id,
          action: "equipment",
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
workflowRouter.get("/reports", async (_req, res) => {
  allow(res.locals.user.roles, ["admin", "manager", "reviewer", "signatory"]);
  res.json(await Report.find().sort({ createdAt: -1 }).limit(200).lean());
});
workflowRouter.post("/reports", async (req, res) => {
  allow(res.locals.user.roles, ["signatory"]);
  const input = z
    .object({
      assignmentId: objectId,
      reason: z.string().trim().min(3).max(500),
    })
    .strict()
    .parse(req.body);
  let result: any;
  await mongoose.connection.transaction(async (session) => {
    const assignment: any = await Assignment.findById(input.assignmentId)
      .session(session)
      .lean();
    if (!assignment || assignment.status !== "authorized")
      throw new DomainError(409, "Authorize the observation record first");
    if (String(assignment.authorizedBy) !== String(res.locals.user._id))
      throw new DomainError(403, "Only its signatory may create this draft");
    if (assignment.draftReportId)
      throw new DomainError(409, "A current draft already exists");
    const sample: any = await Sample.findById(assignment.sampleId)
      .session(session)
      .lean();
    const method: any = await Method.findById(assignment.methodId)
      .session(session)
      .lean();
    const people = await User.find({
      _id: {
        $in: [
          assignment.technicianId,
          assignment.reviewerId,
          assignment.authorizedBy,
        ],
      },
    })
      .session(session)
      .lean();
    const name = (id: unknown) =>
      String(
        people.find((u) => String(u._id) === String(id))?.name ?? "Unknown",
      );
    const [r] = await Report.create(
      [
        {
          number: await nextNumber("RPT", session),
          assignmentId: assignment._id,
          revision: 0,
          status: "draft",
          reason: input.reason,
          snapshot: {
            assignmentNumber: assignment.number,
            sampleNumber: sample.number,
            method: method.name,
            methodVersion: method.version,
            observations: assignment.observations,
            technician: name(assignment.technicianId),
            reviewer: name(assignment.reviewerId),
            signatory: name(assignment.authorizedBy),
          },
        },
      ],
      { session },
    );
    const claimed = await Assignment.updateOne(
      {
        _id: assignment._id,
        status: "authorized",
        draftReportId: null,
        version: assignment.version,
      },
      { $set: { draftReportId: r._id }, $inc: { version: 1 } },
      { session },
    );
    if (!claimed.modifiedCount)
      throw new DomainError(409, "Assignment changed or already has a draft");
    result = r.toObject();
    await Audit.create(
      [
        {
          actorId: res.locals.user._id,
          entity: "reports",
          entityId: r._id,
          action: "draft_created",
          after: result,
          reason: input.reason,
        },
      ],
      { session },
    );
  });
  res.status(201).json(result);
});
workflowRouter.post("/reports/:id/action", async (req, res) => {
  allow(res.locals.user.roles, ["signatory", "manager"]);
  const id = objectId.parse(req.params.id);
  const input = z
    .object({
      action: z.enum(["revise", "withdraw"]),
      version: z.number().int().min(0),
      reason: z.string().trim().min(3).max(500),
    })
    .strict()
    .parse(req.body);
  let result: any;
  await mongoose.connection.transaction(async (session) => {
    const before: any = await Report.findOne({
      _id: id,
      version: input.version,
      status: "draft",
    })
      .session(session)
      .lean();
    if (!before)
      throw new DomainError(409, "Report changed or is no longer current");
    const changed = await Report.findOneAndUpdate(
      { _id: id, version: input.version, status: "draft" },
      {
        $set: {
          status: input.action === "revise" ? "superseded" : "withdrawn",
        },
        $inc: { version: 1 },
      },
      { new: true, session },
    ).lean();
    if (!changed) throw new DomainError(409, "Report changed");
    result = changed;
    if (input.action === "revise") {
      const assignment = await Assignment.findOne({
        _id: before.assignmentId,
        status: "authorized",
      }).session(session);
      if (!assignment)
        throw new DomainError(409, "Assignment is no longer authorized");
      const [revision] = await Report.create(
        [
          {
            number: before.number,
            assignmentId: before.assignmentId,
            revision: before.revision + 1,
            status: "draft",
            snapshot: before.snapshot,
            reason: input.reason,
          },
        ],
        { session },
      );
      result = revision.toObject();
    }
    const linked = await Assignment.updateOne(
      { _id: before.assignmentId, draftReportId: before._id },
      {
        $set: { draftReportId: input.action === "revise" ? result._id : null },
        $inc: { version: 1 },
      },
      { session },
    );
    if (!linked.modifiedCount)
      throw new DomainError(409, "Report is no longer the current draft");
    await Audit.create(
      [
        {
          actorId: res.locals.user._id,
          entity: "reports",
          entityId: id,
          action: input.action,
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
workflowRouter.get("/reports/:id/pdf", async (req, res) => {
  allow(res.locals.user.roles, ["admin", "manager", "reviewer", "signatory"]);
  const report: any = await Report.findById(
    objectId.parse(req.params.id),
  ).lean();
  if (!report) throw new DomainError(404, "Report not found");
  res
    .type("application/pdf")
    .set(
      "Content-Disposition",
      `attachment; filename="${report.number}-R${report.revision}-DRAFT.pdf"`,
    )
    .send(
      Buffer.from(
        await draftReportPdf({
          ...report,
          createdAt: new Date(report.createdAt).toISOString(),
        }),
      ),
    );
});
