export const searchFields = {
  clients: ["number", "name", "contact", "email"],
  trfs: ["number", "project", "site"],
  samples: ["number", "description", "material"],
  assignments: ["number", "status"],
  files: ["name", "description"],
} as const;
export type SearchKind = keyof typeof searchFields;
export interface SearchHit {
  id: string;
  kind: SearchKind;
  label: string;
  detail: string;
  clientId?: string;
}
export function nextStep(status: string) {
  return (
    (
      {
        assigned: "Enter observations",
        observations_draft: "Complete observations and submit",
        returned: "Correct observations and resubmit",
        awaiting_review: "Awaiting independent review",
        reviewed: "Awaiting signatory authorization",
        authorized: "Prepare a draft report",
      } as Record<string, string>
    )[status] ?? "View record history"
  );
}
