import { URL } from "node:url";
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

export const corsAllowedOriginsSchema = z.preprocess(
  (val) => {
    if (val === undefined || val === null || val === "") {
      return [];
    }
    if (typeof val === "string") {
      const trimmed = val.trim();
      if (trimmed === "") {
        return [];
      }
      return trimmed.split(",").map((s) => s.trim());
    }
    return val;
  },
  z.array(
    z.string().refine(
      (origin) => {
        if (!origin || origin === "null" || origin.includes("*")) {
          return false;
        }
        try {
          const parsed = new URL(origin);
          return (
            (parsed.protocol === "http:" || parsed.protocol === "https:") &&
            parsed.origin === origin
          );
        } catch {
          return false;
        }
      },
      {
        message:
          "Cada origen debe ser una URL HTTP o HTTPS válida sin rutas, barras finales ni comodines.",
      },
    ),
    {
      message: "Debe ser una lista de orígenes HTTP o HTTPS válidos separados por comas.",
    },
  ),
);

export function formatConfigError(name, error) {
  const issue = error.issues[0];
  const message = issue ? issue.message : "Valor inválido.";
  return new Error(`Error de configuración en ${name}: ${message}`);
}

const baseConfigSchema = z.object({
  PORT: portSchema,
  CORS_ALLOWED_ORIGINS: corsAllowedOriginsSchema,
});

export function parseConfig(env = process.env) {
  const result = baseConfigSchema.safeParse(env);
  if (!result.success) {
    const issue = result.error.issues[0];
    const fieldName = issue && issue.path && issue.path[0] ? String(issue.path[0]) : "PORT";
    throw formatConfigError(fieldName, result.error);
  }
  return {
    port: result.data.PORT,
    corsAllowedOrigins: result.data.CORS_ALLOWED_ORIGINS,
  };
}
