import { strictBooleanSchema, formatConfigError } from "../config.js";

/**
 * Validación de variables de entorno para el overlay api-docs.
 */
export function validateApiDocsEnv(val) {
  if (val === undefined) {
    return;
  }
  const result = strictBooleanSchema.safeParse(val);
  if (!result.success) {
    throw formatConfigError("ENABLE_API_DOCS", result.error);
  }
}
