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
import { type UserOptions, type Modality } from "../types.js";

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

export const SUPPORTED_COMBINATIONS = [
  "frontend+ts",
  "frontend+js",
  "backend+ts",
  "backend+js",
  "fullstack+ts",
  "fullstack+js",
] as const;

/**
 * Plantillas individuales para frontend y backend.
 */
const SINGLE_TEMPLATES: Record<string, string> = {
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
 * Genera el proyecto copiando la plantilla o plantillas correspondientes a `outputDir`.
 * Para fullstack, copia frontend y backend a subcarpetas hermanas, aplica el overlay
 * de Vite para el proxy a la API y genera el README raíz.
 * Para cualquier otra combinación devuelve error `unsupported_combination`.
 */
export async function generate(options: UserOptions): Promise<GenerateResult> {
  const { modality, language, outputDir } = options;
  const combinationKey = `${modality}+${language}`;

  if (!(SUPPORTED_COMBINATIONS as readonly string[]).includes(combinationKey)) {
    return {
      ok: false,
      error: { kind: "unsupported_combination", modality, language },
    };
  }

  if (modality === "fullstack") {
    try {
      const projectName = path.basename(outputDir);
      const frontendTpl = language === "ts" ? "frontend-react-ts" : "frontend-react-js";
      const backendTpl = language === "ts" ? "backend-express-ts" : "backend-express-js";
      const overlayFile = language === "ts" ? "vite.config.ts" : "vite.config.js";

      await fs.mkdir(outputDir, { recursive: true });

      const frontendDest = path.join(outputDir, "frontend");
      const backendDest = path.join(outputDir, "backend");

      await copyTemplate(
        path.join(templatesDir(), frontendTpl),
        frontendDest,
        `${projectName}-frontend`,
      );
      await copyTemplate(
        path.join(templatesDir(), backendTpl),
        backendDest,
        `${projectName}-backend`,
      );

      const overlaySrc = path.join(templatesDir(), "fullstack", overlayFile);
      await fs.copyFile(overlaySrc, path.join(frontendDest, overlayFile));

      const readmeContent = generateFullstackReadme(projectName, language);
      await fs.writeFile(path.join(outputDir, "README.md"), readmeContent, "utf-8");

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

  const templateName = SINGLE_TEMPLATES[combinationKey];
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
 * Por defecto el nombre del proyecto se extrae del basename de `dest`.
 */
async function copyTemplate(
  src: string,
  dest: string,
  projectName: string = path.basename(dest),
): Promise<void> {
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
// Generación del README raíz para proyectos fullstack
// ---------------------------------------------------------------------------

function generateFullstackReadme(projectName: string, language: string): string {
  const langLabel = language === "ts" ? "TypeScript" : "JavaScript";
  return `# ${projectName}

Aplicación fullstack generada con Foundry.

## Estructura

\`\`\`
${projectName}/
├── frontend/   # Aplicación cliente React + Vite (${langLabel})
├── backend/    # API REST Express (${langLabel})
└── README.md   # Documentación general del proyecto
\`\`\`

## Requisitos

- Node.js ^24.0.0 o >=26.0.0
- npm

## Instalación

Instala las dependencias en cada carpeta por separado:

\`\`\`bash
# Frontend
cd frontend
npm install
cd ..

# Backend
cd backend
npm install
cd ..
\`\`\`

## Ejecución en desarrollo

La aplicación requiere ejecutar ambos servicios en dos terminales independientes:

### 1. Backend (Terminal 1)

\`\`\`bash
cd backend
npm run dev
\`\`\`

El servidor backend iniciará en \`http://localhost:3000\`.

### 2. Frontend (Terminal 2)

\`\`\`bash
cd frontend
npm run dev
\`\`\`

El servidor de desarrollo de Vite iniciará habitualmente en \`http://localhost:5173\`.

## Comunicación entre servicios y BACKEND_URL

En desarrollo, Vite reenvía las peticiones dirigidas a \`/api/*\` hacia el backend descartando el prefijo \`/api\` (por ejemplo, una llamada a \`/api/health\` llegará al backend como \`/health\`).

El destino del proxy se configura mediante la variable de entorno \`BACKEND_URL\`, con valor por defecto \`http://localhost:3000\`. Si ejecutas el backend en otro puerto o dirección:

\`\`\`bash
cd frontend
BACKEND_URL=http://localhost:4000 npm run dev
\`\`\`

## Despliegue en producción

El proxy de Vite es exclusivo para desarrollo local. El despliegue en producción no está resuelto por Foundry. Para producción es necesario:

1. Compilar el frontend (\`npm run build\` dentro de \`frontend/\`).
2. Servir los archivos estáticos resultantes (\`dist/\`) y enrutar las peticiones \`/api/*\` al backend mediante un proxy inverso (como Nginx, Caddy o un API gateway) o servir el frontend compilado desde el propio servidor backend.
`;
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
      const supported = SUPPORTED_COMBINATIONS.map((k) => k.replace("+", " + ")).join(", ");
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
export function nextStepsMessage(outputDir: string, modality?: Modality): string {
  const name = path.basename(outputDir);

  if (modality === "fullstack") {
    return [
      "",
      `✔ Proyecto creado en: ${outputDir}`,
      "",
      "Pasos para continuar:",
      `  cd ${name}`,
      "",
      "  # Terminal 1 — Backend:",
      "  cd backend",
      "  npm install",
      "  npm run dev",
      "",
      "  # Terminal 2 — Frontend:",
      "  cd frontend",
      "  npm install",
      "  npm run dev",
      "",
    ].join("\n");
  }

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
