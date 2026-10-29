/**
 * Foundry — orquestación de la generación de proyectos.
 *
 * Copia la plantilla al directorio de destino, renombra _gitignore a .gitignore
 * e interpola el nombre del proyecto en package.json e index.html.
 * Aplica overlays opcionales (proxy fullstack, persistencia con PostgreSQL y Drizzle ORM).
 * Sin dependencias externas ni motor de plantillas.
 */
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { type UserOptions, type Modality, type Database, type Language } from "../types.js";

// ---------------------------------------------------------------------------
// Tipos públicos
// ---------------------------------------------------------------------------

export type GenerateError =
  | { kind: "unsupported_combination"; modality: string; language: string; database?: string }
  | { kind: "copy_error"; message: string };

export type GenerateResult = { ok: true } | { ok: false; error: GenerateError };

export interface PackageJson {
  name?: string;
  version?: string;
  private?: boolean;
  type?: string;
  engines?: Record<string, string>;
  allowScripts?: Record<string, boolean>;
  scripts?: Record<string, string>;
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
  overrides?: Record<string, unknown>;
  [key: string]: unknown;
}

export interface PackageJsonOverlay {
  allowScripts?: Record<string, boolean>;
  scripts?: Record<string, string>;
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
  overrides?: Record<string, unknown>;
}

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
  "backend+ts+none",
  "backend+ts+postgres",
  "backend+ts+sqlite",
  "backend+js+none",
  "backend+js+postgres",
  "backend+js+sqlite",
  "fullstack+ts+none",
  "fullstack+ts+postgres",
  "fullstack+ts+sqlite",
  "fullstack+js+none",
  "fullstack+js+postgres",
  "fullstack+js+sqlite",
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
// Fusión determinista de package.json sin sobrescribir claves existentes
// ---------------------------------------------------------------------------

export function mergeSection<T>(
  base?: Record<string, T>,
  overlay?: Record<string, T>,
): Record<string, T> | undefined {
  if (!base && !overlay) return undefined;
  const merged: Record<string, T> = { ...(base ?? {}) };
  if (overlay) {
    for (const [key, value] of Object.entries(overlay)) {
      if (!(key in merged)) {
        merged[key] = value;
      }
    }
  }
  return merged;
}

export function mergePackageJson(base: PackageJson, overlay: PackageJsonOverlay): PackageJson {
  const result: PackageJson = { ...base };

  const mergedAllowScripts = mergeSection(base.allowScripts, overlay.allowScripts);
  if (mergedAllowScripts) {
    result.allowScripts = mergedAllowScripts;
  }

  const mergedScripts = mergeSection(base.scripts, overlay.scripts);
  if (mergedScripts) {
    result.scripts = mergedScripts;
  }

  const mergedDependencies = mergeSection(base.dependencies, overlay.dependencies);
  if (mergedDependencies) {
    result.dependencies = mergedDependencies;
  }

  const mergedDevDependencies = mergeSection(base.devDependencies, overlay.devDependencies);
  if (mergedDevDependencies) {
    result.devDependencies = mergedDevDependencies;
  }

  const mergedOverrides = mergeSection(base.overrides, overlay.overrides);
  if (mergedOverrides) {
    result.overrides = mergedOverrides;
  }

  return result;
}

// ---------------------------------------------------------------------------
// Modificadores de archivos para persistencia PostgreSQL
// ---------------------------------------------------------------------------

async function appendEnvExample(envPath: string): Promise<void> {
  const line = "DATABASE_URL=postgresql://USUARIO:CLAVE@localhost:5432/NOMBRE_BD\n";
  try {
    const existing = await fs.readFile(envPath, "utf-8");
    const separator = existing.endsWith("\n") ? "" : "\n";
    await fs.writeFile(envPath, `${existing}${separator}${line}`, "utf-8");
  } catch {
    await fs.writeFile(envPath, line, "utf-8");
  }
}

