import { z } from "zod";
const text = z.string().trim().min(1).max(500);
const optional = z.string().trim().max(1000).default("");
export const objectId = z.string().regex(/^[a-f0-9]{24}$/i);
export const date = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/)
  .refine(
    (v) =>
      !isNaN(Date.parse(v)) && new Date(v).toISOString().slice(0, 10) === v,
    "Enter a valid date",
  );
export const equipmentInput = z
  .object({
    name: text,
    serial: text,
    location: text,
    calibrationDue: date,
    status: z.enum(["active", "maintenance", "retired"]),
    certificateReference: optional,
  })
  .strict();
export const qualityInput = z
  .object({
    title: text,
    type: z.enum(["complaint", "nonconformity", "capa"]),
    sampleId: z.union([objectId, z.literal("")]).default(""),
    owner: text,
    dueDate: date,
    status: z.enum(["open", "investigating", "action_taken", "closed"]),
    description: text,
    rootCause: optional,
    correction: optional,
    correctiveAction: optional,
    effectiveness: optional,
  })
  .strict()
  .superRefine((v, ctx) => {
    if (
      v.status === "closed" &&
      [v.rootCause, v.correction, v.correctiveAction, v.effectiveness].some(
        (s) => !s,
      )
    )
      ctx.addIssue({
        code: "custom",
        message:
          "Closure requires root cause, correction, corrective action and effectiveness evidence",
      });
  });
export const billingInput = z
  .object({
    clientId: objectId,
    description: text,
    amountMinor: z.number().int().positive().max(100000000000),
    dueDate: date,
  })
  .strict();
export const documentInput = z
  .object({
    title: text,
    reference: text,
    revision: text,
    owner: text,
    reviewDue: date,
    status: z.enum(["draft", "controlled", "obsolete"]),
    location: text,
  })
  .strict();
export const paymentInput = z
  .object({
    version: z.number().int().min(0),
    amountMinor: z.number().int().positive(),
    reference: text,
    date: date,
  })
  .strict();
export const operationSchemas = {
  equipment: equipmentInput,
  quality: qualityInput,
  billing: billingInput,
  documents: documentInput,
};
export type OperationName = keyof typeof operationSchemas;
export const operationRoles: Record<OperationName, string[]> = {
  equipment: ["admin", "manager"],
  quality: ["admin", "manager", "reviewer"],
  billing: ["admin", "accounts"],
  documents: ["admin", "manager", "reviewer"],
};
export function recordPayment(total: number, paid: number, amount: number) {
  if (!Number.isSafeInteger(amount) || amount <= 0 || paid + amount > total)
    throw new Error(
      "Payment must be positive and cannot exceed the outstanding balance",
    );
  return {
    paidMinor: paid + amount,
    status: paid + amount === total ? "paid" : "part_paid",
  };
}
export function amountToMinor(value: string) {
  if (!/^(0|[1-9]\d{0,8})(\.\d{1,2})?$/.test(value))
    throw new Error("Enter an amount with at most two decimal places");
  const [a, b = ""] = value.split(".");
  return Number(a) * 100 + Number(b.padEnd(2, "0"));
}
export function equipmentUsable(
  e: { status: string; calibrationDue: string },
  today = new Date().toISOString().slice(0, 10),
) {
  return e.status === "active" && e.calibrationDue >= today;
}
