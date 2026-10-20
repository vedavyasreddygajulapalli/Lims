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
