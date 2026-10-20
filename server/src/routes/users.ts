import { userCreateInput, userAccessInput } from "@lims/core";
import { Router } from "express";
import mongoose from "mongoose";
import { z } from "zod";
import { User, Audit, Session, Method } from "../models.js";
import { roles, allow, DomainError } from "../domain.js";
import { hashPassword } from "../security.js";
export const usersRouter = Router();
const router = usersRouter;
router.get("/users", async (_req, res) => {
  allow(res.locals.user.roles, ["admin", "manager"]);
  res.json(
    await User.find()
      .select("name roles email active methodIds version")
      .lean(),
  );
});
router.post("/users", async (req, res) => {
  allow(res.locals.user.roles, ["admin"]);
  const input = userCreateInput.parse(req.body);
  const passwordHash = await hashPassword(input.password);
  let out: any;
  await mongoose.connection.transaction(async (session) => {
    const [u] = await User.create(
      [
        {
          name: input.name,
          email: input.email.toLowerCase(),
          roles: input.roles,
          passwordHash,
        },
      ],
      { session },
    );
    out = { id: u._id, name: u.name, roles: u.roles };
    await Audit.create(
      [
        {
          actorId: res.locals.user._id,
          entity: "users",
          entityId: u._id,
          action: "create",
          after: out,
        },
      ],
      { session },
    );
  });
  res.status(201).json(out);
});

router.patch("/users/:id", async (req, res) => {
  allow(res.locals.user.roles, ["admin"]);
  const id = z
    .string()
    .regex(/^[a-f0-9]{24}$/i)
    .parse(req.params.id);
  const input = userAccessInput.parse(req.body);
  if (id === String(res.locals.user._id))
    throw new DomainError(
      409,
      "Use another administrator to change your own access",
    );
  if (new Set(input.methodIds).size !== input.methodIds.length)
    throw new DomainError(422, "Duplicate methods");
  let result: any;
  await mongoose.connection.transaction(async (session) => {
    if (
      (await Method.countDocuments({ _id: { $in: input.methodIds } }).session(
        session,
      )) !== input.methodIds.length
    )
      throw new DomainError(422, "Unknown method");
    const before = await User.findById(id).session(session).lean();
    result = await User.findOneAndUpdate(
      { _id: id, version: input.version },
      {
        $set: {
          roles: input.roles,
          active: input.active,
          methodIds: input.methodIds,
        },
        $inc: { version: 1 },
      },
      { new: true, session },
    )
      .select("name email roles active methodIds version")
      .lean();
    if (!result) throw new DomainError(409, "User changed. Reload.");
    await Session.deleteMany({ userId: id }, { session });
    await Audit.create(
      [
        {
          actorId: res.locals.user._id,
          entity: "users",
          entityId: id,
          action: "access_changed",
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
