/**
 * Shared express helpers for the routes.
 */

import type { RequestHandler } from "express";
import type { z } from "zod";
import { ApiError } from "../errors.js";

/**
 * Wraps an async route handler so rejections reach the error middleware
 * (express 5 already forwards rejected promises, but keeping this explicit
 * makes the handler signatures uniform).
 */
export function asyncHandler(
  fn: (req: Parameters<RequestHandler>[0], res: Parameters<RequestHandler>[1], next: Parameters<RequestHandler>[2]) => Promise<void>,
): RequestHandler {
  return (req, res, next) => {
    void fn(req, res, next).catch(next);
  };
}

/** Throws a VALIDATION_ERROR shaped from a zod error. */
export function throwZodError(err: z.ZodError): never {
  const details = err.issues.map((issue) => ({
    path: issue.path.join("."),
    message: issue.message,
  }));
  throw new ApiError("VALIDATION_ERROR", "Invalid request body", details);
}

/** Parses a validated body against a zod schema or throws a 422. */
export function parseBody<T extends z.ZodTypeAny>(
  schema: T,
  body: unknown,
): z.infer<T> {
  const result = schema.safeParse(body);
  if (!result.success) {
    throwZodError(result.error);
  }
  return result.data;
}
