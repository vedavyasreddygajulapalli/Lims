import { z } from "zod";
export const clientSectionRoles = {
  trfs: [
    "admin",
    "manager",
    "reception",
    "technician",
    "reviewer",
    "signatory",
  ],
  samples: [
    "admin",
    "manager",
    "reception",
    "technician",
    "reviewer",
    "signatory",
  ],
  assignments: [
    "admin",
    "manager",
    "reception",
    "technician",
    "reviewer",
    "signatory",
  ],
  reports: ["admin", "manager", "reviewer", "signatory"],
  consolidated: ["admin", "manager", "reviewer", "signatory"],
  billing: ["admin", "accounts"],
  quality: ["admin", "manager", "reviewer"],
  files: ["admin", "manager", "reception", "reviewer", "signatory", "accounts"],
} as const;
export type ClientSection = keyof typeof clientSectionRoles;
export function clientSections(roles: readonly string[]): ClientSection[] {
  return (Object.keys(clientSectionRoles) as ClientSection[]).filter((k) =>
    roles.some((r) => (clientSectionRoles[k] as readonly string[]).includes(r)),
  );
}
export const clientRecordsQuery = z
  .object({
    section: z.enum([
      "trfs",
      "samples",
      "assignments",
      "reports",
      "consolidated",
      "billing",
      "quality",
    ]),
    page: z.coerce.number().int().min(1).max(100000).default(1),
    q: z.string().trim().max(100).default(""),
  })
  .strict();
