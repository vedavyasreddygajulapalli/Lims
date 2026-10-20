import { test } from "node:test";
import assert from "node:assert/strict";
import { summarizeDashboard } from "@lims/core";
test("dashboard counts are derived from records and empty days are retained", () => {
  const result = summarizeDashboard(
    {
      clients: 2,
      trfs: 1,
      samples: [
        {
          material: "Concrete",
          receiptStatus: "accepted",
          createdAt: "2026-10-20T00:00:00Z",
        },
        {
          material: "Soil",
          receiptStatus: "quarantined",
          createdAt: "2026-10-18T00:00:00Z",
        },
      ],
      assignments: [{ status: "assigned" }, { status: "observations_draft" }],
      methodsPending: 7,
      recentRequests: [],
    },
    new Date("2026-10-20T12:00:00Z"),
  );
  assert.equal(result.counts.samples, 2);
  assert.equal(result.days.length, 7);
  assert.equal(result.days.at(-1)?.count, 1);
  assert.equal(result.days[0].count, 0);
  assert.equal(result.receipt.quarantined, 1);
  assert.equal(result.draftObservations, 1);
});
test("empty database never fabricates dashboard activity", () => {
  const result = summarizeDashboard({
    clients: 0,
    trfs: 0,
    samples: [],
    assignments: [],
    methodsPending: 0,
    recentRequests: [],
  });
  assert.equal(result.counts.samples, 0);
  assert.ok(result.days.every((d) => d.count === 0));
  assert.deepEqual(result.materials, []);
});