async function appendBackendReadmeDatabase(readmePath: string): Promise<void> {
  const content = `
## Base de datos

Este backend incluye integración con PostgreSQL mediante Drizzle ORM.

### Configuración y flujo de trabajo

1. Configura la variable de entorno \`DATABASE_URL\` en tu archivo \`.env\`:

\`\`\`bash
DATABASE_URL=postgresql://USUARIO:CLAVE@localhost:5432/NOMBRE_BD
\`\`\`

Por seguridad, nunca confirmes credenciales reales al control de versiones.

2. Define tus tablas en \`src/db/schema\`.

3. Genera las migraciones SQL:
\`\`\`bash
npm run db:generate
\`\`\`

4. Aplica las migraciones en la base de datos:
\`\`\`bash
npm run db:migrate
\`\`\`

> **Nota:** Drizzle 1.0 se encuentra en fase RC (Release Candidate) y cambiará el formato de las migraciones en futuras versiones.
> Este proyecto deniega por defecto el script de instalación de \`esbuild\` requerido internamente por \`drizzle-kit\`, garantizando la seguridad en la instalación sin afectar al generador de migraciones.
> Los avisos de obsolescencia (\`npm warn deprecated\`) de \`@esbuild-kit\` durante \`npm install\` provienen internamente de las dependencias de \`drizzle-kit\` y no afectan al funcionamiento del proyecto.
`;
  const existing = await fs.readFile(readmePath, "utf-8");
  const separator = existing.endsWith("\n") ? "" : "\n";
  await fs.writeFile(readmePath, `${existing}${separator}${content}`, "utf-8");
}

async function appendRootReadmeDatabase(readmePath: string): Promise<void> {
  const content = `
### Base de datos (PostgreSQL)
El backend incluye persistencia con PostgreSQL y Drizzle ORM. Define tablas en \`backend/src/db/schema\`, genera migraciones con \`npm run db:generate\` y aplícalas con \`npm run db:migrate\`.
`;
  const existing = await fs.readFile(readmePath, "utf-8");
  const separator = existing.endsWith("\n") ? "" : "\n";
  await fs.writeFile(readmePath, `${existing}${separator}${content}`, "utf-8");
}

async function applyPostgresOverlay(targetBackendDir: string, language: Language): Promise<void> {
  const overlayDir = path.join(templatesDir(), "database-postgres", language);
  await copyDir(overlayDir, targetBackendDir, path.basename(targetBackendDir));

  // Fusionar package.json deterministamente sin sobrescribir lo existente
  const pkgPath = path.join(targetBackendDir, "package.json");
  const pkgRaw = await fs.readFile(pkgPath, "utf-8");
  const pkgJson = JSON.parse(pkgRaw) as PackageJson;

  const overlayPkgPath = path.join(overlayDir, "package.json");
  let overlayDeps: PackageJsonOverlay;
  try {
    const overlayRaw = await fs.readFile(overlayPkgPath, "utf-8");
    overlayDeps = JSON.parse(overlayRaw) as PackageJsonOverlay;
  } catch {
    overlayDeps = {
      allowScripts: {
        esbuild: false,
      },
      overrides: {
        "@esbuild-kit/core-utils": {
          esbuild: "^0.25.0",
        },
      },
      scripts: {
        "db:generate": "drizzle-kit generate",
        "db:migrate": language === "ts" ? "tsx src/db/migrate.ts" : "node src/db/migrate.js",
      },
      dependencies: {
        "drizzle-orm": "0.45.4",
        pg: "8.23.1",
      },
      devDependencies: {
        "drizzle-kit": "0.31.11",
        ...(language === "ts" ? { "@types/pg": "8.23.1" } : {}),
      },
    };
  }

  const merged = mergePackageJson(pkgJson, overlayDeps);
  await fs.writeFile(pkgPath, JSON.stringify(merged, null, 2) + "\n", "utf-8");

  // Añadir DATABASE_URL a .env.example
  await appendEnvExample(path.join(targetBackendDir, ".env.example"));

  // Añadir sección de base de datos a README.md
  await appendBackendReadmeDatabase(path.join(targetBackendDir, "README.md"));
}

