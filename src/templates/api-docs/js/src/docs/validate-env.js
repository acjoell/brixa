/**
 * Validación de variables de entorno para el overlay api-docs.
 */

export function validateApiDocsEnv(val) {
  if (val !== undefined && val !== "true" && val !== "false") {
    throw new Error(
      `Valor inválido para ENABLE_API_DOCS: "${val}". Debe ser "true" o "false".`,
    );
  }
}
