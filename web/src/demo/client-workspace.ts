import {
  clientSections,
  clientRecordsQuery,
  type ClientSection,
} from "@lims/core";
import type { LabRecord } from "../lib/types";
export async function demoClientWorkspace(
  path: string,
  records: Record<string, LabRecord[]>,
  roles: string[],
  populate: (r: LabRecord) => LabRecord,
  files: any,
) {
  const u = new URL(path, "http://demo.local"),
    id = u.pathname.split("/")[2];
  if (
    !roles.some((r) =>
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
    throw new Error("Access denied");
  const client = records.clients.find((c) => c._id === id);
  if (!client) throw new Error("Client not found");
  const trfs = records.trfs.filter((r) => r.clientId === id),
    samples = records.samples.filter((r) =>
      trfs.some((t) => t._id === r.trfId),
    ),
    assignments = records.assignments.filter((r) =>
      samples.some((s) => s._id === r.sampleId),
    );
  const groups: Record<string, LabRecord[]> = {
    trfs,
    samples,
    assignments,
    reports: records.reports.filter((r) =>
      assignments.some((a) => a._id === r.assignmentId),
    ),
    consolidated: records.consolidated.filter((r) =>
      trfs.some((t) => t._id === r.trfId),
    ),
    billing: records.billing.filter((r) => r.clientId === id),
    quality: records.quality.filter((r) =>
      samples.some((s) => s._id === r.sampleId),
    ),
  };
  const sections = clientSections(roles);
  const sorted = (rows: LabRecord[]) =>
    [...rows].sort(
      (a, b) =>
        String(b.createdAt).localeCompare(String(a.createdAt)) ||
        b._id.localeCompare(a._id),
    );
  if (u.pathname.endsWith("/activity")) {
    const page = clientRecordsQuery.shape.page.parse(
      u.searchParams.get("page") ?? 1,
    );
    const allowed = new Set<string>([id]);
    for (const section of sections) {
      if (section === "files") {
        const folders = await files.request("/files/folders/" + id, "GET");
        folders.forEach((f: any) => allowed.add(f._id));
        for (const archived of ["false", "true"]) {
          let p = 1;
          while (true) {
            const r = await files.request(
              "/files/list?" +
                new URLSearchParams({
                  clientId: id,
                  archived,
                  page: String(p),
                }),
              "GET",
            );
            r.items.forEach((f: any) => allowed.add(f._id));
            if (p * 50 >= r.total) break;
            p++;
          }
        }
      } else groups[section].forEach((r) => allowed.add(r._id));
    }
    const entries = sorted(
      records.audit.filter(
        (a) =>
          allowed.has(String(a.entityId)) &&
          (a.entity === "clients" ||
            sections.includes(a.entity as ClientSection)),
      ),
    );
    return {
      items: entries.slice((page - 1) * 50, page * 50).map((a) => ({
        _id: a._id,
        action: a.action,
        entity: a.entity,
        createdAt: a.createdAt,
        actorId: {
          name:
            records.users.find((u) => u._id === a.actorId)?.name ??
            "Team member",
        },
      })),
      total: entries.length,
      page,
    };
  }
  if (u.pathname.endsWith("/records")) {
    const { section, page, q } = clientRecordsQuery.parse(
      Object.fromEntries(u.searchParams),
    );
    if (!sections.includes(section))
      throw new Error("Your role cannot view this client section");
    const fields: Record<string, string[]> = {
      trfs: ["number", "project", "site"],
      samples: ["number", "description", "material"],
      assignments: ["number", "status"],
      reports: ["number", "status"],
      consolidated: ["number", "status"],
      billing: ["number", "description", "status"],
      quality: ["number", "title", "status"],
    };
    const rows = sorted(groups[section]).filter(
      (r) =>
        fields[section].some((k) =>
          String(r[k] ?? "")
            .toLowerCase()
            .includes(q.toLowerCase()),
        ) ||
        (section === "consolidated" &&
          String((r.snapshot as any)?.title ?? "")
            .toLowerCase()
            .includes(q.toLowerCase())),
    );
    return {
      items: rows.slice((page - 1) * 50, page * 50).map(populate),
      total: rows.length,
      page,
    };
  }
  const counts: Partial<Record<ClientSection, number>> = {};
  for (const s of sections)
    counts[s] =
      s === "files"
        ? (await files.request("/files/list?clientId=" + id, "GET")).total
        : groups[s].length;
  const chargedMinor = groups.billing.reduce(
      (n, r) => n + Number(r.amountMinor),
      0,
    ),
    paidMinor = groups.billing.reduce((n, r) => n + Number(r.paidMinor), 0);
  return {
    client,
    sections,
    counts,
    recentRequests: sorted(trfs).slice(0, 5).map(populate),
    attention: {
      awaitingReview: assignments.filter((r) => r.status === "awaiting_review")
        .length,
      quarantined: samples.filter((r) => r.receiptStatus === "quarantined")
        .length,
    },
    ...(sections.includes("billing")
      ? {
          billing: {
            chargedMinor,
            paidMinor,
            balanceMinor: chargedMinor - paidMinor,
          },
        }
      : {}),
  };
}
