import mongoose, { Schema } from "mongoose";
const opts = { timestamps: true, strict: "throw" as const };
const id = { type: Schema.Types.ObjectId, required: true };
const folderSchema = new Schema(
  {
    clientId: id,
    parentId: { type: Schema.Types.ObjectId, default: null },
    name: String,
    key: String,
    version: { type: Number, default: 0 },
  },
  opts,
);
folderSchema.index({ clientId: 1, parentId: 1, key: 1 }, { unique: true });
export const FileFolder = mongoose.model("FileFolder", folderSchema);
const assetSchema = new Schema(
  {
    clientId: id,
    folderId: { type: Schema.Types.ObjectId, default: null },
    name: String,
    description: String,
    category: String,
    source: String,
    visibility: { type: String, default: "internal" },
    trfId: { type: Schema.Types.ObjectId, default: null },
    sampleId: { type: Schema.Types.ObjectId, default: null },
    archived: { type: Boolean, default: false },
    version: { type: Number, default: 0 },
    nextRevision: { type: Number, default: 0 },
    currentId: { type: Schema.Types.ObjectId, default: null },
    activeUpload: { type: Schema.Types.ObjectId, default: null },
  },
  opts,
);
assetSchema.index({ clientId: 1, folderId: 1, archived: 1 });
export const FileAsset = mongoose.model("FileAsset", assetSchema);
const revSchema = new Schema(
  {
    assetId: id,
    clientId: id,
    revision: Number,
    name: String,
    mime: String,
    pageCount: Number,
    size: Number,
    sha256: String,
    requestKey: { type: String, unique: true },
    status: {
      type: String,
      enum: ["pending", "processing", "ready", "failed", "cleanup"],
      default: "pending",
    },
    uploadedBy: id,
    uploaderName: String,
    reason: String,
    providerId: String,
    providerPath: String,
    error: String,
  },
  opts,
);
revSchema.index({ assetId: 1, revision: 1 }, { unique: true });
export const FileVersion = mongoose.model("FileVersion", revSchema);
export const FileBudget = mongoose.model(
  "FileBudget",
  new Schema(
    {
      _id: String,
      bytes: { type: Number, default: 0 },
      folderLock: { type: Number, default: 0 },
    },
    opts,
  ),
);
export async function initializeFiles() {
  await Promise.all([
    FileFolder.init(),
    FileAsset.init(),
    FileVersion.init(),
    FileBudget.init(),
  ]);
  await FileBudget.updateOne(
    { _id: "client-files" },
    { $setOnInsert: { bytes: 0, folderLock: 0 } },
    { upsert: true },
  );
}
