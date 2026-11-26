import { z } from "zod";
import { isPasswordWithinLimits, maxCodePoints, maxUtf8Bytes } from "./password-limits.js";

const projectName = "brixa-tpl";
const length = z
  .string()
  .regex(/^\d+$/)
  .transform(Number)
  .pipe(z.number().int().min(8).max(maxCodePoints));
const settings = z
  .object({
    AUTH_PASSWORD_MIN_LENGTH: length.optional(),
    AUTH_PASSWORD_MAX_LENGTH: length.optional(),
  })
  .refine(
    (values) => (values.AUTH_PASSWORD_MIN_LENGTH ?? 10) <= (values.AUTH_PASSWORD_MAX_LENGTH ?? 64),
  );

export function parsePasswordPolicy(env = process.env) {
  const result = settings.safeParse(env);
  if (!result.success)
    throw new Error(
      "AUTH_PASSWORD_MIN_LENGTH y AUTH_PASSWORD_MAX_LENGTH deben ser enteros de 8 a 128 y el mínimo no puede superar el máximo.",
    );
  return {
    minLength: result.data.AUTH_PASSWORD_MIN_LENGTH ?? 10,
    maxLength: result.data.AUTH_PASSWORD_MAX_LENGTH ?? 64,
    maxBytes: maxUtf8Bytes,
  };
}

export class PasswordPolicyError extends Error {
  constructor() {
    super("PASSWORD_POLICY");
    this.name = "PasswordPolicyError";
  }
}

export function acceptsNewPassword(password, email, policy) {
  if (!isPasswordWithinLimits(password)) return false;
  const size = [...password].length;
  if (size < policy.minLength || size > policy.maxLength) return false;
  return ![email, email.slice(0, email.lastIndexOf("@")), projectName].some((identity) => {
    const escaped = identity.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    return new RegExp(escaped, "iu").exec(password)?.[0] === password;
  });
}