async function appendEnvExampleSqlite(envPath: string): Promise<void> {
  const line = "DATABASE_URL=file:./data/app.db\n";
  try {
    const existing = await fs.readFile(envPath, "utf-8");
    const separator = existing.endsWith("\n") ? "" : "\n";
    await fs.writeFile(envPath, `${existing}${separator}${line}`, "utf-8");
  } catch {
    await fs.writeFile(envPath, line, "utf-8");
  }
}

async function appendGitignoreSqlite(gitignorePath: string): Promise<void> {
  const line = "data/\n";
  try {
    const existing = await fs.readFile(gitignorePath, "utf-8");
    const separator = existing.endsWith("\n") ? "" : "\n";
    await fs.writeFile(gitignorePath, `${existing}${separator}${line}`, "utf-8");
  } catch {
    await fs.writeFile(gitignorePath, line, "utf-8");
  }
}

async function appendBackendReadmeDatabaseSqlite(readmePath: string): Promise<void> {
  const content = `
## Base de datos

Este backend incluye integración con SQLite mediante Drizzle ORM y @libsql/client.

### Configuración y flujo de trabajo

1. Configura la variable de entorno \`DATABASE_URL\` en tu archivo \`.env\`:

\`\`\`bash
DATABASE_URL=file:./data/app.db
\`\`\`

La ruta con prefijo \`file:\` es relativa al directorio de ejecución del proyecto.
Esta integración está verificada oficialmente en entornos Linux x64.

2. Define tus tablas en \`src/db/schema\`.

3. Genera las migraciones SQL:
\`\`\`bash
npm run db:generate
\`\`\`

4. Aplica las migraciones en la base de datos:
\`\`\`bash
npm run db:migrate
\`\`\`

> **Nota:** Drizzle 1.0 se encuentra en fase RC (Release Candidate) y cambiará el formato de las migraciones en futuras versiones.
> Este proyecto deniega por defecto el script de instalación de \`esbuild\` requerido internamente por \`drizzle-kit\`, garantizando la seguridad en la instalación sin afectar al generador de migraciones.
> Los avisos de obsolescencia (\`npm warn deprecated\`) de \`@esbuild-kit\` durante \`npm install\` provienen internamente de las dependencias de \`drizzle-kit\` y no afectan al funcionamiento del proyecto.
`;
  const existing = await fs.readFile(readmePath, "utf-8");
  const separator = existing.endsWith("\n") ? "" : "\n";
  await fs.writeFile(readmePath, `${existing}${separator}${content}`, "utf-8");
}

async function appendRootReadmeDatabaseSqlite(readmePath: string): Promise<void> {
  const content = `
### Base de datos (SQLite)
El backend incluye persistencia con SQLite (vía @libsql/client) y Drizzle ORM. Define tablas en \`backend/src/db/schema\`, genera migraciones con \`npm run db:generate\` y aplícalas con \`npm run db:migrate\`. La ruta del archivo SQLite es relativa al directorio de ejecución y está verificada en Linux x64.
`;
  const existing = await fs.readFile(readmePath, "utf-8");
  const separator = existing.endsWith("\n") ? "" : "\n";
  await fs.writeFile(readmePath, `${existing}${separator}${content}`, "utf-8");
}

