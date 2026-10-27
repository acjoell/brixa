import { select, input } from "@inquirer/prompts";
import type { RawOptions, Database } from "../types.js";

/** Directorio de destino por defecto si el usuario no introduce ninguno. */
const DEFAULT_OUTPUT_DIR = "./my-project";

/**
 * Ejecuta el flujo de prompts interactivo.
 *
 * Devuelve `null` si el usuario cancela (Ctrl+C / ExitPromptError).
 * Lanza cualquier otro error inesperado para que lo capture el punto de entrada.
 */
export async function runPrompts(): Promise<RawOptions | null> {
  try {
    const modality = await select({
      message: "¿Qué tipo de proyecto quieres generar?",
      choices: [
        { name: "Frontend", value: "frontend" as const },
        { name: "Backend", value: "backend" as const },
        { name: "Aplicación completa (frontend + backend)", value: "fullstack" as const },
      ],
    });

    const language = await select({
      message: "¿Qué lenguaje quieres usar?",
      choices: [
        { name: "TypeScript", value: "ts" as const },
        { name: "JavaScript", value: "js" as const },
      ],
    });

    let database: Database = "none";
    if (modality === "backend" || modality === "fullstack") {
      database = await select({
        message: "¿Base de datos?",
        choices: [
          { name: "Ninguna", value: "none" as const },
          { name: "PostgreSQL", value: "postgres" as const },
          { name: "SQLite", value: "sqlite" as const },
        ],
        default: "none",
      });
    }

    const outputDir = await input({
      message: "¿En qué directorio quieres generar el proyecto?",
      default: DEFAULT_OUTPUT_DIR,
    });

    return { modality, language, database, outputDir };
  } catch (error: unknown) {
    // ExitPromptError se lanza cuando el usuario cancela con Ctrl+C.
    if (isExitPromptError(error)) {
      return null;
    }
    throw error;
  }
}

/** Detecta el error de cancelación de @inquirer/prompts sin importar la clase concreta. */
function isExitPromptError(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "name" in error &&
    error.name === "ExitPromptError"
  );
}
