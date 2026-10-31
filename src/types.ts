/**
 * Foundry — tipos compartidos entre módulos.
 * Contrato entre prompts, validation y generator.
 */

/** Modalidad de generación seleccionada por el usuario. */
export type Modality = "frontend" | "backend" | "fullstack";

/** Lenguaje seleccionado por el usuario. */
export type Language = "js" | "ts";

/** Base de datos seleccionada por el usuario. */
export type Database = "none" | "postgres" | "sqlite";

/** Opciones crudas devueltas por el flujo de prompts. */
export interface RawOptions {
  modality: Modality;
  language: Language;
  database?: Database | undefined;
  docker?: boolean | undefined;
  apiDocs?: boolean | undefined;
  i18n?: boolean | undefined;
  /** Ruta tal como la escribe el usuario (puede ser relativa o con `..`). */
  outputDir: string;
}

/** Opciones validadas y normalizadas listas para la generación. */
export interface UserOptions {
  modality: Modality;
  language: Language;
  database?: Database | undefined;
  docker?: boolean | undefined;
  apiDocs?: boolean | undefined;
  i18n?: boolean | undefined;
  /** Ruta absoluta resuelta y validada del directorio de destino. */
  outputDir: string;
}

/** Resultado discriminado. Evita excepciones en la lógica de dominio. */
export type Result<T, E> = { ok: true; value: T } | { ok: false; error: E };
