import { Router } from "express";
import { z } from "zod";
import { searchFields, fileAccess, type SearchKind } from "@lims/core";
import { Client, Trf, Sample, Assignment } from "../models.js";
import { FileAsset } from "../files/models.js";
import { escapeRegex } from "../services/search.js";
export const productivityRouter = Router();
productivityRouter.get("/search", async (req, res) => {
  const { q } = z
    .object({ q: z.string().trim().max(100).default("") })
    .strict()
    .parse(req.query);
  res.setHeader("Cache-Control", "no-store");
  if (q.length < 2) return res.json({ items: [] });
  const roles: string[] = res.locals.user.roles,
    read = roles.some((r) =>
      [
        "admin",
        "manager",
        "reception",
        "technician",
        "reviewer",
        "signatory",
      ].includes(r),
    );
  const models = {
    clients: Client,
    trfs: Trf,
    samples: Sample,
    assignments: Assignment,
    files: FileAsset,
  };
  const groups = await Promise.all(
    (Object.keys(models) as SearchKind[]).map(async (kind) => {
      if (kind !== "files" && !read) return [];
      const categories = [
        "general",
        "technical",
        "commercial",
        "report",
        "photo",
      ].filter((c) => fileAccess(roles, c));
      if (kind === "files" && !categories.length) return [];
      const filter = {
        ...(kind === "files"
          ? { archived: false, category: { $in: categories } }
          : {}),
        $or: searchFields[kind].map((k) => ({
          [k]: { $regex: escapeRegex(q), $options: "i" },
        })),
      };
      const rows: any[] = await (models[kind] as any)
        .find(filter)
        .select("number name project description material status clientId")
        .sort({ updatedAt: -1, _id: -1 })
        .limit(10)
        .lean();
      return rows.map((r) => ({
        id: String(r._id),
        kind,
        label: String(r.number ?? r.name),
        detail: String(r.name ?? r.project ?? r.description ?? r.status ?? ""),
        ...(r.clientId ? { clientId: String(r.clientId) } : {}),
      }));
    }),
  );
  res.json({ items: groups.flat(), limitPerType: 10 });
});
