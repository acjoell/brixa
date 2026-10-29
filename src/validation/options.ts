import type { RawOptions, UserOptions, Result } from "../types.js";
import {
  resolveTargetPath,
  validateTargetDir,
  formatTargetDirError,
  type FsAccess,
  type TargetDirError,
} from "../generator/files.js";

// ---------------------------------------------------------------------------
// Tipos de error de validación de opciones
// ---------------------------------------------------------------------------

/** Razones de validación fallida. */
export type ValidationError =
  | { kind: "invalid_modality"; received: unknown }
  | { kind: "invalid_language"; received: unknown }
  | { kind: "invalid_database"; received: unknown }
  | { kind: "invalid_target_dir"; inner: TargetDirError };

const VALID_MODALITIES = new Set(["frontend", "backend", "fullstack"]);
const VALID_LANGUAGES = new Set(["js", "ts"]);
const VALID_DATABASES = new Set(["none", "postgres", "sqlite"]);

// ---------------------------------------------------------------------------
// Validación pura de modalidad y lenguaje
// ---------------------------------------------------------------------------

/**
 * Valida y normaliza las opciones crudas del usuario.
 *
 * Valida modalidad, lenguaje y base de datos de forma síncrona.
 * La resolución del directorio requiere I/O; usa `validateOptionsWithDir`.
 *
 * No interactúa con el terminal ni el sistema de archivos.
 * Permite probarla con entradas directas sin mocks.
 */
export function validateOptions(
  raw: RawOptions,
): Result<Pick<UserOptions, "modality" | "language" | "database" | "docker">, ValidationError> {
  if (!VALID_MODALITIES.has(raw.modality)) {
    return { ok: false, error: { kind: "invalid_modality", received: raw.modality } };
  }

  if (!VALID_LANGUAGES.has(raw.language)) {
    return { ok: false, error: { kind: "invalid_language", received: raw.language } };
  }

  const database = raw.database ?? "none";
  if (!VALID_DATABASES.has(database)) {
    return { ok: false, error: { kind: "invalid_database", received: raw.database } };
  }

  const docker =
    raw.modality === "backend" || raw.modality === "fullstack" ? (raw.docker ?? false) : false;

  return { ok: true, value: { modality: raw.modality, language: raw.language, database, docker } };
}

// ---------------------------------------------------------------------------
// Validación completa con resolución de directorio (async, requiere I/O)
// ---------------------------------------------------------------------------

/**
 * Valida las opciones completas incluyendo el directorio de destino.
 *
 * Primero valida modalidad y lenguaje de forma síncrona.
 * Luego resuelve y valida el directorio de destino con acceso al fs.
 *
 * @param raw     - Opciones crudas del usuario.
 * @param cwd     - Directorio de trabajo actual (por defecto `process.cwd()`).
 * @param fsAccess - Implementación de acceso al sistema de archivos (inyectable para tests).
 */
export async function validateOptionsWithDir(
  raw: RawOptions,
  cwd: string = process.cwd(),
  fsAccess?: FsAccess,
): Promise<Result<UserOptions, ValidationError>> {
  // 1. Validar modalidad y lenguaje.
  const baseResult = validateOptions(raw);
  if (!baseResult.ok) {
    return baseResult;
  }

  // 2. Resolver la ruta (sin I/O).
  const pathResult = resolveTargetPath(raw.outputDir, cwd);
  if (!pathResult.ok) {
    return { ok: false, error: { kind: "invalid_target_dir", inner: pathResult.error } };
  }

  // 3. Validar el directorio (con I/O).
  const dirResult = await validateTargetDir(pathResult.value, fsAccess);
  if (!dirResult.ok) {
    return { ok: false, error: { kind: "invalid_target_dir", inner: dirResult.error } };
  }

  return {
    ok: true,
    value: {
      modality: baseResult.value.modality,
      language: baseResult.value.language,
      database: baseResult.value.database,
      docker: baseResult.value.docker,
      outputDir: dirResult.value.resolved,
    },
  };
}

// ---------------------------------------------------------------------------
// Formateo de errores
// ---------------------------------------------------------------------------

/** Convierte un ValidationError en un mensaje legible para el usuario. */
export function formatValidationError(error: ValidationError): string {
  switch (error.kind) {
    case "invalid_modality":
      return `Modalidad no válida: "${String(error.received)}". Las opciones son: frontend, backend, fullstack.`;
    case "invalid_language":
      return `Lenguaje no válido: "${String(error.received)}". Las opciones son: js, ts.`;
    case "invalid_database":
      return `Base de datos no válida: "${String(error.received)}". Las opciones son: none, postgres, sqlite.`;
    case "invalid_target_dir":
      return formatTargetDirError(error.inner);
  }
}
