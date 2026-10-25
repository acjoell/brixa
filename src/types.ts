/**
 * Foundry — tipos compartidos entre módulos.
 * Contrato entre prompts, validation y generator.
 */

/** Modalidad de generación seleccionada por el usuario. */
export type Modality = "frontend" | "backend" | "fullstack";

/** Lenguaje seleccionado por el usuario. */
export type Language = "js" | "ts";

/** Opciones crudas devueltas por el flujo de prompts. */
export interface RawOptions {
  modality: Modality;
  language: Language;
}

/** Opciones validadas y normalizadas listas para la generación. */
export interface UserOptions {
  modality: Modality;
  language: Language;
}

/** Resultado discriminado. Evita excepciones en la lógica de dominio. */
export type Result<T, E> = { ok: true; value: T } | { ok: false; error: E };
