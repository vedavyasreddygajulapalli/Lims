export type Page =
  | "overview"
  | "clients"
  | "trfs"
  | "samples"
  | "assignments"
  | "methods"
  | "reference"
  | "audit"
  | "users"
  | "review"
  | "reports"
  | "equipment"
  | "quality"
  | "billing"
  | "documents"
  | "settings";
export type RegisterPage = Exclude<
  Page,
  | "overview"
  | "reference"
  | "review"
  | "reports"
  | "equipment"
  | "quality"
  | "billing"
  | "documents"
  | "settings"
>;
export interface User {
  id: string;
  name: string;
  roles: string[];
  methodIds?: string[];
}
export interface LabRecord {
  _id: string;
  [key: string]: unknown;
}
export interface PageResult {
  items: LabRecord[];
  total: number;
  page: number;
}
export const idOf = (value: unknown): string =>
  typeof value === "string"
    ? value
    : typeof value === "object" && value !== null && "_id" in value
      ? String(value._id)
      : "";
export const recordLabel = (value: unknown): string => {
  if (value == null) return "—";
  if (Array.isArray(value)) return value.join(", ");
  if (typeof value === "object") {
    const v = value as Record<string, unknown>;
    return (
      [v.number, v.name ?? v.project ?? v.description]
        .filter(Boolean)
        .join(" · ") || "Linked record"
    );
  }
  return String(value);
};
export const pretty = (s: string) =>
  s
    .replace(/Id$/, "")
    .replace(/([A-Z])/g, " $1")
    .replaceAll("_", " ")
    .replace(/^./, (s) => s.toUpperCase());
