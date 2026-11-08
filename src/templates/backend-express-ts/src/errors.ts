import { inspect } from "node:util";
import type { Request, Response, NextFunction } from "express";
import { z } from "zod";
import { redact } from "./redact.js";

export interface ValidationIssue {
  path: string;
  code: string;
}

export class ValidationError extends Error {
  readonly details: ValidationIssue[];

  constructor(details: ValidationIssue[]) {
    super("Bad Request");
    this.name = "ValidationError";
    this.details = details;
  }

  static fromZodError(error: z.ZodError): ValidationError {
    const details: ValidationIssue[] = [];
    for (const issue of error.issues) {
      if ("keys" in issue && Array.isArray((issue as { keys: string[] }).keys)) {
        for (const key of (issue as { keys: string[] }).keys) {
          const fullPath = issue.path.length > 0 ? `${issue.path.join(".")}.${key}` : key;
          details.push({ path: fullPath, code: issue.code });
        }
      } else {
        details.push({
          path: issue.path.join("."),
          code: issue.code,
        });
      }
    }
    return new ValidationError(details);
  }
}

export function parseInput<T>(schema: z.ZodType<T>, input: unknown): T {
  const result = schema.safeParse(input);
  if (!result.success) {
    throw ValidationError.fromZodError(result.error);
  }
  return result.data;
}

export function notFoundHandler(_req: Request, res: Response): void {
  res.status(404).json({ error: "Not Found" });
}

const STATUS_MESSAGES: Record<number, string> = {
  400: "Bad Request",
  401: "Unauthorized",
  403: "Forbidden",
  404: "Not Found",
  413: "Payload Too Large",
};

export function errorHandler(err: unknown, _req: Request, res: Response, next: NextFunction): void {
  if (res.headersSent) {
    next(err);
    return;
  }

  console.error(redact(inspect(err, { depth: 5 })));

  if (err instanceof ValidationError) {
    res.status(400).json({
      error: "Bad Request",
      details: err.details,
    });
    return;
  }

  const status =
    typeof err === "object" && err !== null
      ? Number(
          (err as { status?: unknown; statusCode?: unknown }).status ??
            (err as { status?: unknown; statusCode?: unknown }).statusCode,
        )
      : undefined;

  if (status && status in STATUS_MESSAGES) {
    res.status(status).json({
      error: STATUS_MESSAGES[status],
    });
    return;
  }

  res.status(500).json({
    error: "Internal Server Error",
  });
}
