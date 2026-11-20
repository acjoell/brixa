import { z } from "zod";
import { formatConfigError } from "../config.js";

const duration = z
  .string()
  .regex(/^[1-9][0-9]*$/)
  .transform(Number)
  .pipe(z.int().positive());
const schema = z.object({
  SESSION_IDLE_TIMEOUT_MINUTES: duration.default(30),
  SESSION_MAX_LIFETIME_HOURS: duration.default(12),
});

export function parseSessionConfig(env: Record<string, unknown>) {
  const result = schema.safeParse(env);
  if (!result.success) {
    throw formatConfigError(String(result.error.issues[0].path[0]), result.error);
  }
  return {
    idleMs: result.data.SESSION_IDLE_TIMEOUT_MINUTES * 60_000,
    lifetimeMs: result.data.SESSION_MAX_LIFETIME_HOURS * 3_600_000,
  };
}
