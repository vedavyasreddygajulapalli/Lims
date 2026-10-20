import { z } from "zod";
export const workflowAction = z
  .object({
    action: z.enum(["submit", "return", "review", "authorize", "reopen"]),
    version: z.number().int().min(0),
    reason: z.string().trim().min(3).max(500),
  })
  .strict();
export interface WorkflowActor {
  id: string;
  roles: string[];
  methodIds?: string[];
}
export interface WorkRecord {
  status: string;
  technicianId: string;
  methodId: string;
  reviewerId?: string | null;
  observations: Record<string, string>;
  version: number;
}
export function transition(
  record: WorkRecord,
  actor: WorkflowActor,
  raw: unknown,
) {
  const input = workflowAction.parse(raw);
  if (input.version !== record.version)
    throw new Error("Record changed. Reload before continuing.");
  const has = (role: string) => actor.roles.includes(role);
  let status: string;
  let reviewerId = record.reviewerId ?? null;
  let authorizedBy: string | null = null;
  switch (input.action) {
    case "submit":
      if (!has("technician") || actor.id !== record.technicianId)
        throw new Error("Only the assigned technician may submit");
      if (
        !["observations_draft", "returned"].includes(record.status) ||
        !Object.values(record.observations).some((v) => v.trim())
      )
        throw new Error("Save observations before submission");
      status = "awaiting_review";
      reviewerId = null;
      break;
    case "return":
      if (
        !has("reviewer") ||
        actor.id === record.technicianId ||
        record.status !== "awaiting_review"
      )
        throw new Error(
          "An independent reviewer must return a submitted record",
        );
      status = "returned";
      reviewerId = null;
      break;
    case "review":
      if (
        !has("reviewer") ||
        actor.id === record.technicianId ||
        record.status !== "awaiting_review"
      )
        throw new Error(
          "An independent reviewer must review a submitted record",
        );
      status = "reviewed";
      reviewerId = actor.id;
      break;
    case "authorize":
      if (
        !has("signatory") ||
        actor.id === record.technicianId ||
        actor.id === record.reviewerId ||
        record.status !== "reviewed"
      )
        throw new Error(
          "A separate signatory must authorize a reviewed record",
        );
      if (!actor.methodIds?.includes(record.methodId))
        throw new Error("Signatory is not authorized for this method");
      status = "authorized";
      authorizedBy = actor.id;
      break;
    case "reopen":
      if (
        !has("manager") ||
        !["awaiting_review", "reviewed", "authorized"].includes(record.status)
      )
        throw new Error(
          "Manager may reopen submitted, reviewed or authorized records",
        );
      status = "observations_draft";
      reviewerId = null;
      break;
  }
  return { status, reviewerId, authorizedBy, version: record.version + 1 };
}
export function requireVersion(expected: number, actual: number) {
  if (expected !== actual)
    throw new Error("Record changed. Reload before continuing.");
}
