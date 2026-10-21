import { describe, it, expect, beforeEach } from "vitest";
import { demoRequest, resetDemo } from "./adapter";
describe("client workspace scope and permissions", () => {
  beforeEach(resetDemo);
  it("keeps client records separate and handles an empty client", async () => {
    const a: any = await demoRequest(
      "/clients/00000000000000000000000a/workspace",
      "GET",
    );
    expect(a.counts.trfs).toBe(2);
    expect(a.counts.files).toBe(2);
    const rows: any = await demoRequest(
      "/clients/00000000000000000000000a/workspace/records?section=trfs",
      "GET",
    );
    expect(rows.items.every((r: any) => r.clientId._id === a.client._id)).toBe(
      true,
    );
    const fresh: any = await demoRequest("/clients", "POST", {
      name: "Empty client",
      contact: "Example",
      email: "empty@example.com",
      phone: "1234567890",
      address: "Example address",
    });
    const empty: any = await demoRequest(
      "/clients/" + fresh._id + "/workspace",
      "GET",
    );
    expect(empty.counts.trfs).toBe(0);
    expect(empty.counts.files).toBe(0);
  });
  it("omits billing totals for reviewers and denies direct billing access", async () => {
    await demoRequest("/auth/persona", "POST", {
      id: "000000000000000000000003",
    });
    const a: any = await demoRequest(
      "/clients/00000000000000000000000a/workspace",
      "GET",
    );
    expect(a.billing).toBeUndefined();
    expect(a.counts.billing).toBeUndefined();
    expect(a.sections).not.toContain("billing");
    await expect(
      demoRequest(
        "/clients/00000000000000000000000a/workspace/records?section=billing",
        "GET",
      ),
    ).rejects.toThrow(/role/);
  });
});

it("global search and activity respect client links and hide commercial work from reviewers", async () => {
  resetDemo();
  const a = "00000000000000000000000a",
    b = "00000000000000000000000b";
  await demoRequest("/billing", "POST", {
    clientId: a,
    description: "Private charge",
    amountMinor: 10000,
    dueDate: "2026-12-01",
  });
  const one: any = await demoRequest(
    "/clients/" + a + "/workspace/activity",
    "GET",
  );
  expect(one.items.some((r: any) => r.entity === "billing")).toBe(true);
  const two: any = await demoRequest(
    "/clients/" + b + "/workspace/activity",
    "GET",
  );
  expect(two.items.some((r: any) => r.entity === "billing")).toBe(false);
  const hits: any = await demoRequest("/search?q=Greenfield", "GET");
  expect(hits.items.some((r: any) => r.kind === "clients" && r.id === a)).toBe(
    true,
  );
  await demoRequest("/auth/persona", "POST", {
    id: "000000000000000000000003",
  });
  const restricted: any = await demoRequest(
    "/clients/" + a + "/workspace/activity",
    "GET",
  );
  expect(restricted.items.some((r: any) => r.entity === "billing")).toBe(false);
});
