import type { ReportAppendix } from "./files.js";
import { z } from "zod";
import { objectId } from "./operations.js";
export const REPORT_TEMPLATE = {
  id: "sainath-consolidated",
  version: "1.0",
  name: "Sainath Signature",
  laboratory: "SRI SAINATH LABORATORY",
} as const;
export const consolidatedInput = z
  .object({
    appendixIds: z
      .array(objectId)
      .max(10)
      .default([])
      .refine((v) => new Set(v).size === v.length, "Duplicate appendix"),
    trfId: objectId,
    title: z.string().trim().min(3).max(100),
    summary: z.string().trim().max(1500).default(""),
    reason: z.string().trim().min(3).max(500),
    selections: z
      .array(
        z.object({ id: objectId, version: z.number().int().min(0) }).strict(),
      )
      .min(1)
      .max(30)
      .refine(
        (v) => new Set(v.map((x) => x.id)).size === v.length,
        "Select each test only once",
      ),
    sourceId: objectId.optional(),
    sourceVersion: z.number().int().min(0).optional(),
  })
  .strict()
  .superRefine((v, c) => {
    if (Boolean(v.sourceId) !== (v.sourceVersion !== undefined))
      c.addIssue({
        code: "custom",
        message: "Revision requires both source ID and version",
      });
  });
export interface ConsolidatedTest {
  id: string;
  version: number;
  assignmentNumber: string;
  sampleId: string;
  sampleNumber: string;
  description: string;
  material: string;
  condition: string;
  storage: string;
  receiptStatus: string;
  method: string;
  methodVersion: string;
  status: string;
  observations: Record<string, string>;
  technician: string;
  reviewer: string;
  signatory: string;
  equipment: string;
}
export interface ConsolidatedSnapshot {
  appendices?: ReportAppendix[];
  template: typeof REPORT_TEMPLATE;
  title: string;
  summary: string;
  client: {
    name: string;
    contact: string;
    email: string;
    phone: string;
    address: string;
  };
  request: {
    id: string;
    number: string;
    project: string;
    site: string;
    dueDate: string;
    requestedTests: string;
  };
  tests: ConsolidatedTest[];
  preparedBy: string;
  capturedAt: string;
}
export interface ConsolidatedReport {
  number: string;
  revision: number;
  status: string;
  reason: string;
  snapshot: ConsolidatedSnapshot;
}
export function captureConsolidated(
  input: unknown,
  context: {
    client: ConsolidatedSnapshot["client"];
    request: ConsolidatedSnapshot["request"];
    tests: ConsolidatedTest[];
    preparedBy: string;
    capturedAt: string;
  },
): ConsolidatedSnapshot {
  const v = consolidatedInput.parse(input);
  if (context.request.id !== v.trfId)
    throw new Error("Selected request does not match");
  const tests = v.selections.map((s) => {
    const t = context.tests.find((t) => t.id === s.id);
    if (!t) throw new Error("Every selected test must belong to this request");
    if (t.version !== s.version)
      throw new Error("A selected test changed. Refresh the selection.");
    return t;
  });
  return structuredClone({
    template: REPORT_TEMPLATE,
    title: v.title,
    summary: v.summary,
    client: context.client,
    request: context.request,
    tests,
    preparedBy: context.preparedBy,
    capturedAt: context.capturedAt,
  });
}
export function consolidatedCounts(s: ConsolidatedSnapshot) {
  return {
    tests: s.tests.length,
    samples: new Set(s.tests.map((t) => t.sampleId)).size,
    authorized: s.tests.filter((t) => t.status === "authorized").length,
    missingObservations: s.tests.filter(
      (t) => !Object.values(t.observations).some((v) => v.trim()),
    ).length,
  };
}
