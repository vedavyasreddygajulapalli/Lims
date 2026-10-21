import { createDemoFiles } from "./files";
import { appendReportFiles } from "@lims/core";
import {
  consolidatedInput,
  captureConsolidated,
  consolidatedPdf,
  type ConsolidatedReport,
  transition,
  operationSchemas,
  operationRoles,
  paymentInput,
  recordPayment,
  equipmentUsable,
  requireVersion,
  draftReportPdf,
  type OperationName,
  type WorkRecord,
  type DraftReport,
  userCreateInput,
  userAccessInput,
  referenceSource,
  referenceStrength,
  verifyReference,
  summarizeDashboard,
  clientInput,
  trfInput,
  sampleInput,
  assignmentInput,
  observationInput,
} from "@lims/core";
import { makeFixtures, demoUser } from "./fixtures";
import { ApiError } from "../lib/client";
import type { LabRecord } from "../lib/types";
let records = makeFixtures();
let nextId = 1000;
let actor = { ...demoUser };
const fileStore = () =>
  createDemoFiles(
    () => records,
    () => actor,
    (id, action, detail) =>
      records.audit.push({
        _id: (++nextId).toString(16).padStart(24, "0"),
        entity: "files",
        entityId: id,
        action,
        after: detail,
        actorId: actor.id,
        createdAt: new Date().toISOString(),
      }),
  );
