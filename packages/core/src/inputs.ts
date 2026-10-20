import { z } from "zod";
export const roles = [
  "admin",
  "reception",
  "manager",
  "technician",
  "reviewer",
  "signatory",
  "accounts",
] as const;
export type Role = (typeof roles)[number];
const text = z.string().trim().min(1).max(300);
const id = z.string().regex(/^[a-f\d]{24}$/i, "Select a valid linked record");
export const clientInput = z
  .object({
    name: text,
    contact: text,
    email: z.string().email().max(254),
    phone: text,
    address: text,
  })
  .strict();
export const trfInput = z
  .object({
    clientId: id,
    project: text,
    site: text,
    requestedTests: text,
    dueDate: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/)
      .refine(
        (v) =>
          !isNaN(Date.parse(v)) && new Date(v).toISOString().slice(0, 10) === v,
        "Invalid date",
      ),
  })
  .strict();
export const sampleInput = z
  .object({
    trfId: id,
    description: text,
    material: z.enum([
      "Soil",
      "Concrete",
      "Aggregates",
      "Road materials",
      "Cement",
      "Steel",
      "Water",
    ]),
    condition: text,
    storage: text,
    receiptStatus: z.enum(["accepted", "quarantined", "rejected"]),
  })
  .strict();
export const assignmentInput = z
  .object({ sampleId: id, methodId: id, technicianId: id })
  .strict();
export const observationInput = z
  .object({
    version: z.number().int().min(0),
    observations: z
      .record(
        z.string().regex(/^[a-zA-Z][a-zA-Z0-9_]{0,63}$/),
        z.string().max(200),
      )
      .refine((v) => Object.keys(v).length > 0 && Object.keys(v).length <= 100),
    reason: text,
  })
  .strict();

export const userCreateInput = z
  .object({
    name: z.string().trim().min(1).max(100),
    email: z.string().email().max(254),
    password: z.string().min(12).max(128),
    roles: z.array(z.enum(roles)).min(1),
  })
  .strict();
export const userAccessInput = z
  .object({
    version: z.number().int().min(0),
    roles: z.array(z.enum(roles)).min(1),
    active: z.boolean(),
    methodIds: z
      .array(id)
      .max(100)
      .refine((v) => new Set(v).size === v.length, "Duplicate methods"),
    reason: z.string().trim().min(3).max(500),
  })
  .strict();
