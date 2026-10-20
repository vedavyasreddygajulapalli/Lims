import { Router } from "express";
import { z } from "zod";
import { Audit } from "../models.js";
import { allow } from "../domain.js";
export const auditRouter = Router();
const router = auditRouter;
router.get("/audit", async (req, res) => {
  allow(res.locals.user.roles, ["admin", "manager", "reviewer"]);
  const page = z.coerce
    .number()
    .int()
    .min(1)
    .max(100000)
    .parse(req.query.page ?? 1);
  res.json({
    items: await Audit.find()
      .sort({ createdAt: -1, _id: -1 })
      .skip((page - 1) * 50)
      .limit(50)
      .lean(),
    total: await Audit.countDocuments(),
    page,
  });
});
