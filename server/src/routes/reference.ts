import { Router } from "express";
import {
  referenceSource,
  referenceStrength,
  verifyReference,
} from "@lims/core";
import { allow } from "../domain.js";
export const referenceRouter = Router();
referenceRouter.use("/reference", (_req, res, next) => {
  allow(res.locals.user.roles, [
    "admin",
    "manager",
    "technician",
    "reviewer",
    "signatory",
  ]);
  next();
});
referenceRouter.get("/reference", (_req, res) =>
  res.json({ source: referenceSource, checks: verifyReference() }),
);
referenceRouter.post("/reference/calculate", (req, res) =>
  res.json(referenceStrength(req.body)),
);
