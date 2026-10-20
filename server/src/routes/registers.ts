import { Router } from "express";
import mongoose from "mongoose";
import { z } from "zod";
import { Method, collections } from "../models.js";
import {
  permissions,
  allow,
  DomainError,
  clientInput,
  trfInput,
  sampleInput,
  assignmentInput,
} from "../domain.js";
import { escapeRegex } from "../services/search.js";
import { createRecord } from "../services/registers.js";
export const registersRouter = Router();
const router = registersRouter;
const readRoles = [
  "admin",
  "reception",
  "manager",
  "technician",
  "reviewer",
  "signatory",
];
router.get("/methods", async (_req, res) => {
  allow(res.locals.user.roles, readRoles);
  res.json(await Method.find().sort({ material: 1 }).lean());
});
for (const [entity, Model] of Object.entries(collections)) {
  router.get(`/${entity}`, async (req, res) => {
    allow(res.locals.user.roles, readRoles);
    const page = z.coerce
      .number()
      .int()
      .min(1)
      .max(100000)
      .parse(req.query.page ?? 1);
    const q = z
      .string()
      .max(100)
      .parse(req.query.q ?? "");
    const fields = (
      {
        clients: ["number", "name", "contact", "email"],
        trfs: ["number", "project", "site"],
        samples: ["number", "description", "material"],
        assignments: ["number", "status"],
      } as Record<string, string[]>
    )[entity];
    const escaped = escapeRegex(q);
    const filter = q
      ? {
          $or: fields.map((field) => ({
            [field]: { $regex: escaped, $options: "i" },
          })),
        }
      : {};
    res.json({
      items: await Model.find(filter)
        .populate(
          (
            {
              trfs: "clientId",
              samples: "trfId",
              assignments: "sampleId methodId technicianId",
            } as Record<string, string>
          )[entity] ?? "",
        )
        .sort({ createdAt: -1, _id: -1 })
        .skip((page - 1) * 50)
        .limit(50)
        .lean(),
      total: await Model.countDocuments(filter),
      page,
    });
  });
  router.get(`/${entity}/:id`, async (req, res) => {
    allow(res.locals.user.roles, readRoles);
    if (!mongoose.isValidObjectId(req.params.id))
      throw new DomainError(400, "Invalid record ID");
    const record = await Model.findById(req.params.id)
      .populate(
        (
          {
            trfs: "clientId",
            samples: "trfId",
            assignments: "sampleId methodId technicianId",
          } as Record<string, string>
        )[entity] ?? "",
      )
      .lean();
    if (!record) throw new DomainError(404, "Record not found");
    res.json(record);
  });
  router.post(`/${entity}`, async (req, res) => {
    allow(res.locals.user.roles, permissions[entity]);
    const input = (
      {
        clients: clientInput,
        trfs: trfInput,
        samples: sampleInput,
        assignments: assignmentInput,
      } as any
    )[entity].parse(req.body);
    const result = await createRecord(
      entity as keyof typeof collections,
      input,
      res.locals.user._id,
    );
    res.status(201).json(result);
  });
}
