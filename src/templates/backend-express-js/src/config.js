import { z } from "zod";

const DEFAULT_PORT = 3000;

export const portSchema = z.preprocess(
  (val) => {
    if (val === undefined || val === "") {
      return DEFAULT_PORT;
    }
    if (typeof val === "string") {
      return Number(val);
    }
    return val;
  },
  z
    .number({ message: "Debe ser un número entero entre 0 y 65535." })
    .int("Debe ser un número entero entre 0 y 65535.")
    .min(0, "Debe ser un número entero entre 0 y 65535.")
    .max(65535, "Debe ser un número entero entre 0 y 65535."),
);

export const strictBooleanSchema = z.union(
  [z.boolean(), z.enum(["true", "false"]).transform((v) => v === "true")],
  { message: 'Debe ser "true" o "false".' },
);

export function formatConfigError(name, error) {
  const issue = error.issues[0];
  const message = issue ? issue.message : "Valor inválido.";
  return new Error(`Error de configuración en ${name}: ${message}`);
}

const baseConfigSchema = z.object({
  PORT: portSchema,
});

export function parseConfig(env = process.env) {
  const result = baseConfigSchema.safeParse(env);
  if (!result.success) {
    throw formatConfigError("PORT", result.error);
  }
  return {
    port: result.data.PORT,
  };
}
