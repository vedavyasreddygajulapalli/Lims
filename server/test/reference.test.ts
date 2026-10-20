import { test } from "node:test";
import assert from "node:assert/strict";
import { referenceStrength, verifyReference } from "@lims/core";
import { escapeRegex } from "../src/services/search.js";
test("all three published concrete values match exactly to two decimals", () => {
  const checks = verifyReference();
  assert.deepEqual(
    checks.map((c) => c.displayed),
    ["23.08", "23.32", "22.15"],
  );
  assert.ok(checks.every((c) => c.matches));
});
test("unit conversion and exact quotient remain inspectable", () => {
  const result = referenceStrength({ loadKn: "519.3", areaMm2: "22500" });
  assert.equal(result.exactNumerator, "5193000");
  assert.equal(result.exactDenominator, "225000");
  assert.equal(result.referenceOnly, true);
});
test("explicit reference rounding handles decimal ties without binary drift", () => {
  assert.equal(
    referenceStrength({ loadKn: "1.005", areaMm2: "1000" }).displayed,
    "1.01",
  );
  assert.equal(
    referenceStrength({ loadKn: "1.004999", areaMm2: "1000" }).displayed,
    "1.00",
  );
});
test("invalid numeric input cannot create a result", () => {
  for (const value of [
    "0",
    "-1",
    "NaN",
    "Infinity",
    "1e3",
    "",
    " 1 ",
    "0.0000001",
  ])
    assert.throws(() => referenceStrength({ loadKn: value, areaMm2: "22500" }));
  assert.throws(() => referenceStrength({ loadKn: "519.3", areaMm2: "0" }));
});
test("reference calculator preserves entered strings and rejects injected fields", () => {
  assert.equal(
    referenceStrength({ loadKn: "519.300", areaMm2: "22500.00" }).input.loadKn,
    "519.300",
  );
  assert.throws(() =>
    referenceStrength({ loadKn: "1", areaMm2: "1", approved: true }),
  );
});
test("search treats regex special characters literally", () => {
  const raw = "(.*)+[test]$";
  assert.equal(new RegExp(escapeRegex(raw)).test(raw), true);
  assert.equal(new RegExp(escapeRegex(raw)).test("anything"), false);
});
