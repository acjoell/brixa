import { z } from "zod";
import { formatConfigError } from "../config.js";

const decimal = z
  .string()
  .regex(/^(0|[1-9][0-9]*)$/, "Debe ser un entero decimal.")
  .transform(Number);
const configSchema = z.object({
  ARGON2_MAX_CONCURRENT: decimal.pipe(z.int().positive()).default(2),
  ARGON2_MAX_QUEUE: decimal.pipe(z.int().nonnegative()).default(8),
});

export class Argon2SaturatedError extends Error {
  code = "ARGON2_SATURATED";

  constructor() {
    super("ARGON2_SATURATED");
    this.name = "Argon2SaturatedError";
  }
}

export function createArgon2Limiter(env) {
  const config = configSchema.safeParse(env);
  if (!config.success) {
    throw formatConfigError(String(config.error.issues[0].path[0]), config.error);
  }
  const { ARGON2_MAX_CONCURRENT: capacity, ARGON2_MAX_QUEUE: queueLimit } = config.data;
  let active = 0;
  const waiting = [];

  return async function run(operation) {
    if (active < capacity) {
      active++;
    } else {
      if (waiting.length >= queueLimit) throw new Argon2SaturatedError();
      await new Promise((resolve) => waiting.push(resolve));
    }
    try {
      return await operation();
    } finally {
      // Transferir la plaza al primero en espera antes de admitir otra solicitud.
      const next = waiting.shift();
      if (next) next();
      else active--;
    }
  };
}

let shared;
export function getArgon2Limiter() {
  return (shared ??= createArgon2Limiter(process.env));
}
