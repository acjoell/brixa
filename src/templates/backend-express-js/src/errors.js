import { inspect } from "node:util";
import { redact } from "./redact.js";

export class ValidationError extends Error {
  constructor(details) {
    super("Bad Request");
    this.name = "ValidationError";
    this.details = details;
  }

  static fromZodError(error) {
    const details = [];
    for (const issue of error.issues) {
      if ("keys" in issue && Array.isArray(issue.keys)) {
        for (const key of issue.keys) {
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

export function parseInput(schema, input) {
  const result = schema.safeParse(input);
  if (!result.success) {
    throw ValidationError.fromZodError(result.error);
  }
  return result.data;
}

export function notFoundHandler(_req, res) {
  res.status(404).json({ error: "Not Found" });
}

const STATUS_MESSAGES = {
  400: "Bad Request",
  401: "Unauthorized",
  403: "Forbidden",
  404: "Not Found",
  413: "Payload Too Large",
};

export function errorHandler(err, _req, res, next) {
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
    typeof err === "object" && err !== null ? Number(err.status ?? err.statusCode) : undefined;

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
