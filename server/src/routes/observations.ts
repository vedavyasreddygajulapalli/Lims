import { Router } from "express";
import mongoose from "mongoose";
import { Assignment, Audit } from "../models.js";
import { allow, DomainError, observationInput, calculate } from "../domain.js";
export const observationsRouter = Router();
const router = observationsRouter;
router.patch("/assignments/:id/observations", async (req, res) => {
  allow(res.locals.user.roles, ["technician"]);
  if (!mongoose.isValidObjectId(req.params.id))
    throw new DomainError(400, "Invalid record ID");
  const input = observationInput.parse(req.body);
  let result: any;
  await mongoose.connection.transaction(async (session) => {
    const before: any = await Assignment.findById(req.params.id)
      .session(session)
      .lean();
    if (!before) throw new DomainError(404, "Assignment not found");
    if (String(before.technicianId) !== String(res.locals.user._id))
      throw new DomainError(
        403,
        "Only the assigned technician can enter observations",
      );
    result = await Assignment.findOneAndUpdate(
      {
        _id: req.params.id,
        version: input.version,
        status: { $in: ["assigned", "observations_draft", "returned"] },
      },
      {
        $set: {
          observations: input.observations,
          status: "observations_draft",
          reviewerId: null,
          authorizedBy: null,
        },
        $inc: { version: 1 },
      },
      { new: true, session, runValidators: true },
    ).lean();
    if (!result)
      throw new DomainError(
        409,
        "Record changed or locked. Reload before editing.",
      );
    await Audit.create(
      [
        {
          actorId: res.locals.user._id,
          entity: "assignments",
          entityId: result._id,
          action: "save_observations",
          before,
          after: result,
          reason: input.reason,
        },
      ],
      { session },
    );
  });
  res.json(result);
});
router.post("/assignments/:id/calculate", (_req, res) => {
  allow(res.locals.user.roles, ["technician", "reviewer"]);
  calculate();
});
