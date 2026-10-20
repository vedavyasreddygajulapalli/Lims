import { test } from "node:test";
import assert from "node:assert/strict";
import {
  transition,
  qualityInput,
  recordPayment,
  amountToMinor,
  equipmentUsable,
  draftReportPdf,
} from "@lims/core";
import { PDFDocument } from "pdf-lib";
const base = {
  status: "observations_draft",
  technicianId: "tech",
  methodId: "method",
  version: 1,
  observations: { load: "0001.2300" },
};
const action = (action: string, version: number) => ({
  action,
  version,
  reason: "Verified against original record",
});
test("independent review, scoped signatory and stale-version guards", () => {
  const submitted = {
    ...base,
    ...transition(
      base,
      { id: "tech", roles: ["technician"] },
      action("submit", 1),
    ),
  };
  assert.equal(submitted.status, "awaiting_review");
  assert.throws(() =>
    transition(
      submitted,
      { id: "tech", roles: ["reviewer"] },
      action("review", 2),
    ),
  );
  assert.throws(() =>
    transition(
      submitted,
      { id: "reviewer", roles: ["reviewer"] },
      action("review", 1),
    ),
  );
  const reviewed = {
    ...submitted,
    ...transition(
      submitted,
      { id: "reviewer", roles: ["reviewer"] },
      action("review", 2),
    ),
  };
  assert.throws(() =>
    transition(
      reviewed,
      { id: "reviewer", roles: ["signatory"], methodIds: ["method"] },
      action("authorize", 3),
    ),
  );
  assert.throws(() =>
    transition(
      reviewed,
      { id: "signatory", roles: ["signatory"], methodIds: [] },
      action("authorize", 3),
    ),
  );
  const authorized = {
    ...reviewed,
    ...transition(
      reviewed,
      { id: "signatory", roles: ["signatory"], methodIds: ["method"] },
      action("authorize", 3),
    ),
  };
  assert.equal(authorized.authorizedBy, "signatory");
  const reopened = transition(
    authorized,
    { id: "manager", roles: ["manager"] },
    action("reopen", 4),
  );
  assert.equal(reopened.reviewerId, null);
  assert.equal(reopened.authorizedBy, null);
  assert.equal(base.observations.load, "0001.2300");
});
test("reject empty submission and invalid workflow actions", () => {
  assert.throws(() =>
    transition(
      { ...base, observations: { reading: " " } },
      { id: "tech", roles: ["technician"] },
      action("submit", 1),
    ),
  );
  assert.throws(() =>
    transition(base, { id: "admin", roles: ["admin"] }, action("authorize", 1)),
  );
});
test("quality closure needs evidence and dates must be real", () => {
  const item = {
    title: "Label issue",
    type: "nonconformity",
    owner: "Manager",
    dueDate: "2026-11-30",
    status: "closed",
    description: "Check sample identification",
  };
  assert.equal(qualityInput.safeParse(item).success, false);
  assert.equal(
    qualityInput.safeParse({
      ...item,
      rootCause: "Cause",
      correction: "Corrected",
      correctiveAction: "Training",
      effectiveness: "Rechecked",
    }).success,
    true,
  );
  assert.equal(
    qualityInput.safeParse({ ...item, status: "open", dueDate: "2026-02-30" })
      .success,
    false,
  );
});
test("ledger arithmetic stays exact in paise and rejects overpayment", () => {
  assert.equal(amountToMinor("123.45"), 12345);
  assert.equal(amountToMinor("0.10"), 10);
  assert.throws(() => amountToMinor("10.001"));
  assert.throws(() => amountToMinor("-5"));
  assert.deepEqual(recordPayment(10000, 1000, 9000), {
    paidMinor: 10000,
    status: "paid",
  });
  assert.throws(() => recordPayment(10000, 1000, 9001));
  assert.throws(() => recordPayment(10000, 0, 0));
  assert.throws(() => recordPayment(10000, 0, 1.5));
});
test("equipment calibration boundary and availability", () => {
  assert.equal(
    equipmentUsable(
      { status: "active", calibrationDue: "2026-10-20" },
      "2026-10-20",
    ),
    true,
  );
  assert.equal(
    equipmentUsable(
      { status: "maintenance", calibrationDue: "2026-12-20" },
      "2026-10-20",
    ),
    false,
  );
  assert.equal(
    equipmentUsable(
      { status: "active", calibrationDue: "2026-10-19" },
      "2026-10-20",
    ),
    false,
  );
});
test("draft PDF renders long original observations across pages", async () => {
  const bytes = await draftReportPdf({
    number: "RPT-1",
    revision: 0,
    status: "draft",
    createdAt: "2026-10-20",
    reason: "Reference only",
    snapshot: {
      assignmentNumber: "TST-1",
      sampleNumber: "SMP-1",
      method: "Method",
      methodVersion: "unconfigured",
      technician: "Tech",
      reviewer: "Reviewer",
      signatory: "Signatory",
      observations: Object.fromEntries(
        Array.from({ length: 80 }, (_, i) => ["reading_" + i, "0001.2300"]),
      ),
    },
  });
  const pdf = await PDFDocument.load(bytes);
  assert.ok(pdf.getPageCount() > 1);
});