async function applySqliteOverlay(targetBackendDir: string, language: Language): Promise<void> {
  const overlayDir = path.join(templatesDir(), "database-sqlite", language);
  await copyDir(overlayDir, targetBackendDir, path.basename(targetBackendDir));

  // Fusionar package.json deterministamente sin sobrescribir lo existente
  const pkgPath = path.join(targetBackendDir, "package.json");
  const pkgRaw = await fs.readFile(pkgPath, "utf-8");
  const pkgJson = JSON.parse(pkgRaw) as PackageJson;

  const overlayPkgPath = path.join(overlayDir, "package.json");
  let overlayDeps: PackageJsonOverlay;
  try {
    const overlayRaw = await fs.readFile(overlayPkgPath, "utf-8");
    overlayDeps = JSON.parse(overlayRaw) as PackageJsonOverlay;
  } catch {
    overlayDeps = {
      allowScripts: {
        esbuild: false,
      },
      overrides: {
        "@esbuild-kit/core-utils": {
          esbuild: "^0.25.0",
        },
      },
      scripts: {
        "db:generate": "drizzle-kit generate",
        "db:migrate": language === "ts" ? "tsx src/db/migrate.ts" : "node src/db/migrate.js",
      },
      dependencies: {
        "@libsql/client": "0.18.0",
        "drizzle-orm": "0.45.4",
      },
      devDependencies: {
        "drizzle-kit": "0.31.11",
      },
    };
  }

  const merged = mergePackageJson(pkgJson, overlayDeps);
  await fs.writeFile(pkgPath, JSON.stringify(merged, null, 2) + "\n", "utf-8");

  // Añadir DATABASE_URL a .env.example
  await appendEnvExampleSqlite(path.join(targetBackendDir, ".env.example"));

  // Añadir data/ a .gitignore
  await appendGitignoreSqlite(path.join(targetBackendDir, ".gitignore"));

  // Añadir sección de base de datos a README.md
  await appendBackendReadmeDatabaseSqlite(path.join(targetBackendDir, "README.md"));
}

// ---------------------------------------------------------------------------
// Modificadores de archivos para overlay Docker
// ---------------------------------------------------------------------------

async function appendEnvExampleDockerPostgres(envPath: string): Promise<void> {
  const content = `
# Configuración para Docker Compose
# POSTGRES_PASSWORD es obligatoria para docker compose y debe ser alfanumérica.
POSTGRES_USER=postgres
POSTGRES_PASSWORD=ejemplo123
POSTGRES_DB=app
`;
  try {
    const existing = await fs.readFile(envPath, "utf-8");
    const separator = existing.endsWith("\n") ? "" : "\n";
    await fs.writeFile(envPath, `${existing}${separator}${content.trimStart()}`, "utf-8");
  } catch {
    await fs.writeFile(envPath, content.trimStart(), "utf-8");
  }
}

async function appendBackendReadmeDocker(
  readmePath: string,
  language: Language,
  database: Database,
): Promise<void> {
  const isTs = language === "ts";
  const hasDb = database === "postgres" || database === "sqlite";

  let dbSection = "";
  if (hasDb) {
    const migrateCmd = isTs
      ? "docker compose run --rm backend node dist/db/migrate.js"
      : "docker compose run --rm backend npm run db:migrate";

    dbSection = `
### Migraciones de base de datos

> **Importante:** \`npm run db:generate\` debe ejecutarse en el host ANTES de construir la imagen, porque el directorio \`drizzle/\` debe existir en ella.

Aplica las migraciones en la base de datos dentro del contenedor:

\`\`\`bash
${migrateCmd}
\`\`\`
`;
  }

  const content = `
## Docker

### Requisitos

- Docker con Docker Compose v2 (\`docker compose\`).

### Arranque

1. Se recomienda ejecutar \`npm install\` antes de \`docker compose build\` para fijar el archivo de bloqueo (\`package-lock.json\`).
2. Si utilizas base de datos, asegúrate de configurar las variables de entorno requeridas en tu archivo \`.env\` (en PostgreSQL, \`POSTGRES_PASSWORD\` es obligatoria y debe ser alfanumérica).
3. Construye e inicia los servicios:

\`\`\`bash
docker compose up -d
\`\`\`

El backend estará disponible en \`http://localhost:3000\` y expondrá su ruta de salud en \`http://localhost:3000/health\`.
${dbSection}
### Limitaciones

- Diseñado para desarrollo y pruebas locales en contenedores.
- Cualquier modificación en el código fuente requiere reconstruir la imagen (\`docker compose build\` o \`docker compose up --build\`).
`;

  try {
    const existing = await fs.readFile(readmePath, "utf-8");
    const separator = existing.endsWith("\n") ? "" : "\n";
    await fs.writeFile(readmePath, `${existing}${separator}${content.trimStart()}`, "utf-8");
  } catch {
    await fs.writeFile(readmePath, content.trimStart(), "utf-8");
  }
}

