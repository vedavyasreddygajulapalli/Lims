import { Router } from "express";
import {
  clientSections,
  clientRecordsQuery,
  objectId,
  fileAccess,
  type ClientSection,
} from "@lims/core";
import {
  Client,
  Trf,
  Sample,
  Assignment,
  Report,
  Consolidated,
  Billing,
  Quality,
} from "../models.js";
import { FileAsset } from "../files/models.js";
import { allow, DomainError } from "../domain.js";
import { escapeRegex } from "../services/search.js";
export const clientWorkspaceRouter = Router();
const models = {
  trfs: Trf,
  samples: Sample,
  assignments: Assignment,
  reports: Report,
  consolidated: Consolidated,
  billing: Billing,
  quality: Quality,
};
const populates = {
  trfs: "clientId",
  samples: "trfId",
  assignments: "sampleId methodId technicianId",
  reports: "assignmentId",
  consolidated: "trfId",
  billing: "",
  quality: "",
};
async function context(id: string, roles: string[]) {
  allow(roles, [
    "admin",
    "manager",
    "reception",
    "technician",
    "reviewer",
    "signatory",
  ]);
  const client: any = await Client.findById(objectId.parse(id)).lean();
  if (!client) throw new DomainError(404, "Client not found");
  const trfs = await Trf.find({ clientId: id }).distinct("_id");
  const samples = await Sample.find({ trfId: { $in: trfs } }).distinct("_id");
  const assignments = await Assignment.find({
    sampleId: { $in: samples },
  }).distinct("_id");
  const filters: Record<ClientSection, any> = {
    trfs: { clientId: id },
    samples: { trfId: { $in: trfs } },
    assignments: { sampleId: { $in: samples } },
    reports: { assignmentId: { $in: assignments } },
    consolidated: { trfId: { $in: trfs } },
    billing: { clientId: id },
    quality: { sampleId: { $in: samples.map(String) } },
    files: {
      clientId: id,
      archived: false,
      category: {
        $in: ["general", "technical", "commercial", "report", "photo"].filter(
          (c) => fileAccess(roles, c),
        ),
      },
    },
  };
  return { client, filters, sections: clientSections(roles) };
}
clientWorkspaceRouter.get("/clients/:id/workspace", async (req, res) => {
  res.setHeader("Cache-Control", "no-store");
  const { client, filters, sections } = await context(
    String(req.params.id),
    res.locals.user.roles,
  );
  const counts = Object.fromEntries(
    await Promise.all(
      sections.map(async (key) => [
        key,
        await (key === "files" ? FileAsset : models[key]).countDocuments(
          filters[key],
        ),
      ]),
    ),
  );
  const recentRequests = await Trf.find(filters.trfs)
    .sort({ createdAt: -1, _id: -1 })
    .limit(5)
    .lean();
  const attention = {
    awaitingReview: await Assignment.countDocuments({
      ...filters.assignments,
      status: "awaiting_review",
    }),
    quarantined: await Sample.countDocuments({
      ...filters.samples,
      receiptStatus: "quarantined",
    }),
  };
  let billing;
  if (sections.includes("billing")) {
    const [totals] = await Billing.aggregate([
      { $match: { clientId: client._id } },
      {
        $group: {
          _id: null,
          charged: { $sum: "$amountMinor" },
          paid: { $sum: "$paidMinor" },
        },
      },
    ]);
    billing = {
      chargedMinor: totals?.charged ?? 0,
      paidMinor: totals?.paid ?? 0,
      balanceMinor: (totals?.charged ?? 0) - (totals?.paid ?? 0),
    };
  }
  res.json({
    client,
    sections,
    counts,
    recentRequests,
    attention,
    ...(billing ? { billing } : {}),
  });
});
clientWorkspaceRouter.get(
  "/clients/:id/workspace/records",
  async (req, res) => {
    res.setHeader("Cache-Control", "no-store");
    const { section, page, q } = clientRecordsQuery.parse(req.query);
    // Enforce the section before querying client relationships or sensitive records.
    if (!clientSections(res.locals.user.roles).includes(section))
      throw new DomainError(403, "Your role cannot view this client section");
    const { filters } = await context(
      String(req.params.id),
      res.locals.user.roles,
    );
    const fields: Record<string, string[]> = {
      trfs: ["number", "project", "site"],
      samples: ["number", "description", "material"],
      assignments: ["number", "status"],
      reports: ["number", "status"],
      consolidated: ["number", "status", "snapshot.title"],
      billing: ["number", "description", "status"],
      quality: ["number", "title", "status"],
    };
    const filter = {
      ...filters[section],
      ...(q
        ? {
            $or: fields[section].map((k) => ({
              [k]: { $regex: escapeRegex(q), $options: "i" },
            })),
          }
        : {}),
    };
    const Model = models[section];
    res.json({
      items: await Model.find(filter)
        .populate(populates[section])
        .sort({ createdAt: -1, _id: -1 })
        .skip((page - 1) * 50)
        .limit(50)
        .lean(),
      total: await Model.countDocuments(filter),
      page,
    });
  },
);
