import { beforeEach, it, expect } from "vitest";
import { demoRequest as request, resetDemo, demoReportPdf } from "./adapter";
import { PDFDocument } from "pdf-lib";
beforeEach(resetDemo);
const admin = "000000000000000000000001",
  reviewer = "000000000000000000000003",
  signatory = "000000000000000000000004";
const persona = (id: string) => request("/auth/persona", "POST", { id });
it("connects a new client through intake, observations, review, draft PDF, revision and reopening", async () => {
  const client: any = await request("/clients", "POST", {
    name: "Journey client",
    contact: "Contact",
    email: "journey@example.com",
    phone: "1234567890",
    address: "Test address",
  });
  const trf: any = await request("/trfs", "POST", {
    clientId: client._id,
    project: "Journey project",
    site: "Test site",
    requestedTests: "Observation review",
    dueDate: "2026-11-30",
  });
  const sample: any = await request("/samples", "POST", {
    trfId: trf._id,
    description: "Journey cube",
    material: "Concrete",
    condition: "Intact",
    storage: "Rack A",
    receiptStatus: "accepted",
  });
  const methods: any = await request("/methods", "GET");
  const method = methods.find((m: any) => m.material === "Concrete");
  const assignment: any = await request("/assignments", "POST", {
    sampleId: sample._id,
    methodId: method._id,
    technicianId: admin,
  });
  let a: any = await request(
    "/assignments/" + assignment._id + "/observations",
    "PATCH",
    {
      version: 0,
      observations: { load: "000519.3000", note: "  original spacing  " },
      reason: "Transcribed original sheet",
    },
  );
  expect(a.observations.load).toBe("000519.3000");
  const move = async (action: string) =>
    (a = await request("/assignments/" + a._id + "/workflow", "POST", {
      action,
      version: a.version,
      reason: "Verified source record",
    }));
  await move("submit");
  await expect(move("review")).rejects.toThrow(/independent/);
  await expect(
    request("/assignments/" + a._id + "/observations", "PATCH", {
      version: a.version,
      observations: { load: "1" },
      reason: "Locked attempt",
    }),
  ).rejects.toThrow(/locked/);
  await persona(reviewer);
  await move("review");
  await persona(signatory);
  await move("authorize");
  const report: any = await request("/reports", "POST", {
    assignmentId: a._id,
    reason: "Draft acceptance check",
  });
  expect(report.snapshot.observations).toEqual({
    load: "000519.3000",
    note: "  original spacing  ",
  });
  expect(report.snapshot.sampleNumber).toBe(sample.number);
  expect(report.snapshot.technician).not.toBe(report.snapshot.reviewer);
  expect(report.snapshot.signatory).not.toBe(report.snapshot.reviewer);
  const pdf = await PDFDocument.load(await demoReportPdf(report._id));
  expect(pdf.getPageCount()).toBeGreaterThan(0);
  await expect(
    request("/reports", "POST", {
      assignmentId: a._id,
      reason: "Duplicate check",
    }),
  ).rejects.toThrow(/already exists/);
  const revision: any = await request(
    "/reports/" + report._id + "/action",
    "POST",
    { action: "revise", version: 0, reason: "Revision check" },
  );
  expect(revision.revision).toBe(1);
  await persona(admin);
  await move("reopen");
  const reports: any = await request("/reports", "GET");
  expect(reports.every((r: any) => r.status === "superseded")).toBe(true);
  const latest: any = await request("/assignments/" + a._id, "GET");
  await request("/assignments/" + a._id + "/observations", "PATCH", {
    version: latest.version,
    observations: { load: "new reading" },
    reason: "Correction after reopening",
  });
  const snapshots: any = await request("/reports", "GET");
  expect(
    snapshots.every((r: any) => r.snapshot.observations.load === "000519.3000"),
  ).toBe(true);
});
it("prevents reviewers from creating clients, assignments, accounts or payments", async () => {
  await persona(reviewer);
  for (const endpoint of ["/clients", "/assignments", "/users", "/billing"])
    await expect(request(endpoint, "POST", {})).rejects.toThrow(/permission/);
});
it("rejects unknown signatory scopes and inactive technician assignment", async () => {
  await expect(
    request("/users/" + reviewer, "PATCH", {
      version: 0,
      roles: ["signatory"],
      active: true,
      methodIds: ["999999999999999999999999"],
      reason: "Invalid scope",
    }),
  ).rejects.toThrow(/Unknown method/);
  const tech = "000000000000000000000002";
  await request("/users/" + tech, "PATCH", {
    version: 0,
    roles: ["technician"],
    active: false,
    methodIds: [],
    reason: "Deactivate for test",
  });
  await expect(
    request("/assignments", "POST", {
      sampleId: "000000000000000000000077",
      methodId: "00000000000000000000003c",
      technicianId: tech,
    }),
  ).rejects.toThrow(/active technician/);
});
it("keeps payment entries unchanged on overpayment or a stale version", async () => {
  const bill: any = await request("/billing", "POST", {
    clientId: "00000000000000000000000a",
    description: "Test charge",
    amountMinor: 10000,
    dueDate: "2026-11-30",
  });
  await request("/billing/" + bill._id + "/payments", "POST", {
    version: 0,
    amountMinor: 3000,
    date: "2026-10-20",
    reference: "PAY1",
  });
  await expect(
    request("/billing/" + bill._id + "/payments", "POST", {
      version: 0,
      amountMinor: 1000,
      date: "2026-10-20",
      reference: "STALE",
    }),
  ).rejects.toThrow(/changed/);
  await expect(
    request("/billing/" + bill._id + "/payments", "POST", {
      version: 1,
      amountMinor: 7001,
      date: "2026-10-20",
      reference: "OVER",
    }),
  ).rejects.toThrow(/outstanding/);
  const rows: any = await request("/billing", "GET");
  expect(rows[0].paidMinor).toBe(3000);
  expect(rows[0].payments).toHaveLength(1);
});
