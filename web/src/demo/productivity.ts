import { searchFields, fileAccess, type SearchKind } from "@lims/core";
import type { LabRecord } from "../lib/types";
export async function demoSearch(
  q: string,
  records: Record<string, LabRecord[]>,
  roles: string[],
  files: any,
) {
  if (q.length > 100) throw new Error("Search is too long");
  if (q.trim().length < 2) return { items: [] };
  q = q.trim().toLowerCase();
  const items: any[] = [];
  if (
    roles.some((r) =>
      [
        "admin",
        "manager",
        "reception",
        "technician",
        "reviewer",
        "signatory",
      ].includes(r),
    )
  )
    for (const kind of ["clients", "trfs", "samples", "assignments"] as const)
      for (const r of records[kind]
        .filter((r) =>
          searchFields[kind].some((k) =>
            String(r[k] ?? "")
              .toLowerCase()
              .includes(q),
          ),
        )
        .slice(0, 10))
        items.push({
          id: r._id,
          kind,
          label: String(r.number ?? r.name),
          detail: String(
            r.name ?? r.project ?? r.description ?? r.status ?? "",
          ),
          ...(r.clientId ? { clientId: String(r.clientId) } : {}),
        });
  if (
    ["general", "technical", "commercial", "report", "photo"].some((c) =>
      fileAccess(roles, c),
    )
  )
    for (const client of records.clients) {
      const result = await files.request(
        "/files/list?" + new URLSearchParams({ clientId: client._id, q }),
        "GET",
      );
      for (const r of result.items) {
        if (items.filter((i) => i.kind === "files").length >= 10) break;
        items.push({
          id: r._id,
          kind: "files",
          label: r.name,
          detail: r.description ?? "",
          clientId: r.clientId,
        });
      }
    }
  return { items, limitPerType: 10 };
}
