import { test } from "node:test";
import assert from "node:assert/strict";
import {
  allow,
  assertLink,
  assertSampleAssignable,
  assertVersion,
  calculate,
  observationInput,
  trfInput,
  clientInput,
} from "../src/domain.js";
import {
  hashPassword,
  verifyPassword,
  digest,
  newToken,
} from "../src/security.js";
test("administrator is not implicitly a technical signatory", () => {
  assert.throws(() => allow(["admin"], ["signatory"]), /permission/);
  assert.doesNotThrow(() => allow(["signatory"], ["signatory"]));
});
test("missing parents and unaccepted samples are blocked", () => {
  assert.throws(() => assertLink(null, "TRF"), /TRF does not exist/);
  for (const status of ["rejected", "quarantined"])
    assert.throws(() => assertSampleAssignable(status), /accepted/);
  assert.doesNotThrow(() => assertSampleAssignable("accepted"));
});
test("stale observation version is rejected", () => {
  assert.throws(() => assertVersion(0, 1), /Record changed/);
  assert.doesNotThrow(() => assertVersion(3, 3));
});
test("calculation cannot execute without supplied source", () => {
  assert.throws(() => calculate(), /original source sheet/);
});
test("observation entry preserves exact decimal strings and whitespace", () => {
  const observations = { a: "0001.2300", b: " 12.00 ", c: "0.00000000000001" };
  assert.deepEqual(
    observationInput.parse({ version: 0, observations, reason: "Source entry" })
      .observations,
    observations,
  );
});
test("numeric coercion and unexpected observation fields are rejected", () => {
  assert.equal(
    observationInput.safeParse({
      version: 0,
      observations: { a: 1.23 },
      reason: "Source",
    }).success,
    false,
  );
  assert.equal(
    observationInput.safeParse({
      version: 0,
      observations: { a: "1.23" },
      reason: "Source",
      result: "1.23",
    }).success,
    false,
  );
});
test("invalid dates, links and unexpected client fields are rejected", () => {
  const input = {
    clientId: "a".repeat(24),
    project: "Project",
    site: "Site",
    requestedTests: "Tests",
    dueDate: "2026-02-30",
  };
  assert.equal(trfInput.safeParse(input).success, false);
  assert.equal(
    trfInput.safeParse({ ...input, dueDate: "2026-02-28" }).success,
    true,
  );
  assert.equal(
    trfInput.safeParse({ ...input, clientId: "fake" }).success,
    false,
  );
  assert.equal(
    clientInput.safeParse({
      name: "Client",
      contact: "Contact",
      email: "x@example.com",
      phone: "123",
      address: "Site",
      approved: true,
    }).success,
    false,
  );
});
test("password hashing and session token hashing", async () => {
  const hash = await hashPassword("test-password");
  assert.notEqual(hash, "test-password");
  assert.equal(await verifyPassword("test-password", hash), true);
  assert.equal(await verifyPassword("wrong-password", hash), false);
  const token = newToken();
  assert.equal(token.length, 64);
  assert.notEqual(digest(token), token);
  assert.notEqual(token, newToken());
});
