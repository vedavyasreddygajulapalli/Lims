import { productivityRouter } from "./routes/productivity.js";
import { clientWorkspaceRouter } from "./routes/client-workspace.js";
import { fileRouter } from "./files/router.js";
import { SupabaseStorage, type FileStorage } from "./files/storage.js";
import { consolidatedRouter } from "./routes/consolidated.js";
import express from "express";
import helmet from "helmet";
import cookieParser from "cookie-parser";
import mongoose from "mongoose";
import { authRouter } from "./routes/auth.js";
import { usersRouter } from "./routes/users.js";
import { registersRouter } from "./routes/registers.js";
import { observationsRouter } from "./routes/observations.js";
import { auditRouter } from "./routes/audit.js";
import { dashboardRouter } from "./routes/dashboard.js";
import { referenceRouter } from "./routes/reference.js";
import { errorHandler } from "./middleware/errors.js";
import { workflowRouter } from "./routes/workflow.js";
import { operationsRouter } from "./routes/operations.js";
export function createApp(
  origin: string,
  production = false,
  storage: FileStorage = new SupabaseStorage(),
) {
  const app = express();
  app.disable("x-powered-by");
  app.use(helmet());
  app.use(express.json({ limit: "64kb" }));
  app.use(cookieParser());
  app.use("/api", (req, res, next) => {
    if (
      !["GET", "HEAD", "OPTIONS"].includes(req.method) &&
      req.get("origin") !== origin
    )
      return res.status(403).json({ error: "Request origin is not permitted" });
    next();
  });
  app.get("/api/health", (_req, res) =>
    res.status(mongoose.connection.readyState === 1 ? 200 : 503).json({
      status:
        mongoose.connection.readyState === 1 ? "ready" : "database_unavailable",
    }),
  );
  app.use(
    "/api",
    authRouter(production),
    usersRouter,
    dashboardRouter,
    referenceRouter,
    fileRouter(storage),
    consolidatedRouter(storage),
    workflowRouter,
    operationsRouter,
    productivityRouter,
    clientWorkspaceRouter,
    registersRouter,
    observationsRouter,
    auditRouter,
  );
  app.use((_req, res) => res.status(404).json({ error: "Endpoint not found" }));
  app.use(errorHandler);
  return app;
}