async function appendRootReadmeDockerFullstack(
  readmePath: string,
  language: Language,
  database: Database,
): Promise<void> {
  const isTs = language === "ts";
  const hasDb = database === "postgres" || database === "sqlite";

  let dbSection = "";
  if (hasDb) {
    const migrateCmd = isTs
      ? "docker compose run --rm backend node dist/db/migrate.js"
      : "docker compose run --rm backend npm run db:migrate";

    dbSection = `
### Migraciones de base de datos

> **Importante:** \`npm run db:generate\` debe ejecutarse dentro de \`backend/\` en el host ANTES de construir la imagen, porque el directorio \`drizzle/\` debe existir en ella.

Aplica las migraciones en la base de datos desde la raíz del proyecto:

\`\`\`bash
${migrateCmd}
\`\`\`
`;
  }

  const content = `
## Docker

### Requisitos

- Docker con Docker Compose v2 (\`docker compose\`).

### Arranque

1. Se recomienda ejecutar \`npm install\` en \`frontend/\` y \`backend/\` antes de \`docker compose build\` para fijar los archivos de bloqueo (\`package-lock.json\`).
2. Si utilizas PostgreSQL, configura las variables de entorno requeridas en el archivo \`.env\` de la raíz (\`POSTGRES_PASSWORD\` es obligatoria y debe ser alfanumérica).
3. Construye e inicia los servicios:

\`\`\`bash
docker compose up -d
\`\`\`

La aplicación web estará disponible en \`http://localhost:8080\` y la API responderá a través del proxy en \`http://localhost:8080/api/health\`.
${dbSection}
### Limitaciones

- Diseñado para desarrollo y pruebas locales en contenedores.
- Cualquier modificación en el código fuente requiere reconstruir las imágenes (\`docker compose build\` o \`docker compose up --build\`).
`;

  try {
    const existing = await fs.readFile(readmePath, "utf-8");
    const separator = existing.endsWith("\n") ? "" : "\n";
    await fs.writeFile(readmePath, `${existing}${separator}${content.trimStart()}`, "utf-8");
  } catch {
    await fs.writeFile(readmePath, content.trimStart(), "utf-8");
  }
}

async function applyDockerOverlay(
  targetBackendDir: string,
  language: Language,
  database: Database,
): Promise<void> {
  const dockerTemplates = path.join(templatesDir(), "docker");

  // 1. Dockerfile
  const dockerfileSrc = path.join(dockerTemplates, language, "Dockerfile");
  await fs.copyFile(dockerfileSrc, path.join(targetBackendDir, "Dockerfile"));

  // 2. .dockerignore
  const dockerignoreSrc = path.join(dockerTemplates, "_dockerignore");
  await fs.copyFile(dockerignoreSrc, path.join(targetBackendDir, ".dockerignore"));

  // 3. compose.yaml
  const composeSrc = path.join(dockerTemplates, `compose.${database}.yaml`);
  await fs.copyFile(composeSrc, path.join(targetBackendDir, "compose.yaml"));

  // 4. Variables de compose en .env.example si usa postgres
  if (database === "postgres") {
    await appendEnvExampleDockerPostgres(path.join(targetBackendDir, ".env.example"));
  }

  // 5. Sección Docker en README.md
  await appendBackendReadmeDocker(path.join(targetBackendDir, "README.md"), language, database);
}

