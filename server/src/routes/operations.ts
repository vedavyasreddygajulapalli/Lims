import { Router } from "express";
import mongoose from "mongoose";
import { z } from "zod";
import {
  operationSchemas,
  operationRoles,
  objectId,
  paymentInput,
  recordPayment,
  type OperationName,
} from "@lims/core";
import {
  operationModels,
  Client,
  Sample,
  Audit,
  nextNumber,
} from "../models.js";
import { allow, DomainError } from "../domain.js";
export const operationsRouter = Router();
operationsRouter.get("/billing-clients", async (_req, res) => {
  allow(res.locals.user.roles, operationRoles.billing);
  res.json(
    await Client.find()
      .select("number name")
      .sort({ name: 1 })
      .limit(200)
      .lean(),
  );
});
operationsRouter.get("/sample-options", async (_req, res) => {
  allow(res.locals.user.roles, [
    "admin",
    "manager",
    "reviewer",
    "technician",
    "signatory",
  ]);
  res.json(
    await Sample.find()
      .select("number description")
      .sort({ createdAt: -1 })
      .limit(200)
      .lean(),
  );
});
for (const entity of Object.keys(operationModels) as OperationName[]) {
  const Model = operationModels[entity];
  const roles = operationRoles[entity];
  operationsRouter.get("/" + entity, async (_req, res) => {
    allow(
      res.locals.user.roles,
      entity === "equipment"
        ? ["admin", "manager", "technician", "reviewer", "signatory"]
        : roles,
    );
    res.json(await Model.find().sort({ createdAt: -1 }).limit(200).lean());
  });
  operationsRouter.post("/" + entity, async (req, res) => {
    allow(res.locals.user.roles, roles);
    const input = operationSchemas[entity].parse(req.body);
    let result: any;
    await mongoose.connection.transaction(async (session) => {
      if (
        "clientId" in input &&
        !(await Client.exists({ _id: input.clientId }).session(session))
      )
        throw new DomainError(422, "Client not found");
      if (
        "sampleId" in input &&
        input.sampleId &&
        !(await Sample.exists({ _id: input.sampleId }).session(session))
      )
        throw new DomainError(422, "Sample not found");
      const [r] = await Model.create(
        [
          {
            ...input,
            number: await nextNumber(
              {
                equipment: "EQP",
                quality: "QLT",
                billing: "BIL",
                documents: "DOC",
              }[entity],
              session,
            ),
          },
        ],
        { session },
      );
      result = r.toObject();
      await Audit.create(
        [
          {
            actorId: res.locals.user._id,
            entity,
            entityId: r._id,
            action: "create",
            after: result,
          },
        ],
        { session },
      );
    });
    res.status(201).json(result);
  });
  operationsRouter.patch("/" + entity + "/:id", async (req, res) => {
    allow(res.locals.user.roles, roles);
    if (entity === "billing")
      throw new DomainError(
        409,
        "Billing entries are immutable; record payments separately",
      );
    const id = objectId.parse(req.params.id);
    const envelope = z
      .object({
        version: z.number().int().min(0),
        reason: z.string().trim().min(3).max(500),
        data: z.unknown(),
      })
      .strict()
      .parse(req.body);
    const data = operationSchemas[entity].parse(envelope.data);
    let result: any;
    await mongoose.connection.transaction(async (session) => {
      if (
        "sampleId" in data &&
        data.sampleId &&
        !(await Sample.exists({ _id: data.sampleId }).session(session))
      )
        throw new DomainError(422, "Sample not found");
      const before = await Model.findById(id).session(session).lean();
      result = await Model.findOneAndUpdate(
        { _id: id, version: envelope.version },
        { $set: data, $inc: { version: 1 } },
        { new: true, session, runValidators: true },
      ).lean();
      if (!result) throw new DomainError(409, "Record changed. Reload.");
      await Audit.create(
        [
          {
            actorId: res.locals.user._id,
            entity,
            entityId: id,
            action: "update",
            before,
            after: result,
            reason: envelope.reason,
          },
        ],
        { session },
      );
    });
    res.json(result);
  });
}
operationsRouter.post("/billing/:id/payments", async (req, res) => {
  allow(res.locals.user.roles, operationRoles.billing);
  const id = objectId.parse(req.params.id);
  const input = paymentInput.parse(req.body);
  let result: any;
  await mongoose.connection.transaction(async (session) => {
    const before: any = await operationModels.billing
      .findOne({ _id: id, version: input.version })
      .session(session)
      .lean();
    if (!before) throw new DomainError(409, "Billing record changed");
    let payment;
    try {
      payment = recordPayment(
        before.amountMinor,
        before.paidMinor,
        input.amountMinor,
      );
    } catch (e) {
      throw new DomainError(422, (e as Error).message);
    }
    result = await operationModels.billing
      .findOneAndUpdate(
        { _id: id, version: input.version },
        {
          $set: payment,
          $push: {
            payments: { ...input, actorId: String(res.locals.user._id) },
          },
          $inc: { version: 1 },
        },
        { new: true, session },
      )
      .lean();
    if (!result) throw new DomainError(409, "Billing record changed");
    await Audit.create(
      [
        {
          actorId: res.locals.user._id,
          entity: "billing",
          entityId: id,
          action: "payment_recorded",
          before,
          after: result,
          reason: input.reference,
        },
      ],
      { session },
    );
  });
  res.json(result);
});
