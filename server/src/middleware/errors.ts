import express, { type ErrorRequestHandler } from "express";
import { ZodError } from "zod";
import { DomainError } from "../domain.js";
export const errorHandler: ErrorRequestHandler = (
  err: any,
  _req: express.Request,
  res: express.Response,
  _next: express.NextFunction,
) => {
  if (err instanceof ZodError)
    return res.status(400).json({
      error: err.issues
        .map((i) => `${i.path.join(".")}: ${i.message}`)
        .join("; "),
    });
  if (err instanceof DomainError)
    return res.status(err.status).json({ error: err.message });
  if (err.code === 11000)
    return res.status(409).json({ error: "Duplicate record or assignment" });
  if (err.type === "entity.parse.failed")
    return res.status(400).json({ error: "Invalid JSON" });
  console.error(err.name, err.message);
  return res
    .status(500)
    .json({ error: "Request failed; no partial changes were saved" });
};
