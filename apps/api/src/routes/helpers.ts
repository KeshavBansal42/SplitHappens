import type { z } from "zod";
import { ApiError } from "../errors.js";

export function throwZodError(err: z.ZodError): never {
  const details = err.issues.map((issue) => ({
    path: issue.path.join("."),
    message: issue.message,
  }));
  throw new ApiError("VALIDATION_ERROR", "Invalid request body", details);
}

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
