import mongoose, { Schema } from "mongoose";
const ref = (model: string) => ({
  type: Schema.Types.ObjectId,
  ref: model,
  required: true,
  immutable: true,
});
const opts = {
  timestamps: true,
  strict: "throw" as const,
  optimisticConcurrency: true,
};
const model = (
  name: string,
  fields: Record<string, unknown>,
  indexes?: Record<string, 1 | -1>,
) => {
  const schema = new Schema(fields as any, opts);
  if (indexes) schema.index(indexes, { unique: true });
  return mongoose.model(name, schema);
};
export const User = model("User", {
  name: { type: String, required: true },
  email: { type: String, required: true, unique: true, lowercase: true },
  passwordHash: { type: String, required: true, select: false },
  roles: { type: [String], required: true },
  active: { type: Boolean, default: true },
  methodIds: { type: [String], default: [] },
  version: { type: Number, default: 0 },
});
const sessionSchema = new Schema({
  tokenHash: { type: String, unique: true },
  userId: ref("User"),
  expiresAt: Date,
});
sessionSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });
export const Session = mongoose.model("Session", sessionSchema);
export const Client = model("Client", {
  number: { type: String, unique: true },
  name: String,
  contact: String,
  email: String,
  phone: String,
  address: String,
});
export const Trf = model("Trf", {
  number: { type: String, unique: true },
  clientId: ref("Client"),
  project: String,
  site: String,
  requestedTests: String,
  dueDate: String,
});
export const Sample = model("Sample", {
  number: { type: String, unique: true },
  trfId: ref("Trf"),
  description: String,
  material: String,
  condition: String,
  storage: String,
  receiptStatus: String,
});
export const Method = model(
  "Method",
  {
    name: String,
    material: String,
    status: {
      type: String,
      enum: ["awaiting_source"],
      default: "awaiting_source",
    },
    version: { type: String, default: "unconfigured" },
    sourceHash: { type: String, default: null },
  },
  { material: 1, name: 1 },
);
export const Assignment = model(
  "Assignment",
  {
    number: { type: String, unique: true },
    sampleId: ref("Sample"),
    methodId: ref("Method"),
    technicianId: ref("User"),
    status: { type: String, default: "assigned" },
    observations: { type: Map, of: String, default: {} },
    draftReportId: {
      type: Schema.Types.ObjectId,
      ref: "Report",
      default: null,
    },
    reviewerId: { type: Schema.Types.ObjectId, ref: "User", default: null },
    authorizedBy: { type: Schema.Types.ObjectId, ref: "User", default: null },
    equipmentId: {
      type: Schema.Types.ObjectId,
      ref: "Equipment",
      default: null,
    },
    version: { type: Number, default: 0 },
  },
  { sampleId: 1, methodId: 1 },
);
export const Audit = model("Audit", {
  actorId: ref("User"),
  entity: String,
  entityId: Schema.Types.ObjectId,
  action: String,
  before: Schema.Types.Mixed,
  after: Schema.Types.Mixed,
  reason: String,
});
export const Equipment = model("Equipment", {
  number: { type: String, unique: true },
  name: String,
  serial: String,
  location: String,
  calibrationDue: String,
  status: String,
  certificateReference: String,
  version: { type: Number, default: 0 },
});
export const Quality = model("Quality", {
  number: { type: String, unique: true },
  title: String,
  type: String,
  sampleId: String,
  owner: String,
  dueDate: String,
  status: String,
  description: String,
  rootCause: String,
  correction: String,
  correctiveAction: String,
  effectiveness: String,
  version: { type: Number, default: 0 },
});
export const Billing = model("Billing", {
  number: { type: String, unique: true },
  clientId: ref("Client"),
  description: String,
  amountMinor: Number,
  dueDate: String,
  paidMinor: { type: Number, default: 0 },
  payments: { type: [Schema.Types.Mixed], default: [] },
  status: { type: String, default: "unpaid" },
  version: { type: Number, default: 0 },
});
export const Document = model("Document", {
  number: { type: String, unique: true },
  title: String,
  reference: String,
  revision: String,
  owner: String,
  reviewDue: String,
  status: String,
  location: String,
  version: { type: Number, default: 0 },
});
export const Report = model(
  "Report",
  {
    number: { type: String, required: true },
    assignmentId: ref("Assignment"),
    revision: { type: Number, required: true },
    status: {
      type: String,
      enum: ["draft", "superseded", "withdrawn"],
      default: "draft",
    },
    snapshot: { type: Schema.Types.Mixed, immutable: true },
    reason: String,
    version: { type: Number, default: 0 },
  },
  { number: 1, revision: 1 },
);

export const operationModels = {
  equipment: Equipment,
  quality: Quality,
  billing: Billing,
  documents: Document,
};
export const Consolidated = model("Consolidated",{number:{type:String,required:true},trfId:ref("Trf"),revision:{type:Number,required:true},status:{type:String,enum:["draft","superseded","withdrawn"],default:"draft"},snapshot:{type:Schema.Types.Mixed,immutable:true},reason:String,version:{type:Number,default:0}},{number:1,revision:1});
export const Counter = mongoose.model(
  "Counter",
  new Schema({ _id: String, value: Number }),
);
export const collections = {
  clients: Client,
  trfs: Trf,
  samples: Sample,
  assignments: Assignment,
};
export async function nextNumber(
  prefix: string,
  session: mongoose.ClientSession,
) {
  const counter = await Counter.findOneAndUpdate(
    { _id: prefix },
    { $inc: { value: 1 } },
    { new: true, session },
  );
  if (!counter) throw new Error("Numbering counter is not initialized");
  return `${prefix}-${String(counter!.value).padStart(6, "0")}`;
}
export async function initialize() {
  for (const prefix of [
    "CLI",
    "TRF",
    "SMP",
    "TST",
    "EQP",
    "QLT",
    "BIL",
    "DOC",
    "RPT", "CTR",
  ])
    await Counter.updateOne(
      { _id: prefix },
      { $setOnInsert: { value: 0 } },
      { upsert: true },
    );
  await Promise.all(
    [
      User,
      Session,
      Client,
      Trf,
      Sample,
      Method,
      Assignment,
      Audit,
      Counter,
      Equipment,
      Quality,
      Billing,
      Document,
      Report, Consolidated,
    ].map((m) => m.init()),
  );
}
export async function seedCatalogue() {
  for (const [material, name] of [
    ["Soil", "Moisture content"],
    ["Concrete", "Cube compressive strength"],
    ["Aggregates", "Sieve analysis"],
    ["Road materials", "Marshall test"],
    ["Cement", "Compressive strength"],
    ["Steel", "Tensile properties"],
    ["Water", "Parameter-specific tests"],
  ])
    await Method.updateOne(
      { material, name },
      {
        $setOnInsert: {
          material,
          name,
          status: "awaiting_source",
          version: "unconfigured",
          sourceHash: null,
        },
      },
      { upsert: true },
    );
}
