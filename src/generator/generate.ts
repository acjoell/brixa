/**
 * Foundry — orquestación de la generación de proyectos.
 *
 * Copia la plantilla al directorio de destino, renombra _gitignore a .gitignore
 * e interpolate el nombre del proyecto en package.json e index.html.
 * Sin dependencias externas ni motor de plantillas.
 */
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { type UserOptions } from "../types.js";

// ---------------------------------------------------------------------------
// Tipos públicos
// ---------------------------------------------------------------------------

export type GenerateError =
  | { kind: "unsupported_combination"; modality: string; language: string }
  | { kind: "copy_error"; message: string };

export type GenerateResult = { ok: true } | { ok: false; error: GenerateError };

// ---------------------------------------------------------------------------
// Ruta base de plantillas (resuelta con import.meta.url para funcionar en dist/)
// ---------------------------------------------------------------------------

function templatesDir(): string {
  const here = fileURLToPath(import.meta.url);
  // En src/: __dirname = src/generator/ → ../../templates
  // En dist/: __dirname = dist/generator/ → ../../dist/templates (mismo nivel relativo)
  return path.resolve(path.dirname(here), "..", "templates");
}

// ---------------------------------------------------------------------------
// Tabla de combinaciones soportadas
// ---------------------------------------------------------------------------

/**
 * Clave: `"${modality}+${language}"`.
 * Valor: nombre de la carpeta de plantilla dentro de `src/templates/`.
 */
const SUPPORTED_TEMPLATES: Record<string, string> = {
  "frontend+ts": "frontend-react-ts",
  "frontend+js": "frontend-react-js",
  "backend+ts": "backend-express-ts",
  "backend+js": "backend-express-js",
};

// ---------------------------------------------------------------------------
// Interpolación simple
// ---------------------------------------------------------------------------

function interpolate(content: string, projectName: string): string {
  return content.replaceAll("foundry-tpl", projectName);
}

// ---------------------------------------------------------------------------
// Función principal de generación
// ---------------------------------------------------------------------------

/**
 * Genera el proyecto copiando la plantilla correspondiente a `outputDir`.
 * Soporta modalidad `frontend` con lenguajes `ts` y `js`.
 * Para cualquier otra combinación devuelve error `unsupported_combination`.
 */
export async function generate(options: UserOptions): Promise<GenerateResult> {
  const { modality, language, outputDir } = options;

  const templateName = SUPPORTED_TEMPLATES[`${modality}+${language}`];

  if (templateName === undefined) {
    return {
      ok: false,
      error: { kind: "unsupported_combination", modality, language },
    };
  }

  const templateSrc = path.join(templatesDir(), templateName);

  try {
    await copyTemplate(templateSrc, outputDir);
    return { ok: true };
  } catch (err) {
    return {
      ok: false,
      error: {
        kind: "copy_error",
        message: err instanceof Error ? err.message : String(err),
      },
    };
  }
}

// ---------------------------------------------------------------------------
// Copia recursiva de la plantilla con renombrado e interpolación
// ---------------------------------------------------------------------------

/**
 * Copia recursivamente `src` en `dest`, aplicando renombrado e interpolación.
 * El nombre del proyecto se extrae del basename de `dest`.
 */
async function copyTemplate(src: string, dest: string): Promise<void> {
  const projectName = path.basename(dest);
  await fs.mkdir(dest, { recursive: true });
  await copyDir(src, dest, projectName);
}

async function copyDir(src: string, dest: string, projectName: string): Promise<void> {
  const entries = await fs.readdir(src, { withFileTypes: true });

  for (const entry of entries) {
    const srcPath = path.join(src, entry.name);
    // _gitignore → .gitignore
    const destName = entry.name === "_gitignore" ? ".gitignore" : entry.name;
    const destPath = path.join(dest, destName);

    if (entry.isDirectory()) {
      await fs.mkdir(destPath, { recursive: true });
      await copyDir(srcPath, destPath, projectName);
    } else {
      await copyFile(srcPath, destPath, projectName);
    }
  }
}

/** Archivos de texto en los que se aplica interpolación del nombre. */
const INTERPOLATED_FILES = new Set(["package.json", "index.html"]);

async function copyFile(src: string, dest: string, projectName: string): Promise<void> {
  const filename = path.basename(dest);

  if (INTERPOLATED_FILES.has(filename)) {
    const content = await fs.readFile(src, "utf-8");
    await fs.writeFile(dest, interpolate(content, projectName), "utf-8");
  } else {
    await fs.copyFile(src, dest);
  }
}

// ---------------------------------------------------------------------------
// Mensajes de usuario
// ---------------------------------------------------------------------------

/**
 * Devuelve el mensaje de error legible para el usuario según el tipo de error.
 */
export function formatGenerateError(error: GenerateError): string {
  switch (error.kind) {
    case "unsupported_combination": {
      const supported = Object.keys(SUPPORTED_TEMPLATES)
        .map((k) => k.replace("+", " + "))
        .join(", ");
      return (
        `La combinación "${error.modality} + ${error.language}" no está soportada todavía.\n` +
        `Combinaciones soportadas: ${supported}.`
      );
    }
    case "copy_error":
      return `Error al copiar la plantilla: ${error.message}`;
  }
}

/**
 * Devuelve los pasos a seguir tras la generación exitosa.
 */
export function nextStepsMessage(outputDir: string): string {
  const name = path.basename(outputDir);
  return [
    "",
    `✔ Proyecto creado en: ${outputDir}`,
    "",
    "Pasos para continuar:",
    `  cd ${name}`,
    "  npm install",
    "  npm run dev",
    "",
  ].join("\n");
}
