import { z } from "zod";
import { objectId } from "./operations.js";
export const MAX_FILE_BYTES = 24_000_000;
export const FILE_BUDGET_BYTES = 900_000_000;
export const fileKinds = {
  pdf: "application/pdf",
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  webp: "image/webp",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
} as const;
export const fileCategories = [
  "general",
  "technical",
  "commercial",
  "report",
  "photo",
] as const;
export const fileSources = ["client", "laboratory"] as const;
export const fileName = z
  .string()
  .trim()
  .min(1)
  .max(150)
  .refine(
    (s) => !/[\\/\x00-\x1f\x7f]/.test(s) && s !== "." && s !== "..",
    "Use a name without slashes or control characters",
  );
export const folderInput = z
  .object({
    clientId: objectId,
    parentId: objectId.nullable().default(null),
    name: fileName,
  })
  .strict();
export const fileMetadata = z
  .object({
    clientId: objectId,
    folderId: objectId.nullable().default(null),
    name: fileName,
    description: z.string().trim().max(1000).default(""),
    category: z.enum(fileCategories).default("general"),
    source: z.enum(fileSources).default("client"),
    visibility: z.enum(["internal", "report_eligible"]).default("internal"),
    trfId: objectId.nullable().default(null),
    sampleId: objectId.nullable().default(null),
  })
  .strict();
export const fileUploadInput = fileMetadata
  .extend({
    size: z.number().int().min(1).max(MAX_FILE_BYTES),
    sha256: z.string().regex(/^[a-f0-9]{64}$/),
    requestKey: z.string().uuid(),
    duplicate: z.enum(["skip", "keep"]).default("skip"),
    assetId: objectId.optional(),
    assetVersion: z.number().int().min(0).optional(),
    reason: z.string().trim().min(3).max(500),
  })
  .superRefine((v, c) => {
    if (Boolean(v.assetId) !== (v.assetVersion !== undefined))
      c.addIssue({
        code: "custom",
        message: "Replacement requires the current file version",
      });
    if (!fileMime(v.name))
      c.addIssue({
        code: "custom",
        message: "Allowed files: PDF, PNG, JPG, WEBP, DOCX and XLSX",
      });
    if (v.sampleId && !v.trfId)
      c.addIssue({
        code: "custom",
        message: "A sample must have a linked test request",
      });
  });
export function fileMime(name: string) {
  return fileKinds[
    name.toLowerCase().split(".").pop() as keyof typeof fileKinds
  ];
}
export function fileAccess(roles: string[], category: string, write = false) {
  if (roles.some((r) => ["admin", "manager"].includes(r))) return true;
  if (category === "commercial")
    return roles.some((r) => ["accounts", "reception"].includes(r));
  return roles.some((r) =>
    (write ? ["reception"] : ["reception", "reviewer", "signatory"]).includes(
      r,
    ),
  );
}
export function canManageFiles(roles: string[]) {
  return roles.some((r) =>
    ["admin", "manager", "reception", "accounts"].includes(r),
  );
}
export function folderPath(
  folders: { _id: string; parentId: string | null; name: string }[],
  id: string | null,
) {
  const parts: string[] = [];
  const seen = new Set<string>();
  while (id) {
    if (seen.has(id)) throw new Error("Folder cycle");
    seen.add(id);
    const f = folders.find((f) => f._id === id);
    if (!f) throw new Error("Folder is missing");
    parts.unshift(f.name);
    id = f.parentId;
  }
  return parts.join("/");
}
export interface FileRevision {
  _id: string;
  assetId: string;
  revision: number;
  name: string;
  mime: string;
  size: number;
  sha256: string;
  status: string;
  uploadedBy: string;
  createdAt: string;
  reason: string;
}
export interface ClientFile {
  _id: string;
  clientId: string;
  folderId: string | null;
  name: string;
  description: string;
  category: string;
  source: string;
  visibility: string;
  trfId: string | null;
  sampleId: string | null;
  archived: boolean;
  version: number;
  currentId: string | null;
  current?: FileRevision;
  createdAt: string;
  updatedAt: string;
}
export interface ClientFolder {
  _id: string;
  clientId: string;
  parentId: string | null;
  name: string;
  version: number;
}
export interface ReportAppendix {
  versionId: string;
  assetId: string;
  name: string;
  mime: string;
  size: number;
  sha256: string;
  revision: number;
}