async function applyFullstackDockerOverlay(
  outputDir: string,
  frontendDest: string,
  backendDest: string,
  language: Language,
  database: Database,
): Promise<void> {
  const dockerTemplates = path.join(templatesDir(), "docker");
  const fullstackTemplates = path.join(dockerTemplates, "fullstack");

  // 1. Backend: Dockerfile y .dockerignore (sin compose.yaml)
  const backendDockerfileSrc = path.join(dockerTemplates, language, "Dockerfile");
  await fs.copyFile(backendDockerfileSrc, path.join(backendDest, "Dockerfile"));
  const backendDockerignoreSrc = path.join(dockerTemplates, "_dockerignore");
  await fs.copyFile(backendDockerignoreSrc, path.join(backendDest, ".dockerignore"));

  // 2. Frontend: Dockerfile, nginx.conf y .dockerignore
  const frontendTemplates = path.join(fullstackTemplates, "frontend");
  await fs.copyFile(
    path.join(frontendTemplates, "Dockerfile"),
    path.join(frontendDest, "Dockerfile"),
  );
  await fs.copyFile(
    path.join(frontendTemplates, "_dockerignore"),
    path.join(frontendDest, ".dockerignore"),
  );
  await fs.copyFile(
    path.join(frontendTemplates, "nginx.conf"),
    path.join(frontendDest, "nginx.conf"),
  );

  // 3. Raíz: compose.yaml
  const composeSrc = path.join(fullstackTemplates, `compose.${database}.yaml`);
  await fs.copyFile(composeSrc, path.join(outputDir, "compose.yaml"));

  // 4. Raíz: .gitignore (renombrado explícito de _gitignore)
  await fs.copyFile(
    path.join(fullstackTemplates, "_gitignore"),
    path.join(outputDir, ".gitignore"),
  );

  // 5. Raíz: .env.example si usa postgres
  if (database === "postgres") {
    await appendEnvExampleDockerPostgres(path.join(outputDir, ".env.example"));
  }

  // 6. Raíz: README.md sección Docker
  await appendRootReadmeDockerFullstack(path.join(outputDir, "README.md"), language, database);
}

// ---------------------------------------------------------------------------
// Función principal de generación
// ---------------------------------------------------------------------------

/**
 * Genera el proyecto copiando la plantilla o plantillas correspondientes a `outputDir`.
 * Para fullstack, copia frontend y backend a subcarpetas hermanas, aplica el overlay
 * de Vite para el proxy a la API y genera el README raíz.
 * Si se solicita base de datos PostgreSQL, aplica el overlay sobre el backend resultante.
 * Para cualquier otra combinación devuelve error `unsupported_combination`.
 */
