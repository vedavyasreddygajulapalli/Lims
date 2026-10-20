import { Router } from "express";
import { Client, Trf, Sample, Assignment, Method } from "../models.js";
import { allow } from "../domain.js";
export const dashboardRouter = Router();
dashboardRouter.get("/dashboard", async (_req, res) => {
  allow(res.locals.user.roles, [
    "admin",
    "reception",
    "manager",
    "technician",
    "reviewer",
    "signatory",
  ]);
  const start = new Date();
  start.setUTCHours(0, 0, 0, 0);
  start.setUTCDate(start.getUTCDate() - 6);
  const [
    clients,
    trfs,
    samples,
    assignments,
    materials,
    receipt,
    activity,
    states,
    methodsPending,
    recentRequests,
  ] = await Promise.all([
    Client.countDocuments(),
    Trf.countDocuments(),
    Sample.countDocuments(),
    Assignment.countDocuments(),
    Sample.aggregate([{ $group: { _id: "$material", count: { $sum: 1 } } }]),
    Sample.aggregate([
      { $group: { _id: "$receiptStatus", count: { $sum: 1 } } },
    ]),
    Sample.aggregate([
      { $match: { createdAt: { $gte: start } } },
      {
        $group: {
          _id: {
            $dateToString: {
              format: "%Y-%m-%d",
              date: "$createdAt",
              timezone: "UTC",
            },
          },
          count: { $sum: 1 },
        },
      },
    ]),
    Assignment.aggregate([{ $group: { _id: "$status", count: { $sum: 1 } } }]),
    Method.countDocuments({ status: "awaiting_source" }),
    Trf.find()
      .sort({ createdAt: -1 })
      .limit(5)
      .select("number project dueDate")
      .lean(),
  ]);
  const days = Array.from({ length: 7 }, (_, i) => {
    const date = new Date(start);
    date.setUTCDate(date.getUTCDate() + i);
    const key = date.toISOString().slice(0, 10);
    return {
      date: key,
      count: activity.find((a) => a._id === key)?.count ?? 0,
    };
  });
  res.json({
    counts: { clients, trfs, samples, assignments },
    materials: materials.map((m) => ({ name: m._id, count: m.count })),
    receipt: Object.fromEntries(
      ["accepted", "quarantined", "rejected"].map((k) => [
        k,
        receipt.find((r) => r._id === k)?.count ?? 0,
      ]),
    ),
    days,
    draftObservations:
      states.find((s) => s._id === "observations_draft")?.count ?? 0,
    assigned: states.find((s) => s._id === "assigned")?.count ?? 0,
    methodsPending,
    recentRequests,
    timezone: "UTC",
  });
});
