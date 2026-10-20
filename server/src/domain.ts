import { type Role } from "@lims/core";
export {
  roles,
  clientInput,
  trfInput,
  sampleInput,
  assignmentInput,
  observationInput,
} from "@lims/core";
export type { Role } from "@lims/core";
export class DomainError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}
export const permissions: Record<string, readonly Role[]> = {
  clients: ["admin", "reception", "manager"],
  trfs: ["admin", "reception", "manager"],
  samples: ["admin", "reception", "manager"],
  assignments: ["admin", "manager"],
};
export function allow(actual: readonly string[], allowed: readonly string[]) {
  if (!actual.some((r) => allowed.includes(r)))
    throw new DomainError(403, "You do not have permission for this action");
}
export function assertLink(found: unknown, label: string): asserts found {
  if (!found) throw new DomainError(422, `${label} does not exist`);
}
export function assertSampleAssignable(status: string) {
  if (status !== "accepted")
    throw new DomainError(409, "Only accepted samples can be assigned");
}
export function assertVersion(expected: number, actual: number) {
  if (expected !== actual)
    throw new DomainError(409, "Record changed. Reload before editing.");
}
export function calculate(): never {
  throw new DomainError(
    409,
    "Calculation unavailable: original source sheet, exact formula mapping and laboratory validation are required.",
  );
}