export async function generate(options: UserOptions): Promise<GenerateResult> {
  const { modality, language, outputDir } = options;
  const database = options.database ?? "none";

  const combinationKey =
    modality === "frontend"
      ? database === "none"
        ? `${modality}+${language}`
        : `${modality}+${language}+${database}`
      : `${modality}+${language}+${database}`;

  if (!(SUPPORTED_COMBINATIONS as readonly string[]).includes(combinationKey)) {
    return {
      ok: false,
      error: { kind: "unsupported_combination", modality, language, database },
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

      if (database === "postgres") {
        await applyPostgresOverlay(backendDest, language);
        await appendRootReadmeDatabase(path.join(outputDir, "README.md"));
      } else if (database === "sqlite") {
        await applySqliteOverlay(backendDest, language);
        await appendRootReadmeDatabaseSqlite(path.join(outputDir, "README.md"));
      }

      if (options.docker) {
        await applyFullstackDockerOverlay(outputDir, frontendDest, backendDest, language, database);
      }

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

  const baseKey = `${modality}+${language}`;
  const templateName = SINGLE_TEMPLATES[baseKey];
  if (templateName === undefined) {
    return {
      ok: false,
      error: { kind: "unsupported_combination", modality, language, database },
    };
  }

  const templateSrc = path.join(templatesDir(), templateName);

  try {
    await copyTemplate(templateSrc, outputDir);

    if (modality === "backend") {
      if (database === "postgres") {
        await applyPostgresOverlay(outputDir, language);
      } else if (database === "sqlite") {
        await applySqliteOverlay(outputDir, language);
      }
      if (options.docker) {
        await applyDockerOverlay(outputDir, language, database);
      }
    }

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
    // _gitignore → .gitignore, _dockerignore → .dockerignore
    const destName =
      entry.name === "_gitignore"
        ? ".gitignore"
        : entry.name === "_dockerignore"
          ? ".dockerignore"
          : entry.name;
    const destPath = path.join(dest, destName);

    if (entry.name === "package.json") {
      const alreadyExists = await fs
        .stat(destPath)
        .then(() => true)
        .catch(() => false);
      if (alreadyExists) {
        continue;
      }
    }

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
      const supported = SUPPORTED_COMBINATIONS.map((k) => k.replace(/\+/g, " + ")).join(", ");
      const combo =
        error.database && error.database !== "none"
          ? `${error.modality} + ${error.language} + ${error.database}`
          : `${error.modality} + ${error.language}`;
      return (
        `La combinación "${combo}" no está soportada todavía.\n` +
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
export function nextStepsMessage(
  outputDir: string,
  modality?: Modality,
  database?: Database,
  docker?: boolean,
  language?: Language,
): string {
  const name = path.basename(outputDir);

  if (modality === "fullstack") {
    const lines = [
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
    ];

    if (docker) {
      lines.push(
        "",
        "  # O con Docker:",
        "  # (Recomendado: ejecuta npm install en frontend/ y backend/ antes de construir para fijar el lockfile)",
        "  docker compose up -d",
        "  # Aplicación web disponible en: http://localhost:8080",
        "  # Ruta de salud: http://localhost:8080/api/health",
      );
    }

    if (database === "postgres") {
      lines.push(
        "",
        "  # Base de datos (PostgreSQL):",
        "  # 1. Configura DATABASE_URL en backend/.env (o .env en la raíz para Docker)",
        "  # 2. Define tus tablas en backend/src/db/schema",
        "  # 3. Genera y aplica migraciones: cd backend && npm run db:generate && npm run db:migrate",
      );
      if (docker) {
        const migrateCmd =
          language === "ts"
            ? "docker compose run --rm backend node dist/db/migrate.js"
            : "docker compose run --rm backend npm run db:migrate";
        lines.push("  #    En Docker (desde la raíz):", `  #    ${migrateCmd}`);
      }
    } else if (database === "sqlite") {
      lines.push(
        "",
        "  # Base de datos (SQLite):",
        "  # 1. Configura DATABASE_URL en backend/.env (por defecto: file:./data/app.db)",
        "  # 2. Define tus tablas en backend/src/db/schema",
        "  # 3. Genera y aplica migraciones: cd backend && npm run db:generate && npm run db:migrate",
      );
      if (docker) {
        const migrateCmd =
          language === "ts"
            ? "docker compose run --rm backend node dist/db/migrate.js"
            : "docker compose run --rm backend npm run db:migrate";
        lines.push("  #    En Docker (desde la raíz):", `  #    ${migrateCmd}`);
      }
    }

    lines.push("");
    return lines.join("\n");
  }

  const lines = [
    "",
    `✔ Proyecto creado en: ${outputDir}`,
    "",
    "Pasos para continuar:",
    `  cd ${name}`,
    "  npm install",
    "  npm run dev",
  ];

  if (docker) {
    lines.push(
      "",
      "  # O con Docker:",
      "  # (Recomendado: ejecuta npm install antes de docker compose build para fijar el lockfile)",
      "  docker compose up -d",
    );
  }

  if (database === "postgres") {
    lines.push(
      "",
      "  # Base de datos (PostgreSQL):",
      "  # 1. Configura DATABASE_URL en .env",
      "  # 2. Define tus tablas en src/db/schema",
      "  # 3. Genera y aplica migraciones: npm run db:generate && npm run db:migrate",
    );
    if (docker) {
      const migrateCmd =
        language === "ts"
          ? "docker compose run --rm backend node dist/db/migrate.js"
          : "docker compose run --rm backend npm run db:migrate";
      lines.push("  #    En Docker:", `  #    ${migrateCmd}`);
    }
  } else if (database === "sqlite") {
    lines.push(
      "",
      "  # Base de datos (SQLite):",
      "  # 1. Configura DATABASE_URL en .env (por defecto: file:./data/app.db)",
      "  # 2. Define tus tablas en src/db/schema",
      "  # 3. Genera y aplica migraciones: npm run db:generate && npm run db:migrate",
    );
    if (docker) {
      const migrateCmd =
        language === "ts"
          ? "docker compose run --rm backend node dist/db/migrate.js"
          : "docker compose run --rm backend npm run db:migrate";
      lines.push("  #    En Docker:", `  #    ${migrateCmd}`);
    }
  }

  lines.push("");
  return lines.join("\n");
}
