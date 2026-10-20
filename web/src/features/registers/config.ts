import type { RegisterPage } from "../../lib/types";
export interface FieldConfig {
  key: string;
  label: string;
  type?: string;
  options?: string[];
  lookup?: string;
  hint?: string;
}
const materials = [
  "Soil",
  "Concrete",
  "Aggregates",
  "Road materials",
  "Cement",
  "Steel",
  "Water",
];
export const fields: Partial<Record<RegisterPage, FieldConfig[]>> = {
  clients: [
    { key: "name", label: "Client / company name" },
    { key: "contact", label: "Contact person" },
    { key: "email", label: "Email address", type: "email" },
    { key: "phone", label: "Phone number", type: "tel" },
    { key: "address", label: "Address" },
  ],
  trfs: [
    { key: "clientId", label: "Client", lookup: "clients" },
    { key: "project", label: "Project name" },
    { key: "site", label: "Project site" },
    { key: "requestedTests", label: "Requested tests" },
    { key: "dueDate", label: "Due date", type: "date" },
  ],
  samples: [
    { key: "trfId", label: "Test request", lookup: "trfs" },
    { key: "description", label: "Sample description" },
    { key: "material", label: "Material", options: materials },
    { key: "condition", label: "Condition on receipt" },
    { key: "storage", label: "Storage location" },
    {
      key: "receiptStatus",
      label: "Receipt decision",
      options: ["accepted", "quarantined", "rejected"],
    },
  ],
  assignments: [
    { key: "sampleId", label: "Accepted sample", lookup: "samples" },
    { key: "methodId", label: "Matching method", lookup: "methods" },
    { key: "technicianId", label: "Technician", lookup: "users" },
  ],
  users: [
    { key: "name", label: "Full name" },
    { key: "email", label: "Email address", type: "email" },
    {
      key: "password",
      label: "Temporary password",
      type: "password",
      hint: "At least 12 characters.",
    },
    {
      key: "roles",
      label: "Role",
      options: [
        "admin",
        "reception",
        "manager",
        "technician",
        "reviewer",
        "signatory",
        "accounts",
      ],
    },
  ],
};
export const columns: Record<RegisterPage, string[]> = {
  clients: ["number", "name", "contact", "email"],
  trfs: ["number", "project", "clientId", "dueDate"],
  samples: ["number", "description", "material", "receiptStatus"],
  assignments: ["number", "sampleId", "methodId", "technicianId", "status"],
  methods: ["material", "name", "version", "status"],
  audit: ["createdAt", "entity", "action", "reason"],
  users: ["name", "email", "roles"],
};
export const descriptions: Record<RegisterPage, string> = {
  clients: "Your client relationships, connected to every project and request.",
  trfs: "Keep project requirements and due dates in one clear register.",
  samples: "Track every sample from receipt through laboratory assignment.",
  assignments: "Connect accepted samples, methods and responsible technicians.",
  methods: "Keep your method sources, versions and validation status visible.",
  audit: "Trace record creation, observation changes and correction reasons.",
  users: "Manage the people and responsibilities in your laboratory.",
};
