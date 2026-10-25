/**
 * Foundry — operaciones sobre el directorio de destino.
 *
 * Resuelve, valida y comprueba el directorio antes de escribir nada.
 * No realiza ninguna escritura; eso corresponde a T-006.
 *
 * El acceso al sistema de archivos está parametrizado mediante `FsAccess`
 * para permitir pruebas sin tocar el disco real.
 */
import path from "node:path";
import { type Result } from "../types.js";

// ---------------------------------------------------------------------------
// Tipos públicos
// ---------------------------------------------------------------------------

/** Razones por las que el directorio de destino no es aceptable. */
export type TargetDirError =
  | { kind: "empty_path" }
  | { kind: "not_a_directory"; resolved: string }
  | { kind: "not_empty"; resolved: string }
  | { kind: "permission_denied"; resolved: string }
  | { kind: "stat_error"; resolved: string; message: string };

/** Información sobre el directorio de destino una vez validado. */
export interface TargetDirInfo {
  /** Ruta absoluta resuelta. */
  resolved: string;
  /** `true` si el directorio aún no existe (debe crearse). */
  willBeCreated: boolean;
}

// ---------------------------------------------------------------------------
// Interfaz de acceso al sistema de archivos (para inyección en tests)
// ---------------------------------------------------------------------------

export interface FsAccess {
  /**
   * Equivalente a `fs.stat`. Lanza si la ruta no existe o hay un error.
   * El resultado solo necesita `isDirectory()` y `isFile()`.
   */
  stat(p: string): Promise<{ isDirectory(): boolean; isFile(): boolean }>;

  /**
   * Equivalente a `fs.readdir`. Devuelve los nombres de las entradas del directorio.
   */
  readdir(p: string): Promise<string[]>;
}

// ---------------------------------------------------------------------------
// Implementación real (usa node:fs/promises)
// ---------------------------------------------------------------------------

import fs from "node:fs/promises";

/** FsAccess que usa el sistema de archivos real. */
export const realFsAccess: FsAccess = {
  stat: (p) => fs.stat(p),
  readdir: (p) => fs.readdir(p),
};

// ---------------------------------------------------------------------------
// Lógica de resolución
// ---------------------------------------------------------------------------

/**
 * Resuelve una ruta de entrada (relativa, con `..`, etc.) a absoluta.
 * Devuelve error si la cadena está vacía o solo tiene espacios.
 */
export function resolveTargetPath(
  input: string,
  cwd: string = process.cwd(),
): Result<string, TargetDirError> {
  const trimmed = input.trim();
  if (trimmed.length === 0) {
    return { ok: false, error: { kind: "empty_path" } };
  }
  const resolved = path.resolve(cwd, trimmed);
  return { ok: true, value: resolved };
}

// ---------------------------------------------------------------------------
// Lógica de validación del directorio
// ---------------------------------------------------------------------------

/**
 * Valida que `resolved` sea apto como directorio de destino.
 *
 * Comportamiento:
 * - Si no existe → OK, `willBeCreated: true`.
 * - Si existe y es directorio vacío → OK, `willBeCreated: false`.
 * - Si existe y es directorio no vacío → Error `not_empty` (rechazo por defecto, sin sobrescritura silenciosa).
 * - Si existe y es un archivo → Error `not_a_directory`.
 * - Si hay error de permisos (EACCES / EPERM) → Error `permission_denied`.
 * - Cualquier otro error de stat → Error `stat_error`.
 */
export async function validateTargetDir(
  resolved: string,
  fs: FsAccess = realFsAccess,
): Promise<Result<TargetDirInfo, TargetDirError>> {
  let stat: { isDirectory(): boolean; isFile(): boolean };

  try {
    stat = await fs.stat(resolved);
  } catch (err: unknown) {
    // ENOENT → el directorio no existe todavía; es válido.
    if (isNodeError(err, "ENOENT")) {
      return { ok: true, value: { resolved, willBeCreated: true } };
    }
    if (isNodeError(err, "EACCES") || isNodeError(err, "EPERM")) {
      return { ok: false, error: { kind: "permission_denied", resolved } };
    }
    return {
      ok: false,
      error: {
        kind: "stat_error",
        resolved,
        message: err instanceof Error ? err.message : String(err),
      },
    };
  }

  // La ruta existe: debe ser un directorio.
  if (!stat.isDirectory()) {
    return { ok: false, error: { kind: "not_a_directory", resolved } };
  }

  // El directorio existe: comprobar si está vacío.
  let entries: string[];
  try {
    entries = await fs.readdir(resolved);
  } catch (err: unknown) {
    if (isNodeError(err, "EACCES") || isNodeError(err, "EPERM")) {
      return { ok: false, error: { kind: "permission_denied", resolved } };
    }
    return {
      ok: false,
      error: {
        kind: "stat_error",
        resolved,
        message: err instanceof Error ? err.message : String(err),
      },
    };
  }

  if (entries.length > 0) {
    return { ok: false, error: { kind: "not_empty", resolved } };
  }

  return { ok: true, value: { resolved, willBeCreated: false } };
}

// ---------------------------------------------------------------------------
// Formateo de errores
// ---------------------------------------------------------------------------

/** Convierte un TargetDirError en un mensaje legible para el usuario. */
export function formatTargetDirError(error: TargetDirError): string {
  switch (error.kind) {
    case "empty_path":
      return "La ruta del directorio no puede estar vacía.";
    case "not_a_directory":
      return `La ruta ya existe y no es un directorio: "${error.resolved}"`;
    case "not_empty":
      return `El directorio no está vacío: "${error.resolved}"\nFoundry no sobrescribe directorios existentes. Usa un directorio vacío o nuevo.`;
    case "permission_denied":
      return `Sin permiso de acceso al directorio: "${error.resolved}"`;
    case "stat_error":
      return `Error al acceder al directorio "${error.resolved}": ${error.message}`;
  }
}

// ---------------------------------------------------------------------------
// Utilidad interna
// ---------------------------------------------------------------------------

function isNodeError(err: unknown, code: string): boolean {
  return (
    typeof err === "object" &&
    err !== null &&
    "code" in err &&
    (err as Record<string, unknown>)["code"] === code
  );
}
