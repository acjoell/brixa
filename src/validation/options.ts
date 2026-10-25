import type { RawOptions, UserOptions, Result } from "../types.js";

/** Razones de validación fallida. */
export type ValidationError =
  { kind: "invalid_modality"; received: unknown } | { kind: "invalid_language"; received: unknown };

const VALID_MODALITIES = new Set(["frontend", "backend", "fullstack"]);
const VALID_LANGUAGES = new Set(["js", "ts"]);

/**
 * Valida y normaliza las opciones crudas del usuario.
 *
 * No interactúa con el terminal ni el sistema de archivos.
 * Permite probarla con entradas directas sin mocks.
 */
export function validateOptions(raw: RawOptions): Result<UserOptions, ValidationError> {
  if (!VALID_MODALITIES.has(raw.modality)) {
    return { ok: false, error: { kind: "invalid_modality", received: raw.modality } };
  }

  if (!VALID_LANGUAGES.has(raw.language)) {
    return { ok: false, error: { kind: "invalid_language", received: raw.language } };
  }

  return { ok: true, value: { modality: raw.modality, language: raw.language } };
}

/** Convierte un ValidationError en un mensaje legible para el usuario. */
export function formatValidationError(error: ValidationError): string {
  switch (error.kind) {
    case "invalid_modality":
      return `Modalidad no válida: "${String(error.received)}". Las opciones son: frontend, backend, fullstack.`;
    case "invalid_language":
      return `Lenguaje no válido: "${String(error.received)}". Las opciones son: js, ts.`;
  }
}