let files = fileStore();
export function resetDemo() {
  records = makeFixtures();
  nextId = 1000;
  actor = { ...demoUser };
  files = fileStore();
}
const relations: Record<string, string> = {
  clientId: "clients",
  trfId: "trfs",
  sampleId: "samples",
  methodId: "methods",
  technicianId: "users",
  reviewerId: "users",
  authorizedBy: "users",
  equipmentId: "equipment",
};
function populate(row: LabRecord) {
  return Object.fromEntries(
    Object.entries(row).map(([key, value]) => [
      key,
      relations[key]
        ? (records[relations[key]].find((r) => r._id === value) ?? value)
        : value,
    ]),
  ) as LabRecord;
}
function bundleContext(trfId: string) {
  const trf = records.trfs.find((r) => r._id === trfId);
  if (!trf) throw new Error("Test request not found");
  const client = records.clients.find((r) => r._id === trf.clientId)!;
  const samples = records.samples.filter((s) => s.trfId === trfId);
  const person = (id: unknown) =>
    String(records.users.find((r) => r._id === id)?.name ?? "");
  const tests = records.assignments
    .filter((a) => samples.some((s) => s._id === a.sampleId))
    .map((a) => {
      const sample = samples.find((s) => s._id === a.sampleId)!;
      const method = records.methods.find((m) => m._id === a.methodId)!;
      const eq = records.equipment.find((e) => e._id === a.equipmentId);
      return {
        id: a._id,
        version: Number(a.version),
        assignmentNumber: String(a.number),
        sampleId: sample._id,
        sampleNumber: String(sample.number),
        description: String(sample.description),
        material: String(sample.material),
        condition: String(sample.condition),
        storage: String(sample.storage),
        receiptStatus: String(sample.receiptStatus),
        method: String(method.name),
        methodVersion: String(method.version),
        status: String(a.status),
        observations: a.observations as Record<string, string>,
        technician: person(a.technicianId),
        reviewer: person(a.reviewerId),
        signatory: person(a.authorizedBy),
        equipment: eq ? String(eq.number) + " / " + eq.name : "",
      };
    });
  return {
    clientId: String(client._id),
    client: {
      name: String(client.name),
      contact: String(client.contact),
      email: String(client.email),
      phone: String(client.phone),
      address: String(client.address),
    },
    request: {
      id: trf._id,
      number: String(trf.number),
      project: String(trf.project),
      site: String(trf.site),
      dueDate: String(trf.dueDate),
      requestedTests: String(trf.requestedTests),
    },
    tests,
  };
}
export async function demoRequest(
  path: string,
  method: string,
  body?: unknown,
): Promise<unknown> {
  if (path.startsWith("/files/"))
    return files.request(path, method, body ?? {});
  const url = new URL(path, "http://demo.local");
  const parts = url.pathname.split("/").filter(Boolean);
  const [entity, id, action] = parts;
  const input = (body ?? {}) as Record<string, unknown>;
  if (entity === "auth") {
    if (id === "persona") {
      const u = records.users.find((r) => r._id === input.id);
      if (!u || u.active === false)
        throw new Error("Unknown or inactive demo persona");
      actor = {
        id: u._id,
        name: String(u.name),
        roles: u.roles as string[],
        methodIds: u.methodIds as string[],
      };
    }
    if (id === "password")
      throw new Error("Password changes are unavailable in the demo");
    return id === "logout" ? null : actor;
  }
  const newId = () => (nextId++).toString(16).padStart(24, "0");
  function audit(row: LabRecord, action: string, before?: LabRecord) {
    records.audit.push({
      _id: newId(),
      actorId: actor.id,
      entity,
      entityId: row._id,
      action,
      before,
      after: structuredClone(row),
      reason: input.reason ?? input.reference,
      createdAt: new Date().toISOString(),
    });
  }
  function allowed(roles: readonly string[]) {
    if (!actor.roles.some((r) => roles.includes(r)))
      throw new Error("You do not have permission for this action");
  }
  if (entity === "consolidated") {
    allowed(["admin", "manager", "reviewer", "signatory"]);
    if (method === "GET") {
      if (id === "options") return bundleContext(action);
      return [...records.consolidated].reverse();
    }
    if (action === "withdraw") {
      const row = records.consolidated.find((r) => r._id === id);
      if (!row || row.status !== "draft")
        throw new Error("Draft is no longer current");
      requireVersion(Number(input.version), Number(row.version));
      if (typeof input.reason !== "string" || input.reason.trim().length < 3)
        throw new Error("Provide a withdrawal reason");
      const before = structuredClone(row);
      Object.assign(row, {
        status: "withdrawn",
        version: Number(row.version) + 1,
      });
      audit(row, "withdraw", before);
      return row;
    }
    const data = consolidatedInput.parse(input);
    const source = data.sourceId
      ? records.consolidated.find((r) => r._id === data.sourceId)
      : null;
    if (
      data.sourceId &&
      (!source ||
        source.status !== "draft" ||
        source.trfId !== data.trfId ||
        source.version !== data.sourceVersion)
    )
      throw new Error("Source draft changed or is no longer current");
    const snapshot = captureConsolidated(data, {
      ...bundleContext(data.trfId),
      preparedBy: actor.name,
      capturedAt: new Date().toISOString(),
    });
    const trf = records.trfs.find((r) => r._id === data.trfId)!;
    snapshot.appendices = await files.appendices(
      data.appendixIds,
      String(trf.clientId),
      data.trfId,
    );
    const before = source ? structuredClone(source) : undefined;
    if (source)
      Object.assign(source, {
        status: "superseded",
        version: Number(source.version) + 1,
      });
    const row = {
      _id: newId(),
      number:
        source?.number ??
        "CTR-" + String(records.consolidated.length + 1).padStart(6, "0"),
      trfId: data.trfId,
      revision: source ? Number(source.revision) + 1 : 0,
      status: "draft",
      version: 0,
      reason: data.reason,
      snapshot,
      createdAt: new Date().toISOString(),
    };
    records.consolidated.push(row);
    audit(row, source ? "revision_created" : "draft_created", before);
    return row;
  }
  if (entity === "billing-clients") {
    allowed(operationRoles.billing);
    return records.clients;
  }
  if (entity === "sample-options") {
    allowed(["admin", "manager", "reviewer", "technician", "signatory"]);
    return records.samples;
  }
  if (entity === "users") allowed(["admin", "manager"]);
  if (entity === "audit") allowed(["admin", "manager", "reviewer"]);
  if (entity === "reference")
    allowed(["admin", "manager", "technician", "reviewer", "signatory"]);
  if (
    [
      "dashboard",
      "clients",
      "trfs",
      "samples",
      "assignments",
      "methods",
    ].includes(entity)
  )
    allowed([
      "admin",
      "reception",
      "manager",
      "technician",
      "reviewer",
      "signatory",
    ]);
  if (entity === "review") {
    allowed(["admin", "manager", "technician", "reviewer", "signatory"]);
    return records.assignments
      .filter((r) => r.status !== "assigned")
      .map(populate);
  }
  if (
    entity === "assignments" &&
    (action === "workflow" || action === "equipment")
  ) {
    const row = records.assignments.find((r) => r._id === id);
    if (!row) throw new Error("Assignment not found");
    const before = structuredClone(row);
    requireVersion(Number(input.version), Number(row.version));
    if (action === "equipment") {
      allowed(["admin", "manager"]);
      if (
        !["assigned", "observations_draft", "returned"].includes(
          String(row.status),
        )
      )
        throw new Error("Record is locked");
      const eq = records.equipment.find((r) => r._id === input.equipmentId);
      if (!eq || !equipmentUsable(eq as never))
        throw new Error("Equipment must be active with current calibration");
      Object.assign(row, {
        equipmentId: input.equipmentId,
        version: Number(row.version) + 1,
      });
    } else {
      if (input.action === "submit" && row.equipmentId) {
        const eq = records.equipment.find((r) => r._id === row.equipmentId);
        if (!eq || !equipmentUsable(eq as never))
          throw new Error("Equipment calibration is overdue");
      }
      Object.assign(
        row,
        transition(row as unknown as WorkRecord, actor, input),
      );
      if (input.action === "reopen")
        records.reports
          .filter((r) => r.assignmentId === id && r.status === "draft")
          .forEach((r) => {
            r.status = "superseded";
            r.version = Number(r.version) + 1;
          });
    }
    audit(row, String(input.action ?? action), before);
    return populate(row);
  }
  if (entity === "reports") {
    allowed(["admin", "manager", "reviewer", "signatory"]);
    if (method === "GET") return [...records.reports].reverse();
    if (action === "action") {
      allowed(["manager", "signatory"]);
      const row = records.reports.find((r) => r._id === id);
      if (!row || row.status !== "draft")
        throw new Error("Report is no longer current");
      requireVersion(Number(input.version), Number(row.version));
      if (
        !["revise", "withdraw"].includes(String(input.action)) ||
        String(input.reason ?? "").trim().length < 3
      )
        throw new Error("Select an action and provide a reason");
      const before = structuredClone(row);
      if (
        input.action === "revise" &&
        !records.assignments.some(
          (a) => a._id === row.assignmentId && a.status === "authorized",
        )
      )
        throw new Error("Assignment is no longer authorized");
      row.status = input.action === "revise" ? "superseded" : "withdrawn";
      row.version = Number(row.version) + 1;
      if (input.action === "revise") {
        const revision = {
          ...structuredClone(row),
          _id: newId(),
          revision: Number(row.revision) + 1,
          status: "draft",
          version: 0,
          reason: input.reason,
          createdAt: new Date().toISOString(),
        };
        records.reports.push(revision);
        audit(revision, "revise", before);
        return revision;
      }
      audit(row, "withdraw", before);
      return row;
    }
    allowed(["signatory"]);
    const a = records.assignments.find((r) => r._id === input.assignmentId);
    if (!a || a.status !== "authorized" || a.authorizedBy !== actor.id)
      throw new Error("Only the authorizing signatory may create a draft");
    if (
      records.reports.some(
        (r) => r.assignmentId === a._id && r.status === "draft",
      )
    )
      throw new Error("A current draft already exists");
    if (String(input.reason ?? "").trim().length < 3)
      throw new Error("Provide a reason");
    const sample = records.samples.find((r) => r._id === a.sampleId)!;
    const m = records.methods.find((r) => r._id === a.methodId)!;
    const name = (id: unknown) =>
      String(records.users.find((u) => u._id === id)?.name ?? "Unknown");
    const row = {
      _id: newId(),
      number: "RPT-" + String(records.reports.length + 1).padStart(6, "0"),
      assignmentId: a._id,
      revision: 0,
      status: "draft",
      version: 0,
      reason: input.reason,
      createdAt: new Date().toISOString(),
      snapshot: {
        assignmentNumber: a.number,
        sampleNumber: sample.number,
        method: m.name,
        methodVersion: m.version,
        observations: structuredClone(a.observations),
        technician: name(a.technicianId),
        reviewer: name(a.reviewerId),
        signatory: name(a.authorizedBy),
      },
    };
    records.reports.push(row);
    audit(row, "draft_created");
    return row;
  }
  if (entity in operationSchemas) {
    const name = entity as OperationName;
    allowed(
      method === "GET" && name === "equipment"
        ? ["admin", "manager", "technician", "reviewer", "signatory"]
        : operationRoles[name],
    );
    if (method === "GET") return [...records[entity]].reverse();
    const row = id ? records[entity].find((r) => r._id === id) : null;
    const before = row ? structuredClone(row) : undefined;
    if (id && !row) throw new Error("Record not found");
    if (row) requireVersion(Number(input.version), Number(row.version));
    if (action === "payments" && row) {
      const payment = paymentInput.parse(input);
      Object.assign(
        row,
        recordPayment(
          Number(row.amountMinor),
          Number(row.paidMinor),
          payment.amountMinor,
        ),
      );
      row.payments = [...(row.payments as unknown[]), payment];
      row.version = Number(row.version) + 1;
      audit(row, "payment_recorded", before);
      return row;
    }
    if (row && name === "billing")
      throw new Error("Billing entries are immutable");
    const data = operationSchemas[name].parse(row ? input.data : input);
    if (
      "clientId" in data &&
      !records.clients.some((c) => c._id === data.clientId)
    )
      throw new Error("Client not found");
    if (
      "sampleId" in data &&
      data.sampleId &&
      !records.samples.some((c) => c._id === data.sampleId)
    )
      throw new Error("Sample not found");
    if (row) {
      if (String(input.reason ?? "").trim().length < 3)
        throw new Error("Provide a change reason");
      Object.assign(row, data, { version: Number(row.version) + 1 });
      audit(row, "update", before);
      return row;
    }
    const result = {
      ...data,
      _id: newId(),
      number:
        { equipment: "EQP", quality: "QLT", billing: "BIL", documents: "DOC" }[
          name
        ] +
        "-" +
        String(records[entity].length + 1).padStart(6, "0"),
      version: 0,
      createdAt: new Date().toISOString(),
      ...(name === "billing"
        ? { paidMinor: 0, payments: [], status: "unpaid" }
        : {}),
    };
    records[entity].push(result);
    audit(result, "create");
    return result;
  }
  if (entity === "users" && method === "PATCH") {
    allowed(["admin"]);
    userAccessInput.parse(input);
    if (
      (input.methodIds as string[]).some(
        (id) => !records.methods.some((m) => m._id === id),
      )
    )
      throw new Error("Unknown method");
    const row = records.users.find((r) => r._id === id);
    if (!row) throw new Error("User not found");
    if (id === actor.id)
      throw new Error("Use another administrator to change your own access");
    requireVersion(Number(input.version), Number(row.version));
    const before = structuredClone(row);
    Object.assign(row, {
      roles: input.roles,
      methodIds: input.methodIds,
      active: input.active,
      version: Number(row.version) + 1,
    });
    audit(row, "access_changed", before);
    return row;
  }

  if (entity === "reference")
    return method === "POST"
      ? referenceStrength(input)
      : { source: referenceSource, checks: verifyReference() };
  if (entity === "dashboard")
    return summarizeDashboard({
      clients: records.clients.length,
      trfs: records.trfs.length,
      samples: records.samples.map((s) => ({
        material: String(s.material),
        receiptStatus: String(s.receiptStatus),
        createdAt: String(s.createdAt),
      })),
      assignments: records.assignments.map((a) => ({
        status: String(a.status),
      })),
      methodsPending: records.methods.length,
      recentRequests: [...records.trfs]
        .reverse()
        .slice(0, 5)
        .map((r) => ({
          _id: r._id,
          number: String(r.number),
          project: String(r.project),
          dueDate: String(r.dueDate),
        })),
    });
  if (!records[entity]) throw new ApiError(404, "Record not found");
  if (method === "GET") {
    if (id) {
      const row = records[entity].find((r) => r._id === id);
      if (!row) throw new ApiError(404, "Record not found");
      return populate(row);
    }
    if (entity === "methods" || entity === "users")
      return records[entity].map(populate);
    const q = (url.searchParams.get("q") ?? "").toLowerCase();
    const filtered = [...records[entity]]
      .reverse()
      .filter((r) => JSON.stringify(populate(r)).toLowerCase().includes(q));
    const page = Number(url.searchParams.get("page") ?? 1);
    return {
      items: filtered.slice((page - 1) * 50, page * 50).map(populate),
      total: filtered.length,
      page,
    };
  }
  if (
    method === "PATCH" &&
    entity === "assignments" &&
    action === "observations"
  ) {
    allowed(["technician"]);
    const row = records.assignments.find((r) => r._id === id);
    if (!row) throw new ApiError(404, "Assignment not found");
    if (row.technicianId !== actor.id)
      throw new ApiError(403, "Only the assigned technician may edit");
    if (row.version !== input.version)
      throw new ApiError(409, "Record changed. Reload before editing.");
    if (
      !["assigned", "observations_draft", "returned"].includes(
        String(row.status),
      )
    )
      throw new Error("Record is locked; manager must reopen it");
    observationInput.parse(input);
    const before = structuredClone(row);
    Object.assign(row, {
      observations: input.observations,
      version: Number(row.version) + 1,
      status: "observations_draft",
      reviewerId: null,
      authorizedBy: null,
    });
    records.audit.push({
      _id: String(nextId++),
      actorId: actor.id,
      entity,
      entityId: row._id,
      action: "save_observations",
      before,
      after: structuredClone(row),
      reason: input.reason,
      createdAt: new Date().toISOString(),
    });
    return populate(row);
  }
  if (
    method === "POST" &&
    !id &&
    ["clients", "trfs", "samples", "assignments", "users"].includes(entity)
  ) {
    allowed(
      entity === "users"
        ? ["admin"]
        : entity === "assignments"
          ? ["admin", "manager"]
          : ["admin", "manager", "reception"],
    );
    for (const [key, target] of Object.entries(relations))
      if (input[key] && !records[target].some((r) => r._id === input[key]))
        throw new ApiError(422, "Select an existing linked record");
    if (entity === "assignments") {
      const technician = records.users.find(
        (u) => u._id === input.technicianId,
      );
      if (
        !technician ||
        technician.active === false ||
        !(technician.roles as string[]).includes("technician")
      )
        throw new Error("Select an active technician");
      const sample = records.samples.find((r) => r._id === input.sampleId)!;
      const method = records.methods.find((r) => r._id === input.methodId)!;
      if (
        sample.receiptStatus !== "accepted" ||
        sample.material !== method.material
      )
        throw new ApiError(422, "Sample and method do not match");
      if (
        records.assignments.some(
          (r) => r.sampleId === input.sampleId && r.methodId === input.methodId,
        )
      )
        throw new ApiError(409, "Assignment already exists");
    }
    const schemas = {
      clients: clientInput,
      trfs: trfInput,
      samples: sampleInput,
      assignments: assignmentInput,
      users: userCreateInput,
    };
    if (entity in schemas) schemas[entity as keyof typeof schemas].parse(input);
    if (
      entity === "users" &&
      records.users.some(
        (u) =>
          String(u.email).toLowerCase() === String(input.email).toLowerCase(),
      )
    )
      throw new Error("Email already exists");
    const safe = { ...input };
    delete safe.password;
    const prefix: Record<string, string> = {
      clients: "CLI",
      trfs: "TRF",
      samples: "SMP",
      assignments: "TST",
    };
    const row: LabRecord = {
      ...safe,
      _id: (nextId++).toString(16).padStart(24, "0"),
      createdAt: new Date().toISOString(),
    };
    if (entity === "users")
      Object.assign(row, { version: 0, methodIds: [], active: true });
    if (prefix[entity])
      row.number =
        prefix[entity] +
        "-" +
        String(records[entity].length + 1).padStart(6, "0");
    if (entity === "assignments")
      Object.assign(row, { status: "assigned", version: 0, observations: {} });
    records[entity].push(row);
    records.audit.push({
      _id: String(nextId++),
      entity,
      actorId: actor.id,
      entityId: row._id,
      action: "create",
      after: structuredClone(row),
      createdAt: new Date().toISOString(),
    });
    return populate(row);
  }
  throw new ApiError(409, "This operation is not available in the demo");
}

export async function demoReportPdf(id: string) {
  const row = records.reports.find((r) => r._id === id);
  if (!row) throw new Error("Report not found");
  return draftReportPdf(row as unknown as DraftReport);
}

export async function demoConsolidatedPdf(id: string) {
  if (
    !actor.roles.some((r) =>
      ["admin", "manager", "reviewer", "signatory"].includes(r),
    )
  )
    throw new Error("You do not have permission");
  const row = records.consolidated.find((r) => r._id === id);
  if (!row) throw new Error("Report not found");
  const report = row as unknown as ConsolidatedReport;
  const attachments = [];
  for (const meta of report.snapshot.appendices ?? [])
    attachments.push({
      meta,
      bytes: new Uint8Array(
        await (await files.download(meta.versionId)).arrayBuffer(),
      ),
    });
  return appendReportFiles(
    await consolidatedPdf(report),
    report.number,
    report.revision,
    attachments,
  );
}

export const demoFileUpload = (id: string, file: Blob) =>
  files.upload(id, file);
export const demoFileDownload = (id: string) => files.download(id);
