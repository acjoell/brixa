import { z } from "zod";
import { formatConfigError } from "../config.js";

const key = "ACTIVATION_TOKEN_EXPIRY_HOURS";
const schema = z.object({
  [key]: z
    .string()
    .regex(/^[1-9][0-9]*$/)
    .transform(Number)
    .pipe(z.int().min(1).max(168))
    .default(24),
});

export function parseActivationExpiryHours(env) {
  const result = schema.safeParse(env);
  if (!result.success) throw formatConfigError(key, result.error);
  return result.data[key];
}
