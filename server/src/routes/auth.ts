import mongoose from "mongoose";
import { hashPassword } from "../security.js";
import { Router } from "express";
import { z } from "zod";
import { User, Session, Audit } from "../models.js";
import { DomainError } from "../domain.js";
import { verifyPassword, digest, newToken } from "../security.js";
import rateLimit from "express-rate-limit";
export function authRouter(production: boolean) {
  const router = Router();
  const cookie = {
    httpOnly: true,
    sameSite: "strict" as const,
    secure: production,
    path: "/api",
    maxAge: 8 * 3600 * 1000,
  };
  router.post(
    "/auth/login",
    rateLimit({
      windowMs: 15 * 60 * 1000,
      limit: 10,
      standardHeaders: "draft-8",
      legacyHeaders: false,
    }),
    async (req, res) => {
      const body = z
        .object({
          email: z.string().email(),
          password: z.string().min(1).max(256),
        })
        .strict()
        .parse(req.body);
      const user = await User.findOne({
        email: body.email.toLowerCase(),
        active: true,
      }).select("+passwordHash");
      if (
        !user ||
        !(await verifyPassword(body.password, String(user.passwordHash)))
      )
        throw new DomainError(401, "Invalid email or password");
      const token = newToken();
      await Session.create({
        tokenHash: digest(token),
        userId: user._id,
        expiresAt: new Date(Date.now() + cookie.maxAge),
      });
      res
        .cookie("lims_session", token, cookie)
        .json({ id: user._id, name: user.name, roles: user.roles });
    },
  );
  router.use(async (req, res, next) => {
    const token = req.cookies.lims_session;
    if (typeof token !== "string")
      throw new DomainError(401, "Sign in to continue");
    const session = await Session.findOne({
      tokenHash: digest(token),
      expiresAt: { $gt: new Date() },
    });
    const user =
      session && (await User.findOne({ _id: session.userId, active: true }));
    if (!user) throw new DomainError(401, "Session expired");
    res.locals.user = user;
    next();
  });
  router.get("/auth/me", (_req, res) => {
    const u = res.locals.user;
    res.json({ id: u._id, name: u.name, roles: u.roles });
  });
  router.post("/auth/logout", async (req, res) => {
    await Session.deleteOne({ tokenHash: digest(req.cookies.lims_session) });
    res
      .clearCookie("lims_session", {
        path: "/api",
        httpOnly: true,
        sameSite: "strict",
        secure: production,
      })
      .sendStatus(204);
  });

  router.post(
    "/auth/password",
    rateLimit({ windowMs: 15 * 60 * 1000, limit: 5 }),
    async (req, res) => {
      const input = z
        .object({
          currentPassword: z.string().min(1).max(128),
          newPassword: z.string().min(12).max(128),
        })
        .strict()
        .parse(req.body);
      const user = await User.findById(res.locals.user._id).select(
        "+passwordHash",
      );
      if (
        !user ||
        !(await verifyPassword(
          input.currentPassword,
          String(user.passwordHash),
        ))
      )
        throw new DomainError(403, "Current password is incorrect");
      const passwordHash = await hashPassword(input.newPassword);
      await mongoose.connection.transaction(async (session) => {
        const updated = await User.updateOne(
          { _id: user._id, passwordHash: user.passwordHash },
          { $set: { passwordHash }, $inc: { version: 1 } },
          { session },
        );
        if (!updated.modifiedCount)
          throw new DomainError(409, "Account changed; sign in again");
        await Session.deleteMany({ userId: user._id }, { session });
        await Audit.create(
          [
            {
              actorId: user._id,
              entity: "users",
              entityId: user._id,
              action: "password_changed",
              reason: "Account owner changed password",
            },
          ],
          { session },
        );
      });
      res
        .clearCookie("lims_session", {
          path: "/api",
          httpOnly: true,
          sameSite: "strict",
          secure: production,
        })
        .sendStatus(204);
    },
  );
  return router;
}
