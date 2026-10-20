import {
  LayoutDashboard,
  Users,
  ClipboardList,
  Package,
  Microscope,
  BookOpen,
  ShieldCheck,
  Calculator,
} from "lucide-react";
import type { Page, User } from "../lib/types";
export const navigation = [
  {
    id: "overview",
    label: "Overview",
    icon: LayoutDashboard,
    group: "WORKSPACE",
  },
  { id: "clients", label: "Clients", icon: Users },
  { id: "trfs", label: "Test requests", icon: ClipboardList },
  { id: "samples", label: "Sample register", icon: Package },
  { id: "assignments", label: "Test assignments", icon: Microscope },
  { id: "review", label: "Review queue", icon: ShieldCheck },
  { id: "reports", label: "Draft reports", icon: ClipboardList },
  {
    id: "methods",
    label: "Method catalogue",
    icon: BookOpen,
    group: "QUALITY & METHODS",
  },
  { id: "equipment", label: "Equipment", icon: Microscope },
  { id: "quality", label: "Quality cases", icon: ShieldCheck },
  { id: "documents", label: "Document register", icon: BookOpen },
  { id: "reference", label: "Reference calculator", icon: Calculator },
  { id: "audit", label: "Audit history", icon: ShieldCheck },
  { id: "users", label: "Team & access", icon: Users, group: "ADMINISTRATION" },
  { id: "billing", label: "Billing ledger", icon: ClipboardList },
  { id: "settings", label: "Account & readiness", icon: Users },
] as const;
export const titles: Record<Page, string> = {
  review: "Review queue",
  reports: "Draft reports",
  equipment: "Equipment",
  quality: "Quality cases",
  billing: "Billing ledger",
  documents: "Document register",
  settings: "Account & readiness",
  overview: "Laboratory overview",
  clients: "Clients",
  trfs: "Test requests",
  samples: "Sample register",
  assignments: "Test assignments",
  methods: "Method catalogue",
  reference: "Reference calculator",
  audit: "Audit history",
  users: "Team & access",
};
export function canView(page: Page, user: User) {
  if (page === "settings") return true;
  const operationAccess: Record<string, string[]> = {
    review: ["admin", "manager", "technician", "reviewer", "signatory"],
    reports: ["admin", "manager", "reviewer", "signatory"],
    equipment: ["admin", "manager", "technician", "reviewer", "signatory"],
    quality: ["admin", "manager", "reviewer"],
    billing: ["admin", "accounts"],
    documents: ["admin", "manager", "reviewer"],
  };
  if (operationAccess[page])
    return user.roles.some((r) => operationAccess[page].includes(r));
  if (user.roles.every((r) => r === "accounts")) return false;
  const allowed =
    page === "users"
      ? ["admin", "manager"]
      : page === "audit"
        ? ["admin", "manager", "reviewer"]
        : page === "reference"
          ? ["admin", "manager", "technician", "reviewer", "signatory"]
          : null;
  return !allowed || user.roles.some((r) => allowed.includes(r));
}
export function canCreate(page: Page, user: User) {
  const roles =
    page === "users"
      ? ["admin"]
      : page === "assignments"
        ? ["admin", "manager"]
        : ["clients", "trfs", "samples"].includes(page)
          ? ["admin", "manager", "reception"]
          : [];
  return user.roles.some((r) => roles.includes(r));
}
