import { randomUUID } from "node:crypto";
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import mongoose from "mongoose";
import { MongoMemoryReplSet } from "mongodb-memory-server";
import request from "supertest";
import { createApp } from "../src/app.js";
import {
  User,
  Method,
  Audit,
  Client,
  initialize,
  seedCatalogue,
} from "../src/models.js";
import { hashPassword } from "../src/security.js";
const origin = "http://localhost:5173";
let mongo: MongoMemoryReplSet;
let app: ReturnType<typeof createApp>;
let admin: any;
let tech: any;
let outsider: any;
let techId: string;
let testUri: string;
let testDb: string;
before(async () => {
  const external = process.env.TEST_MONGODB_URI;
  if (external && !/^mongodb(?:\+srv)?:\/\//.test(external))
    throw new Error("TEST_MONGODB_URI must be a MongoDB connection string");
  if (!external)
    mongo = await MongoMemoryReplSet.create({ replSet: { count: 1 } });
  // Never read/write/drop the database named in an external URI.
  testUri = external || mongo.getUri();
  testDb = "lims_test_" + randomUUID().replaceAll("-", "");
  await mongoose.connect(testUri, {
    dbName: testDb,
    serverSelectionTimeoutMS: 15000,
  });
  const hello = await mongoose.connection.db!.admin().command({ hello: 1 });
  if (!hello.setName && hello.msg !== "isdbgrid")
    throw new Error(
      "Integration tests require a replica set or sharded MongoDB for transactions",
    );
  await initialize();
  await seedCatalogue();
  app = createApp(origin);
  const passwordHash = await hashPassword("Testing-password-123");
  await User.create({
    name: "Admin",
    email: "admin@test.in",
    passwordHash,
    roles: ["admin"],
  });
  const u = await User.create({
    name: "Tech",
    email: "tech@test.in",
    passwordHash,
    roles: ["technician"],
  });
  techId = String(u._id);
  await User.create({
    name: "Other",
    email: "other@test.in",
    passwordHash,
    roles: ["technician"],
  });
  admin = request.agent(app);
  tech = request.agent(app);
  outsider = request.agent(app);
  for (const [a, email] of [
    [admin, "admin@test.in"],
    [tech, "tech@test.in"],
    [outsider, "other@test.in"],
  ])
    await a
      .post("/api/auth/login")
      .set("Origin", origin)
      .send({ email, password: "Testing-password-123" })
      .expect(200);
});
after(async () => {
  if (
    mongoose.connection.readyState === 1 &&
    /^lims_test_[a-f0-9]{32}$/.test(mongoose.connection.name)
  )
    await mongoose.connection.dropDatabase();
  await mongoose.disconnect();
  if (mongo) await mongo.stop();
});
const post = (a: any, path: string, body: any) =>
  a
    .post("/api/" + path)
    .set("Origin", origin)
    .send(body);
test("reject unauthenticated reads and cross-origin writes", async () => {
  await request(app).get("/api/clients").expect(401);
  await admin.post("/api/clients").send({}).expect(403);
});
test("linked workflow, permissions, exact observations, conflicts and locked calculators", async () => {
  const client = (
    await post(admin, "clients", {
      name: "Test client",
      contact: "Contact",
      email: "client@test.in",
      phone: "1234567890",
      address: "Test site",
    }).expect(201)
  ).body;
  await post(tech, "clients", { name: "Forbidden" }).expect(403);
  const trfInput = {
    clientId: client._id,
    project: "Test project",
    site: "Site A",
    requestedTests: "Cube test",
    dueDate: "2026-11-30",
  };
  await post(admin, "trfs", {
    ...trfInput,
    clientId: new mongoose.Types.ObjectId().toString(),
  }).expect(422);
  const trf = (await post(admin, "trfs", trfInput).expect(201)).body;
  const sampleInput = {
    trfId: trf._id,
    description: "Concrete cube",
    material: "Concrete",
    condition: "Intact",
    storage: "Rack A",
    receiptStatus: "accepted",
  };
  const sample = (await post(admin, "samples", sampleInput).expect(201)).body;
  const rejected = (
    await post(admin, "samples", {
      ...sampleInput,
      receiptStatus: "rejected",
    }).expect(201)
  ).body;
  const method = await Method.findOne({ material: "Concrete" });
  const otherMethod = await Method.findOne({ material: "Soil" });
  const assignmentInput = {
    sampleId: sample._id,
    methodId: String(method!._id),
    technicianId: techId,
  };
  await post(admin, "assignments", {
    ...assignmentInput,
    sampleId: rejected._id,
  }).expect(409);
  await post(admin, "assignments", {
    ...assignmentInput,
    methodId: String(otherMethod!._id),
  }).expect(422);
  const assignment = (
    await post(admin, "assignments", assignmentInput).expect(201)
  ).body;
  await post(admin, "assignments", assignmentInput).expect(409);
  const payload = {
    version: 0,
    observations: { reading: "0001.2300", load: "75.00" },
    reason: "Transcribed original sheet",
  };
  await outsider
    .patch("/api/assignments/" + assignment._id + "/observations")
    .set("Origin", origin)
    .send(payload)
    .expect(403);
  const saved = (
    await tech
      .patch("/api/assignments/" + assignment._id + "/observations")
      .set("Origin", origin)
      .send(payload)
      .expect(200)
  ).body;
  assert.equal(saved.observations.reading, "0001.2300");
  const independent = await mongoose
    .createConnection(testUri, {
      dbName: testDb,
      serverSelectionTimeoutMS: 15000,
    })
    .asPromise();
  try {
    const stored = await independent
      .collection("assignments")
      .findOne({ _id: new mongoose.Types.ObjectId(assignment._id) });
    assert.equal(stored?.observations.reading, "0001.2300");
  } finally {
    await independent.close();
  }

  const concurrent = await Promise.all(
    ["12.00", "13.00"].map((v) =>
      tech
        .patch("/api/assignments/" + assignment._id + "/observations")
        .set("Origin", origin)
        .send({
          ...payload,
          version: 1,
          observations: { reading: v },
          reason: "Correction",
        }),
    ),
  );
  assert.deepEqual(concurrent.map((r) => r.status).sort(), [200, 409]);
  await post(tech, "assignments/" + assignment._id + "/calculate", {}).expect(
    409,
  );
  const history = await Audit.find({ entityId: assignment._id }).lean();
  assert.equal(history.length, 3);
  assert.equal((history[1].after as any).observations.reading, "0001.2300");
  await request(app).get("/api/methods").expect(401);
  await tech.get("/api/audit").expect(403);
});
test("simultaneous creation produces unique numbers with audit records", async () => {
  const results = await Promise.all(
    Array.from({ length: 8 }, (_, i) =>
      post(admin, "clients", {
        name: "Concurrent " + i,
        contact: "Contact",
        email: `c${i}@test.in`,
        phone: "123",
        address: "Test",
      }),
    ),
  );
  assert.ok(results.every((r) => r.status === 201));
  assert.equal(new Set(results.map((r) => r.body.number)).size, 8);
  assert.equal(
    await Audit.countDocuments({ entity: "clients" }),
    await Client.countDocuments(),
  );
});

test("review, draft revisions, equipment, ledger and session revocation", async () => {
  const { Assignment, Report } = await import("../src/models.js");
  const assignment: any = await Assignment.findOne();
  assert.ok(assignment);
  const methodId = String(assignment.methodId);
  const passwordHash = await hashPassword("Testing-password-123");
  const reviewerUser = await User.create({
    name: "Reviewer",
    email: "reviewer@test.in",
    passwordHash,
    roles: ["reviewer"],
  });
  await User.create({
    name: "Signatory",
    email: "signatory@test.in",
    passwordHash,
    roles: ["signatory"],
    methodIds: [methodId],
  });
  const reviewer = request.agent(app),
    signatory = request.agent(app);
  for (const [a, email] of [
    [reviewer, "reviewer@test.in"],
    [signatory, "signatory@test.in"],
  ] as const)
    await post(a, "auth/login", {
      email,
      password: "Testing-password-123",
    }).expect(200);
  const eq = (
    await post(admin, "equipment", {
      name: "Compression machine",
      serial: "CTM-1",
      location: "Lab",
      calibrationDue: "2099-12-31",
      status: "active",
    }).expect(201)
  ).body;
  const linked = (
    await admin
      .patch("/api/assignments/" + assignment._id + "/equipment")
      .set("Origin", origin)
      .send({
        version: assignment.version,
        equipmentId: eq._id,
        reason: "Selected calibrated instrument",
      })
      .expect(200)
  ).body;
  const move = (agent: any, action: string, version: number) =>
    post(agent, "assignments/" + assignment._id + "/workflow", {
      action,
      version,
      reason: "Verified source observation record",
    });
  const submitted = (await move(tech, "submit", linked.version).expect(200))
    .body;
  await tech
    .patch("/api/assignments/" + assignment._id + "/observations")
    .set("Origin", origin)
    .send({
      version: submitted.version,
      observations: { reading: "changed" },
      reason: "Cannot edit submitted record",
    })
    .expect(409);
  const reviewed = (
    await move(reviewer, "review", submitted.version).expect(200)
  ).body;
  const authorized = (
    await move(signatory, "authorize", reviewed.version).expect(200)
  ).body;
  assert.equal(authorized.status, "authorized");
  const draft = (
    await post(signatory, "reports", {
      assignmentId: String(assignment._id),
      reason: "Draft for acceptance",
    }).expect(201)
  ).body;
  await post(signatory, "reports", {
    assignmentId: String(assignment._id),
    reason: "Duplicate draft",
  }).expect(409);
  const pdf = await signatory
    .get("/api/reports/" + draft._id + "/pdf")
    .expect(200);
  assert.match(pdf.headers["content-type"], /application\/pdf/);
  const revision = (
    await post(signatory, "reports/" + draft._id + "/action", {
      version: 0,
      action: "revise",
      reason: "Revised draft reason",
    }).expect(200)
  ).body;
  assert.equal(revision.revision, 1);
  assert.equal((await Report.findById(draft._id))!.status, "superseded");
  await post(signatory, "reports/" + draft._id + "/action", {
    version: 0,
    action: "withdraw",
    reason: "Stale report request",
  }).expect(409);
  await post(signatory, "reports/" + revision._id + "/action", {
    version: 0,
    action: "withdraw",
    reason: "Withdraw draft for checking",
  }).expect(200);
  const client: any = await Client.findOne();
  const bill = (
    await post(admin, "billing", {
      clientId: String(client._id),
      description: "Sample charge",
      amountMinor: 10025,
      dueDate: "2026-11-30",
    }).expect(201)
  ).body;
  const partial = (
    await post(admin, "billing/" + bill._id + "/payments", {
      version: 0,
      amountMinor: 4010,
      reference: "Bank 1",
      date: "2026-10-20",
    }).expect(200)
  ).body;
  assert.equal(partial.paidMinor, 4010);
  await post(admin, "billing/" + bill._id + "/payments", {
    version: 1,
    amountMinor: 6016,
    reference: "Overpayment",
    date: "2026-10-20",
  }).expect(422);
  await admin
    .patch("/api/users/" + reviewerUser._id)
    .set("Origin", origin)
    .send({
      version: 0,
      active: false,
      roles: ["reviewer"],
      methodIds: [],
      reason: "Deactivate test account",
    })
    .expect(200);
  await reviewer.get("/api/review").expect(401);
  await post(signatory, "auth/password", {
    currentPassword: "Testing-password-123",
    newPassword: "Replacement-password-123",
  }).expect(204);
  await signatory.get("/api/reports").expect(401);
});

test("consolidated snapshots persist, enforce roles and revision conflicts", async () => {
  const { Trf, Consolidated } = await import("../src/models.js");
  const trf: any = await Trf.findOne();
  await tech.get("/api/consolidated").expect(403);
  await request(app).get("/api/consolidated").expect(401);
  const context = (
    await admin.get("/api/consolidated/options/" + trf._id).expect(200)
  ).body;
  const input = {
    trfId: String(trf._id),
    title: "Consolidated acceptance report",
    summary: "Test scope",
    reason: "Acceptance review",
    selections: context.tests.map((t: any) => ({
      id: t.id,
      version: t.version,
    })),
  };
  await post(admin, "consolidated", {
    ...input,
    selections: [{ ...input.selections[0], version: 999 }],
  }).expect(409);
  await post(admin, "consolidated", {
    ...input,
    selections: [{ id: new mongoose.Types.ObjectId().toString(), version: 0 }],
  }).expect(409);
  const report = (await post(admin, "consolidated", input).expect(201)).body;
  assert.deepEqual(
    report.snapshot.tests[0].observations,
    context.tests[0].observations,
  );
  const pdf = await admin
    .get("/api/consolidated/" + report._id + "/pdf")
    .expect(200);
  assert.match(pdf.headers["content-type"], /application\/pdf/);
  const revision = (
    await post(admin, "consolidated", {
      ...input,
      sourceId: report._id,
      sourceVersion: 0,
    }).expect(201)
  ).body;
  assert.equal(revision.revision, 1);
  assert.equal(revision.number, report.number);
  await post(admin, "consolidated", {
    ...input,
    sourceId: report._id,
    sourceVersion: 0,
  }).expect(409);
  const saved: any = await Consolidated.findById(report._id).lean();
  assert.equal(saved.status, "superseded");
  assert.deepEqual(saved.snapshot, report.snapshot);
  await post(admin, "consolidated/" + revision._id + "/withdraw", {
    version: 0,
    reason: "Withdraw test draft",
  }).expect(200);
  await post(admin, "consolidated/" + revision._id + "/withdraw", {
    version: 0,
    reason: "Stale request",
  }).expect(409);
  assert.equal(await Audit.countDocuments({ entity: "consolidated" }), 3);
});

test("client files: private uploads, folders, checksums, immutable versions, appendices and role guards", async () => {
  const { FileAsset, FileVersion, FileBudget } =
    await import("../src/files/models.js");
  const { hashFile } = await import("../src/files/storage.js");
  const { PDFDocument } = await import("pdf-lib");
  const objects = new Map<string, Buffer>();
  let scans = 0,
    puts = 0;
  const storage = {
    ready: () => true,
    scan: async (data: Buffer) => {
      scans++;
      if (data.includes(Buffer.from("MALWARE")))
        throw new Error("Rejected test scan");
    },
    put: async (id: string, data: Buffer) => {
      puts++;
      objects.set(id, Buffer.from(data));
      return { id, path: "/test/" + id };
    },
    get: async (o: any) => Buffer.from(objects.get(o.id)!),
    remove: async (id: string) => {
      objects.delete(id);
    },
  };
  const fileApp = createApp(origin, false, storage);
  const staff = request.agent(fileApp);
  await post(staff, "auth/login", {
    email: "admin@test.in",
    password: "Testing-password-123",
  }).expect(200);
  const { Trf } = await import("../src/models.js");
  const trf: any = await Trf.findOne();
  const clientId = String(trf.clientId);
  const folder = (
    await post(staff, "files/folders", {
      clientId,
      name: "Client shared",
      parentId: null,
    }).expect(201)
  ).body;
  const child = (
    await post(staff, "files/folders", {
      clientId,
      name: "Project documents",
      parentId: folder._id,
    }).expect(201)
  ).body;
  await staff
    .patch("/api/files/folders/" + folder._id)
    .set("Origin", origin)
    .send({
      version: 0,
      parentId: child._id,
      name: "Client shared",
      reason: "Invalid cycle",
    })
    .expect(422);
  const pdf = await PDFDocument.create();
  pdf.addPage();
  const data = Buffer.from(await pdf.save());
  const meta = {
    clientId,
    folderId: folder._id,
    name: "instructions.pdf",
    category: "technical",
    source: "client",
    visibility: "report_eligible",
    trfId: String(trf._id),
    sampleId: null,
    size: data.length,
    sha256: hashFile(data),
    reason: "Received from client",
    description: "Client instructions",
  };
  const prepare = async (p: any = {}) =>
    (
      await post(staff, "files/uploads", {
        ...meta,
        requestKey: randomUUID(),
        ...p,
      }).expect(201)
    ).body;
  const send = (id: string, bytes: Buffer) =>
    staff
      .put("/api/files/uploads/" + id)
      .set("Origin", origin)
      .set("Content-Type", "application/octet-stream")
      .send(bytes);
  const first = await prepare();
  await send(first.upload._id, data).expect(200);
  assert.equal(scans, 1);
  assert.equal(puts, 1);
  await send(first.upload._id, data).expect(200);
  assert.equal(puts, 1);
  const dup = await prepare();
  assert.equal(dup.skipped, true);
  const assetId = first.upload.assetId;
  let a: any = await FileAsset.findById(assetId).lean();
  const secondPdf = await PDFDocument.create();
  secondPdf.addPage();
  secondPdf.addPage();
  const next = Buffer.from(await secondPdf.save());
  const second = await prepare({
    assetId,
    assetVersion: a.version,
    size: next.length,
    sha256: hashFile(next),
  });
  await send(second.upload._id, next).expect(200);
  assert.deepEqual(objects.get(first.upload._id), data);
  const wrong = await prepare({
    name: "mismatch.pdf",
    sha256: "a".repeat(64),
    duplicate: "keep",
  });
  await send(wrong.upload._id, data).expect(422);
  assert.equal(
    (await FileVersion.findById(wrong.upload._id))!.status,
    "failed",
  );
  const budgetBefore = (await FileBudget.findById("client-files"))!.bytes;
  const malware = Buffer.concat([data, Buffer.from("MALWARE")]);
  const infected = await prepare({
    name: "infected.pdf",
    size: malware.length,
    sha256: hashFile(malware),
    duplicate: "keep",
  });
  await send(infected.upload._id, malware).expect(502);
  assert.equal(
    (await FileBudget.findById("client-files"))!.bytes,
    budgetBefore,
  );
  assert.equal(puts, 2);
  await request(fileApp)
    .get("/api/files/versions/" + first.upload._id + "/download")
    .expect(401);
  const technician = request.agent(fileApp);
  await post(technician, "auth/login", {
    email: "tech@test.in",
    password: "Testing-password-123",
  }).expect(200);
  await technician.get("/api/files/list?clientId=" + clientId).expect(403);
  const download = await staff
    .get("/api/files/versions/" + first.upload._id + "/download")
    .expect(200);
  assert.deepEqual(download.body, data);
  assert.match(download.headers["content-disposition"], /attachment/);
  const context = (
    await staff.get("/api/consolidated/options/" + trf._id).expect(200)
  ).body;
  const report = (
    await post(staff, "consolidated", {
      trfId: String(trf._id),
      title: "Report with evidence",
      reason: "Capture first evidence version",
      selections: context.tests.map((t: any) => ({
        id: t.id,
        version: t.version,
      })),
      appendixIds: [first.upload._id],
    }).expect(201)
  ).body;
  assert.equal(report.snapshot.appendices[0].revision, 1);
  const reportPdf = await staff
    .get("/api/consolidated/" + report._id + "/pdf")
    .expect(200);
  assert.ok((await PDFDocument.load(reportPdf.body)).getPageCount() >= 6);
  a = await FileAsset.findById(assetId).lean();
  await post(staff, "files/bulk", {
    clientId,
    items: [{ id: assetId, version: a.version }],
    action: "archive",
    reason: "Archive obsolete evidence",
  }).expect(200);
  await post(staff, "files/bulk", {
    clientId,
    items: [{ id: assetId, version: a.version }],
    action: "restore",
    reason: "Stale restore",
  }).expect(409);
  await staff.get("/api/consolidated/" + report._id + "/pdf").expect(200);
  a = await FileAsset.findById(assetId).lean();
  await post(staff, "files/bulk", {
    clientId,
    items: [{ id: assetId, version: a.version }],
    action: "restore",
    reason: "Restore evidence",
  }).expect(200);
  const other: any = await Client.findOne({ _id: { $ne: clientId } });
  await post(staff, "files/uploads", {
    ...meta,
    clientId: String(other._id),
    requestKey: randomUUID(),
  }).expect(422);
  const list = (
    await staff.get("/api/files/list?clientId=" + clientId).expect(200)
  ).body;
  assert.ok(list.total >= 1);
  assert.equal(JSON.stringify(list).includes("providerPath"), false);
});

test("client workspace isolates linked records, paginates and hides restricted billing", async () => {
  const { Trf, Sample, Billing } = await import("../src/models.js");
  const a: any = await Client.create({
      number: "CLI-WORKSPACE-A",
      name: "Workspace A",
    }),
    b: any = await Client.create({
      number: "CLI-WORKSPACE-B",
      name: "Workspace B",
    });
  const trfs = await Trf.insertMany(
    Array.from({ length: 51 }, (_, i) => ({
      number: "TRF-WORKSPACE-" + i,
      clientId: a._id,
      project: "Scoped project " + i,
      site: "Example",
      dueDate: "2026-12-01",
    })),
  );
  await Trf.create({
    number: "TRF-OTHER",
    clientId: b._id,
    project: "Other client secret",
  });
  await Sample.create({
    number: "SMP-WORKSPACE",
    trfId: trfs[0]._id,
    description: "Scoped sample",
    receiptStatus: "quarantined",
  });
  await Billing.create({
    number: "BIL-WORKSPACE",
    clientId: a._id,
    amountMinor: 12345,
    paidMinor: 2345,
    status: "part_paid",
  });
  const path = "/api/clients/" + a._id + "/workspace";
  await request(app).get(path).expect(401);
  const summary = (await admin.get(path).expect(200)).body;
  assert.equal(summary.counts.trfs, 51);
  assert.equal(summary.counts.samples, 1);
  assert.equal(summary.recentRequests.length, 5);
  assert.equal(summary.billing.balanceMinor, 10000);
  assert.equal(summary.attention.quarantined, 1);
  const page1 = (await admin.get(path + "/records?section=trfs").expect(200))
      .body,
    page2 = (await admin.get(path + "/records?section=trfs&page=2").expect(200))
      .body;
  assert.equal(page1.total, 51);
  assert.equal(page1.items.length, 50);
  assert.equal(page2.items.length, 1);
  assert.ok(
    [...page1.items, ...page2.items].every(
      (t: any) => t.clientId._id === String(a._id),
    ),
  );
  assert.equal(
    (await admin.get(path + "/records?section=trfs&q=Other").expect(200)).body
      .total,
    0,
  );
  const techSummary = (await tech.get(path).expect(200)).body;
  assert.equal(techSummary.billing, undefined);
  assert.equal(techSummary.counts.files, undefined);
  await tech.get(path + "/records?section=billing").expect(403);
  await tech.get(path + "/records?section=reports").expect(403);
  await admin
    .get("/api/clients/" + new mongoose.Types.ObjectId() + "/workspace")
    .expect(404);
  await admin.get(path + "/records?section=trfs&page=0").expect(400);
});

test("global search and client activity enforce role and client boundaries", async () => {
  const { Billing, Trf } = await import("../src/models.js");
  const client: any = await Client.findOne({ number: "CLI-WORKSPACE-A" }),
    other: any = await Client.findOne({ number: "CLI-WORKSPACE-B" }),
    bill: any = await Billing.findOne({ clientId: client._id }),
    actor: any = await User.findOne({ email: "admin@test.in" });
  await Audit.create({
    actorId: actor._id,
    entity: "billing",
    entityId: bill._id,
    action: "payment_recorded",
    before: { secret: "private" },
    after: { secret: "private" },
    reason: "Private note",
  });
  const path = "/api/clients/" + client._id + "/workspace/activity";
  const activity = (await admin.get(path).expect(200)).body;
  assert.ok(activity.items.some((r: any) => r.entity === "billing"));
  assert.equal(JSON.stringify(activity).includes("private"), false);
  const restricted = (await tech.get(path).expect(200)).body;
  assert.ok(restricted.items.every((r: any) => r.entity !== "billing"));
  assert.equal(
    (
      await admin
        .get("/api/clients/" + other._id + "/workspace/activity")
        .expect(200)
    ).body.items.some((r: any) => r.entity === "billing"),
    false,
  );
  await request(app).get("/api/search?q=Workspace").expect(401);
  const search = (await admin.get("/api/search?q=Workspace").expect(200)).body;
  assert.ok(
    search.items.some(
      (r: any) => r.kind === "clients" && r.id === String(client._id),
    ),
  );
  assert.equal(
    (await tech.get("/api/search?q=instructions").expect(200)).body.items.some(
      (r: any) => r.kind === "files",
    ),
    false,
  );
  await admin.get("/api/search?q=" + "a".repeat(101)).expect(400);
  assert.equal(
    (await admin.get("/api/search?q=%5B").expect(200)).body.items.length,
    0,
  );
});
