/**
 * Brixa — orquestación de la generación de proyectos.
 *
 * Copia la plantilla al directorio de destino, renombra _gitignore a .gitignore
 * e interpola el nombre del proyecto en package.json e index.html.
 * Aplica overlays opcionales (proxy fullstack, persistencia con PostgreSQL y Drizzle ORM).
 * Sin dependencias externas ni motor de plantillas.
 */
import { createHash } from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { type UserOptions, type Modality, type Database, type Language } from "../types.js";
import { isVerified, variantLabel } from "../verified-variants.js";
import {
  resolveInsertionPoints,
  cleanupInsertionPoints,
  KNOWN_FRONTEND_INSERTION_POINTS,
  type InsertionMap,
} from "./insertions.js";

// ---------------------------------------------------------------------------
// Tipos públicos
// ---------------------------------------------------------------------------

export type GenerateError =
  | { kind: "auth_requires_backend_database" }
  | { kind: "invalid_auth_transport" }
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
  return content.replaceAll("brixa-tpl", projectName);
}

// ---------------------------------------------------------------------------
// Fusión determinista de package.json con detección de conflicto
// ---------------------------------------------------------------------------

/**
 * Compara dos valores con igualdad profunda (vía serialización JSON).
 * Funciona para primitivos, arrays y objetos simples (sin referencias circulares).
 */
function deepEqual(a: unknown, b: unknown): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}

/**
 * Fusiona dos secciones de package.json (scripts, dependencies, etc.).
 *
 * - Si una clave existe en ambos con el MISMO valor → se conserva sin error.
 * - Si una clave existe en ambos con VALORES DISTINTOS → lanza error nombrando al contribuyente.
 * - Si una clave sólo existe en el overlay → se añade.
 *
 * @param contributorLabel Nombre del overlay/contribuyente, para el mensaje de error.
 */
export function mergeSection<T>(
  base?: Record<string, T>,
  overlay?: Record<string, T>,
  contributorLabel: string = "overlay",
): Record<string, T> | undefined {
  if (!base && !overlay) return undefined;
  const merged: Record<string, T> = { ...(base ?? {}) };
  if (overlay) {
    for (const [key, value] of Object.entries(overlay)) {
      if (key in merged) {
        if (!deepEqual(merged[key], value)) {
          throw new Error(
            `Conflicto en package.json: la clave "${key}" ya existe con un valor distinto. Contribuyente: "${contributorLabel}".`,
          );
        }
        // Mismo valor → no es conflicto, se conserva.
      } else {
        merged[key] = value;
      }
    }
  }
  return merged;
}

export function mergePackageJson(
  base: PackageJson,
  overlay: PackageJsonOverlay,
  contributorLabel: string = "overlay",
): PackageJson {
  const result: PackageJson = { ...base };

  const mergedAllowScripts = mergeSection(
    base.allowScripts,
    overlay.allowScripts,
    contributorLabel,
  );
  if (mergedAllowScripts) {
    result.allowScripts = mergedAllowScripts;
  }

  const mergedScripts = mergeSection(base.scripts, overlay.scripts, contributorLabel);
  if (mergedScripts) {
    result.scripts = mergedScripts;
  }

  const mergedDependencies = mergeSection(
    base.dependencies,
    overlay.dependencies,
    contributorLabel,
  );
  if (mergedDependencies) {
    result.dependencies = mergedDependencies;
  }

  const mergedDevDependencies = mergeSection(
    base.devDependencies,
    overlay.devDependencies,
    contributorLabel,
  );
  if (mergedDevDependencies) {
    result.devDependencies = mergedDevDependencies;
  }

  const mergedOverrides = mergeSection(base.overrides, overlay.overrides, contributorLabel);
  if (mergedOverrides) {
    result.overrides = mergedOverrides;
  }

  return result;
}

// ---------------------------------------------------------------------------
// Modificadores de archivos para persistencia PostgreSQL
// ---------------------------------------------------------------------------

/**
 * Parsea las asignaciones activas de un archivo .env / .env.example.
 * Ignora líneas vacías y comentarios (líneas que empiezan con #).
 */
export function parseEnvAssignments(content: string): Map<string, string> {
  const map = new Map<string, string>();
  for (const rawLine of content.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) {
      continue;
    }
    const match = line.match(/^([A-Za-z_][A-Za-z0-9_]*)=(.*)$/);
    if (match && match[1] !== undefined && match[2] !== undefined) {
      map.set(match[1], match[2]);
    }
  }
  return map;
}

/**
 * Fusiona de forma idempotente un bloque de variables de entorno en el contenido existente.
 *
 * - Si todas las variables del bloque ya existen con el mismo valor, no modifica el contenido.
 * - Si alguna variable ya existe con un valor diferente, lanza un Error explícito que nombra al contribuyente.
 * - Si contiene variables nuevas sin colisión, añade el bloque preservando comentarios y formato.
 */
export function mergeEnvExample(
  existingContent: string,
  newBlock: string,
  contributorLabel: string,
): string {
  const existingVars = parseEnvAssignments(existingContent);
  const newVars = parseEnvAssignments(newBlock);

  if (newVars.size === 0) {
    return existingContent;
  }

  let allExistSame = true;
  for (const [key, value] of newVars.entries()) {
    if (existingVars.has(key)) {
      const existingVal = existingVars.get(key) ?? "";
      if (existingVal !== value) {
        throw new Error(
          `Conflicto en .env.example al aplicar '${contributorLabel}': la variable '${key}' ya existe con un valor diferente (actual: '${existingVal}', nuevo: '${value}').`,
        );
      }
    } else {
      allExistSame = false;
    }
  }

  if (allExistSame) {
    return existingContent;
  }

  const separator = existingContent.length > 0 && !existingContent.endsWith("\n") ? "\n" : "";
  const blockWithNewline = newBlock.endsWith("\n") ? newBlock : `${newBlock}\n`;
  return `${existingContent}${separator}${blockWithNewline}`;
}

async function appendEnvBlock(
  envPath: string,
  block: string,
  contributorLabel: string,
): Promise<void> {
  let existing: string;
  try {
    existing = await fs.readFile(envPath, "utf-8");
  } catch {
    existing = "";
  }
  const merged = mergeEnvExample(existing, block, contributorLabel);
  await fs.writeFile(envPath, merged, "utf-8");
}

const runtimePostgresExample = "postgresql://app_exec:CLAVE@localhost:5432/NOMBRE_BD";
const composeRuntimeExample = "postgresql://app_exec:CLAVE@postgres:5432/app";
const composeSetup =
  "Configura DATABASE_URL para app_exec con host postgres en .env. Proporciona POSTGRES_PASSWORD únicamente al invocar Docker Compose. Inicia primero postgres, sigue ops/README.md del backend y aplica las migraciones indicadas abajo antes de iniciar Express.";
const migrationInstructions =
  "Proporciona MIGRATION_DATABASE_URL con el usuario table_owner mediante el entorno de la orden puntual de migración. Usa una URL postgresql://table_owner:CLAVE@HOST:5432/BD. Guarda únicamente DATABASE_URL de app_exec en el archivo .env del backend. Antes de migrar, sigue ops/README.md del backend para aprovisionar ambos roles.";

async function appendEnvExample(envPath: string, auth: boolean, docker: boolean): Promise<void> {
  const line = auth
    ? `DATABASE_URL=${docker ? composeRuntimeExample : runtimePostgresExample}\n# ${migrationInstructions}\n`
    : "DATABASE_URL=postgresql://USUARIO:CLAVE@localhost:5432/NOMBRE_BD\n";
  await appendEnvBlock(envPath, line, "PostgreSQL");
}

async function appendBackendReadmeDatabase(readmePath: string, auth: boolean): Promise<void> {
  const content = `
## Base de datos

Este backend incluye integración con PostgreSQL mediante Drizzle ORM.

### Configuración y flujo de trabajo

1. Configura la variable de entorno \`DATABASE_URL\` en tu archivo \`.env\`:

\`\`\`bash
DATABASE_URL=${auth ? runtimePostgresExample : "postgresql://USUARIO:CLAVE@localhost:5432/NOMBRE_BD"}
\`\`\`

Por seguridad, nunca confirmes credenciales reales al control de versiones.

2. Define tus tablas en \`src/db/schema\`.

3. Genera las migraciones SQL:
\`\`\`bash
npm run db:generate
\`\`\`

4. Aplica las migraciones en la base de datos:${auth ? "\n\n" + migrationInstructions : ""}
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

async function applyPostgresOverlay(
  targetBackendDir: string,
  language: Language,
  auth = false,
  docker = false,
): Promise<void> {
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
  await appendEnvExample(path.join(targetBackendDir, ".env.example"), auth, docker);

  // Añadir sección de base de datos a README.md
  await appendBackendReadmeDatabase(path.join(targetBackendDir, "README.md"), auth);
}

async function appendEnvExampleSqlite(envPath: string): Promise<void> {
  const line = "DATABASE_URL=file:./data/app.db\n";
  await appendEnvBlock(envPath, line, "SQLite");
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

async function appendEnvExampleDockerPostgres(
  envPath: string,
  authPostgres: boolean,
): Promise<void> {
  const content = `# Configuración para Docker Compose
# POSTGRES_PASSWORD es obligatoria para docker compose y debe ser alfanumérica.
POSTGRES_USER=postgres
${authPostgres ? "# Proporciona POSTGRES_PASSWORD desde el entorno de Docker Compose." : "POSTGRES_PASSWORD=ejemplo123"}
POSTGRES_DB=app
`;
  await appendEnvBlock(envPath, content, "Docker PostgreSQL");
}

function dockerMigrationCommand(language: Language, authPostgres: boolean): string {
  const command = language === "ts" ? "node dist/db/migrate.js" : "npm run db:migrate";
  return `docker compose run --rm ${authPostgres ? "-e MIGRATION_DATABASE_URL " : ""}backend ${command}`;
}

async function appendBackendReadmeDocker(
  readmePath: string,
  language: Language,
  database: Database,
  authPostgres = false,
): Promise<void> {
  const hasDb = database === "postgres" || database === "sqlite";

  let dbSection = "";
  if (hasDb) {
    const migrateCmd = dockerMigrationCommand(language, authPostgres);

    dbSection = `
### Migraciones de base de datos

> **Importante:** ejecuta \`npm run db:generate\` antes de \`docker compose build\`; sin la carpeta \`drizzle/\` el build falla (el directorio debe existir en la imagen).

Aplica las migraciones en la base de datos dentro del contenedor:${authPostgres ? "\n\n" + migrationInstructions + " En Compose usa postgres como host en ambas URLs, y pasa MIGRATION_DATABASE_URL desde el entorno de la orden puntual." : ""}

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
2. ${authPostgres ? composeSetup : "Si utilizas base de datos, asegúrate de configurar las variables de entorno requeridas en tu archivo `.env` (en PostgreSQL, `POSTGRES_PASSWORD` es obligatoria y debe ser alfanumérica)."}
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
  authPostgres = false,
): Promise<void> {
  const hasDb = database === "postgres" || database === "sqlite";

  let dbSection = "";
  if (hasDb) {
    const migrateCmd = dockerMigrationCommand(language, authPostgres);

    dbSection = `
### Migraciones de base de datos

> **Importante:** ejecuta \`npm run db:generate\` dentro de \`backend/\` antes de \`docker compose build\`; sin la carpeta \`drizzle/\` el build falla (el directorio debe existir en la imagen).

Aplica las migraciones en la base de datos desde la raíz del proyecto:${authPostgres ? "\n\n" + migrationInstructions + " En Compose usa postgres como host en ambas URLs, y pasa MIGRATION_DATABASE_URL desde el entorno de la orden puntual." : ""}

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
2. ${authPostgres ? composeSetup : "Si utilizas PostgreSQL, configura las variables de entorno requeridas en el archivo `.env` de la raíz (`POSTGRES_PASSWORD` es obligatoria y debe ser alfanumérica)."}
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
  authPostgres = false,
): Promise<void> {
  const dockerTemplates = path.join(templatesDir(), "docker");

  // 1. Dockerfile
  const hasDb = database === "postgres" || database === "sqlite";
  const dockerfileName = hasDb ? "Dockerfile.db" : "Dockerfile";
  const dockerfileSrc = path.join(dockerTemplates, language, dockerfileName);
  await fs.copyFile(dockerfileSrc, path.join(targetBackendDir, "Dockerfile"));

  // 2. .dockerignore
  const dockerignoreSrc = path.join(dockerTemplates, "_dockerignore");
  await fs.copyFile(dockerignoreSrc, path.join(targetBackendDir, ".dockerignore"));

  // 3. compose.yaml
  const composeSrc = path.join(dockerTemplates, `compose.${database}.yaml`);
  await fs.copyFile(composeSrc, path.join(targetBackendDir, "compose.yaml"));

  // 4. Variables de compose en .env.example si usa postgres
  if (database === "postgres") {
    await appendEnvExampleDockerPostgres(path.join(targetBackendDir, ".env.example"), authPostgres);
  }

  // 5. Sección Docker en README.md
  await appendBackendReadmeDocker(
    path.join(targetBackendDir, "README.md"),
    language,
    database,
    authPostgres,
  );
}

async function applyFullstackDockerOverlay(
  outputDir: string,
  frontendDest: string,
  backendDest: string,
  language: Language,
  database: Database,
  authPostgres = false,
): Promise<void> {
  const dockerTemplates = path.join(templatesDir(), "docker");
  const fullstackTemplates = path.join(dockerTemplates, "fullstack");

  // 1. Backend: Dockerfile y .dockerignore (sin compose.yaml)
  const hasDb = database === "postgres" || database === "sqlite";
  const dockerfileName = hasDb ? "Dockerfile.db" : "Dockerfile";
  const backendDockerfileSrc = path.join(dockerTemplates, language, dockerfileName);
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
    await appendEnvExampleDockerPostgres(path.join(outputDir, ".env.example"), authPostgres);
  }

  // 6. Raíz: README.md sección Docker
  await appendRootReadmeDockerFullstack(
    path.join(outputDir, "README.md"),
    language,
    database,
    authPostgres,
  );
}

// ---------------------------------------------------------------------------
// Overlay opcional: Documentación de API (OpenAPI 3 + Swagger UI)
// ---------------------------------------------------------------------------

async function appendEnvExampleApiDocs(envPath: string): Promise<void> {
  const line =
    "# Documentación de API (OpenAPI/Swagger UI). No habilitar en producción sin una decisión explícita.\nENABLE_API_DOCS=false\n";
  await appendEnvBlock(envPath, line, "API Docs");
}

async function appendBackendReadmeApiDocs(readmePath: string): Promise<void> {
  const content = `
## Documentación de API

El backend incluye documentación OpenAPI interactiva servida con Swagger UI.

### Activación y uso

Por seguridad, la documentación está desactivada por defecto para no exponer la estructura de la API en producción sin una decisión explícita.

Para activarla localmente:
1. Configura \`ENABLE_API_DOCS=true\` en tu archivo \`.env\`.
2. Accede en tu navegador a \`http://localhost:3000/docs\` (o \`http://localhost:3000/docs/\`).

### Mantenimiento de la especificación

La especificación OpenAPI reside en \`src/docs/openapi.json\` y se mantiene a mano. El backend incluye un test automatizado que compara las rutas registradas en Express con la especificación para detectar desincronizaciones.
`;
  try {
    const existing = await fs.readFile(readmePath, "utf-8");
    const separator = existing.endsWith("\n") ? "" : "\n";
    await fs.writeFile(readmePath, `${existing}${separator}${content.trimStart()}`, "utf-8");
  } catch {
    await fs.writeFile(readmePath, content.trimStart(), "utf-8");
  }
}

async function appendRootReadmeApiDocsFullstack(readmePath: string): Promise<void> {
  const content = `
## Documentación de API

La API incluye documentación OpenAPI interactiva servida con Swagger UI.

### Activación y uso

Por defecto está desactivada para evitar exponer la estructura de la API en producción.

Para activarla:
1. Configura \`ENABLE_API_DOCS=true\` en el archivo \`.env\` (en la raíz o en \`backend/.env\`).
2. Accede en el navegador a:
   - En desarrollo (con Vite): \`http://localhost:5173/api/docs/\` (o \`http://localhost:5173/api/docs\`).
   - Con Docker: \`http://localhost:8080/api/docs/\` (o \`http://localhost:8080/api/docs\`).
   (Se recomienda usar la barra final \`/api/docs/\`).

### Mantenimiento de la especificación

La especificación OpenAPI reside en \`backend/src/docs/openapi.json\` y se mantiene a mano. El backend incluye un test automatizado que detecta rutas registradas en Express no documentadas en la especificación.
`;
  try {
    const existing = await fs.readFile(readmePath, "utf-8");
    const separator = existing.endsWith("\n") ? "" : "\n";
    await fs.writeFile(readmePath, `${existing}${separator}${content.trimStart()}`, "utf-8");
  } catch {
    await fs.writeFile(readmePath, content.trimStart(), "utf-8");
  }
}

export const COMPOSE_API_DOCS_MARKER = "# @@INSERT:api-docs-env@@";

export async function appendComposeApiDocsEnv(composePath: string): Promise<void> {
  const content = await fs.readFile(composePath, "utf-8");
  if (content.includes("ENABLE_API_DOCS")) {
    return;
  }
  if (!content.includes(COMPOSE_API_DOCS_MARKER)) {
    throw new Error(
      `No se encontró el punto de inserción "${COMPOSE_API_DOCS_MARKER}" en ${composePath}.`,
    );
  }
  const updated = content.replace(
    COMPOSE_API_DOCS_MARKER,
    'ENABLE_API_DOCS: "${ENABLE_API_DOCS:-false}"',
  );
  await fs.writeFile(composePath, updated, "utf-8");
}

const COMPOSE_AUTH_MARKER = "# @@INSERT:auth-env@@";
const AUTH_ENV_EXAMPLE =
  "# Argon2id por proceso (0 en cola desactiva la espera)\nARGON2_MAX_CONCURRENT=2\nARGON2_MAX_QUEUE=8\n" +
  "SESSION_IDLE_TIMEOUT_MINUTES=30\nSESSION_MAX_LIFETIME_HOURS=12\n" +
  "ACTIVATION_TOKEN_EXPIRY_HOURS=24\n" +
  "LOGIN_IDENTIFIER_FAILURE_LIMIT=5\nLOGIN_IP_REQUEST_LIMIT=10\nLOGIN_ABUSE_WINDOW_MINUTES=15\n" +
  "LOGIN_ABUSE_HMAC_KEY=\nAUTH_TRUSTED_PROXIES=\n";

async function composeDockerEnv(outputDir: string, options: UserOptions): Promise<void> {
  const composePath = path.join(outputDir, "compose.yaml");
  const envPath = path.join(outputDir, ".env.example");
  if (options.apiDocs) {
    await appendComposeApiDocsEnv(composePath);
    await appendEnvExampleApiDocs(envPath);
  }
  if (options.auth) {
    const content = await fs.readFile(composePath, "utf8");
    if (!content.includes(COMPOSE_AUTH_MARKER)) {
      throw new Error(
        `No se encontró el punto de inserción "${COMPOSE_AUTH_MARKER}" en ${composePath}.`,
      );
    }
    let updated = content.replace(
      COMPOSE_AUTH_MARKER,
      () =>
        'ARGON2_MAX_CONCURRENT: "${ARGON2_MAX_CONCURRENT-2}"\n' +
        '      ARGON2_MAX_QUEUE: "${ARGON2_MAX_QUEUE-8}"\n' +
        '      SESSION_IDLE_TIMEOUT_MINUTES: "${SESSION_IDLE_TIMEOUT_MINUTES-30}"\n' +
        '      SESSION_MAX_LIFETIME_HOURS: "${SESSION_MAX_LIFETIME_HOURS-12}"\n' +
        '      ACTIVATION_TOKEN_EXPIRY_HOURS: "${ACTIVATION_TOKEN_EXPIRY_HOURS-24}"\n' +
        '      LOGIN_IDENTIFIER_FAILURE_LIMIT: "${LOGIN_IDENTIFIER_FAILURE_LIMIT-5}"\n' +
        '      LOGIN_IP_REQUEST_LIMIT: "${LOGIN_IP_REQUEST_LIMIT-10}"\n' +
        '      LOGIN_ABUSE_WINDOW_MINUTES: "${LOGIN_ABUSE_WINDOW_MINUTES-15}"\n' +
        '      LOGIN_ABUSE_HMAC_KEY: "${LOGIN_ABUSE_HMAC_KEY-}"\n' +
        '      AUTH_TRUSTED_PROXIES: "${AUTH_TRUSTED_PROXIES-}"\n' +
        '      AUTH_PUBLIC_ORIGIN: "${AUTH_PUBLIC_ORIGIN-}"',
    );
    if (options.database === "postgres") {
      const runtimeLine = /^ {6}DATABASE_URL: .+$/gm;
      if (updated.match(runtimeLine)?.length !== 1)
        throw new Error("Entrada DATABASE_URL de Compose inesperada.");
      updated = updated.replace(
        runtimeLine,
        '      DATABASE_URL: "${DATABASE_URL:?Se requiere la URL de app_exec}"',
      );
      if (options.modality === "fullstack") {
        await appendEnvBlock(envPath, `DATABASE_URL=${composeRuntimeExample}\n`, "Auth PostgreSQL");
      }
    }
    await fs.writeFile(composePath, updated, "utf8");
    if (options.modality === "fullstack")
      await appendEnvBlock(
        envPath,
        AUTH_ENV_EXAMPLE + "AUTH_PUBLIC_ORIGIN=https://app.example.test\n",
        "auth",
      );
  }
  await cleanupComposeInsertionPoints(composePath);
}

export async function cleanupComposeInsertionPoints(composePath: string): Promise<void> {
  try {
    const content = await fs.readFile(composePath, "utf-8");
    const cleaned = content.replace(/^[ \t]*# @@INSERT:[A-Za-z0-9_-]+@@\r?\n?/gm, "");
    if (cleaned !== content) {
      await fs.writeFile(composePath, cleaned, "utf-8");
    }
  } catch {
    // Si no existe compose.yaml, no hacer nada
  }
}

/**
 * Lee un archivo de fragmento del overlay api-docs y devuelve sus líneas,
 * descartando el salto de línea final si lo hubiera.
 */
async function readFragment(overlayDir: string, name: string): Promise<string[]> {
  const content = await fs.readFile(path.join(overlayDir, "_fragments", name), "utf-8");
  // Quitar el salto de línea final del archivo para no introducir líneas extra
  const trimmed = content.endsWith("\n") ? content.slice(0, -1) : content;
  return trimmed.split("\n");
}

async function applyApiDocsOverlay(targetBackendDir: string, language: Language): Promise<void> {
  const overlayDir = path.join(templatesDir(), "api-docs", language);

  // 1. Copiar archivos del overlay (docs/, tests/).
  //    _fragments/ se omite automáticamente por la convención de copyDir.
  await copyDir(overlayDir, targetBackendDir, path.basename(targetBackendDir));

  const contributor = "api-docs";
  const pkgPath = path.join(targetBackendDir, "package.json");
  const pkgRaw = await fs.readFile(pkgPath, "utf-8");
  const pkgJson = JSON.parse(pkgRaw) as PackageJson;

  const overlayDeps: PackageJsonOverlay = {
    allowScripts: {
      esbuild: false,
      "@scarf/scarf": false,
    },
    dependencies: {
      "swagger-ui-express": "5.0.1",
    },
    ...(language === "ts"
      ? {
          devDependencies: {
            "@types/swagger-ui-express": "4.1.8",
          },
        }
      : {}),
  };

  const merged = mergePackageJson(pkgJson, overlayDeps, contributor);
  await fs.writeFile(pkgPath, JSON.stringify(merged, null, 2) + "\n", "utf-8");

  await appendEnvExampleApiDocs(path.join(targetBackendDir, ".env.example"));
  await appendBackendReadmeApiDocs(path.join(targetBackendDir, "README.md"));
}

// ---------------------------------------------------------------------------
// Overlay opcional: Internacionalización (i18n)
// ---------------------------------------------------------------------------

async function applyI18nOverlay(targetFrontendDir: string, language: Language): Promise<void> {
  const overlayDir = path.join(templatesDir(), "i18n", language);

  // 1. Copiar archivos del overlay sobre la plantilla base
  await copyDir(overlayDir, targetFrontendDir, path.basename(targetFrontendDir));

  // 2. Inyectar import de inicialización en main
  const mainExt = language === "ts" ? "tsx" : "jsx";
  const mainPath = path.join(targetFrontendDir, "src", `main.${mainExt}`);
  const mainContent = await fs.readFile(mainPath, "utf-8");
  const i18nExt = language === "ts" ? "ts" : "js";
  const resolvedMain = resolveInsertionPoints(mainContent, {
    imports: [
      {
        contributor: "i18n",
        lines: [`import './i18n.${i18nExt}'`],
      },
    ],
  });
  await fs.writeFile(mainPath, resolvedMain, "utf-8");

  // 3. Fusionar package.json: añadir dependencias i18n y script check:i18n
  const pkgPath = path.join(targetFrontendDir, "package.json");
  const pkgRaw = await fs.readFile(pkgPath, "utf-8");
  const pkgJson = JSON.parse(pkgRaw) as PackageJson;

  const overlayDeps: PackageJsonOverlay = {
    scripts: {
      "check:i18n": "node scripts/check-i18n.mjs",
    },
    dependencies: {
      i18next: "26.5.12",
      "react-i18next": "17.1.9",
      "i18next-browser-languagedetector": "8.2.4",
    },
  };

  const merged = mergePackageJson(pkgJson, overlayDeps);
  await fs.writeFile(pkgPath, JSON.stringify(merged, null, 2) + "\n", "utf-8");
}

async function appendFrontendReadmeI18n(readmePath: string): Promise<void> {
  const content = `
## Internacionalización (i18n)

Este proyecto incluye soporte opcional de internacionalización con [i18next](https://www.i18next.com/) y [react-i18next](https://react.i18next.com/).

Idiomas incluidos de ejemplo: inglés (\`en\`) y español (\`es\`).

### Cómo añadir un idioma

1. Crea el archivo \`src/locales/<código>.json\` con las mismas claves que \`src/locales/en.json\`.
2. Importa el nuevo JSON en \`src/i18n.ts\` (o \`src/i18n.js\`) y regístralo en \`resources\`.
3. Añade el código a la lista \`supportedLngs\` en la configuración de i18next.
4. Añade la opción correspondiente en \`src/components/LanguageSelector\`.
5. Ejecuta \`npm run check:i18n\` para verificar la paridad de claves.

### Cómo añadir una clave de traducción

1. Añade la clave anidada en \`src/locales/en.json\` (el idioma de referencia).
2. Añade la correspondiente traducción en los demás archivos de idioma (\`src/locales/*.json\`).
3. Ejecuta \`npm run check:i18n\` para comprobar la coherencia de claves y marcadores.
4. En TypeScript, las claves se tipan automáticamente a partir de \`en.json\`.

### Verificación de paridad de traducciones

\`\`\`bash
npm run check:i18n
\`\`\`

### Límites conocidos

- El \`<title>\` del documento HTML es estático (no cambia dinámicamente según el idioma).
- Solo se contemplan idiomas con dirección de lectura de izquierda a derecha (LTR).
- El backend no incluye traducción de mensajes o respuestas.
- Sin carga diferida de traducciones (los recursos se empaquetan en el bundle inicial).
`;
  try {
    const existing = await fs.readFile(readmePath, "utf-8");
    const separator = existing.endsWith("\n") ? "" : "\n";
    await fs.writeFile(readmePath, `${existing}${separator}${content.trimStart()}`, "utf-8");
  } catch {
    await fs.writeFile(readmePath, content.trimStart(), "utf-8");
  }
}

async function appendRootReadmeI18nFullstack(readmePath: string): Promise<void> {
  const content = `
### Internacionalización (Frontend)
El frontend incluye soporte de internacionalización con i18next y selector de idioma. Consulta \`frontend/README.md\` para añadir idiomas o claves, y ejecuta \`npm run check:i18n\` dentro de \`frontend/\` para verificar paridad.
`;
  try {
    const existing = await fs.readFile(readmePath, "utf-8");
    const separator = existing.endsWith("\n") ? "" : "\n";
    await fs.writeFile(readmePath, `${existing}${separator}${content.trimStart()}`, "utf-8");
  } catch {
    await fs.writeFile(readmePath, content.trimStart(), "utf-8");
  }
}

async function copyAuthMigrations(source: string, destination: string): Promise<void> {
  const existing = await fs.lstat(destination).catch((error: unknown) => {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
  });
  const conflict = (entry: string) =>
    new Error(
      `Conflicto de migraciones Auth: "${entry}" no coincide con el historial de la plantilla.`,
    );
  if (existing) {
    if (!existing.isDirectory()) throw conflict(destination);
    const expected = new Map(
      (await fs.readdir(source, { recursive: true, withFileTypes: true })).map((entry) => [
        path.relative(source, path.join(entry.parentPath, entry.name)),
        entry,
      ]),
    );
    for (const entry of await fs.readdir(destination, { recursive: true, withFileTypes: true })) {
      const target = path.join(entry.parentPath, entry.name);
      const relative = path.relative(destination, target);
      const template = expected.get(relative);
      if (entry.isDirectory() && template?.isDirectory()) continue;
      if (
        !entry.isFile() ||
        !template?.isFile() ||
        !(await fs.readFile(target)).equals(await fs.readFile(path.join(source, relative)))
      ) {
        throw conflict(target);
      }
    }
  }
  await fs.cp(source, destination, { recursive: true, force: false });
}

async function documentAuthRoutes(backendDir: string, options: UserOptions) {
  const file = path.join(backendDir, "src/docs/openapi.json");
  const spec = JSON.parse(await fs.readFile(file, "utf8")) as {
    paths: Record<string, unknown>;
    servers?: { url: string }[];
    components?: Record<string, unknown>;
  };
  const bearer = options.authTransport === "bearer";
  if (options.modality === "fullstack") spec.servers = [{ url: "/api" }];
  if (bearer)
    spec.components = {
      ...spec.components,
      securitySchemes: {
        session: { type: "http", scheme: "bearer" },
      },
    };
  const credential = { type: "string", format: "password", maxLength: 128 };
  const requestBody = (properties: Record<string, unknown>) => ({
    required: true,
    content: {
      "application/json": {
        schema: {
          type: "object",
          properties,
          required: Object.keys(properties),
          additionalProperties: false,
        },
      },
    },
  });
  const jsonResponse = (key: string) => ({
    description: "Operación completada",
    content: {
      "application/json": {
        schema: {
          type: "object",
          properties: { [key]: { type: "string" } },
          required: [key],
        },
      },
    },
  });
  const rejected = {
    400: { description: "Solicitud inválida" },
    401: { description: "Credenciales o sesión no válidas" },
    403: { description: "Petición rechazada por las protecciones del transporte" },
    500: { description: "Error interno" },
  };
  const noContent = { description: "Operación completada sin cuerpo" };
  const retry = { headers: { "Retry-After": { schema: { type: "integer", minimum: 1 } } } };
  const secured = bearer
    ? { security: [{ session: [] }] }
    : { description: "Requiere la cookie de sesión." };
  const csrf = bearer
    ? {}
    : {
        parameters: [
          {
            name: "X-Requested-With",
            in: "header",
            required: true,
            schema: { type: "string", enum: ["XMLHttpRequest"], default: "XMLHttpRequest" },
          },
        ],
      };
  Object.assign(spec.paths, {
    "/auth/login": {
      post: {
        summary: "Iniciar sesión",
        ...csrf,
        requestBody: requestBody({
          email: { type: "string", format: "email" },
          password: credential,
        }),
        responses: {
          ...rejected,
          ...(bearer ? { 200: jsonResponse("token") } : { 204: noContent }),
          429: { description: "Límite de intentos alcanzado", ...retry },
          503: { description: "Verificación saturada", ...retry },
        },
      },
    },
    "/auth/session": {
      get: {
        summary: "Consultar la sesión",
        ...secured,
        responses: { ...rejected, 200: jsonResponse("userId") },
      },
    },
    "/auth/logout": {
      post: {
        summary: "Cerrar sesión",
        ...secured,
        ...csrf,
        responses: { ...rejected, 204: noContent },
      },
    },
    "/auth/password": {
      post: {
        summary: "Cambiar la contraseña",
        ...secured,
        ...csrf,
        requestBody: requestBody({ currentPassword: credential, newPassword: credential }),
        responses: {
          ...rejected,
          204: noContent,
          503: { description: "Verificación saturada", ...retry },
        },
      },
    },
  });
  await fs.writeFile(file, JSON.stringify(spec, null, 2) + "\n", "utf8");
}

async function applyAuthOverlay(
  backendDir: string,
  language: Language,
  database: Database,
  options: UserOptions,
  composeRoot?: string,
): Promise<void> {
  const overlay = path.join(templatesDir(), "auth", language);
  const pkgPath = path.join(backendDir, "package.json");
  const base = JSON.parse(await fs.readFile(pkgPath, "utf8")) as PackageJson;
  const additions = JSON.parse(
    await fs.readFile(path.join(overlay, "package.json"), "utf8"),
  ) as PackageJsonOverlay;
  const merged = mergePackageJson(base, additions, "auth");
  const persistence = path.join(templatesDir(), `auth-${database}`);
  if (database === "postgres") {
    await fs.cp(path.join(persistence, "ops"), path.join(backendDir, "ops"), {
      recursive: true,
      errorOnExist: true,
      force: false,
    });
  } else {
    await fs.appendFile(
      path.join(backendDir, "README.md"),
      "\n### Auditoría SQLite\n\nLa migración 0002 protege los eventos existentes mediante triggers y una tabla WITHOUT ROWID. La migración reconstruye la tabla y sus índices de Brixa. Si has añadido índices, triggers o referencias a esta tabla, revisa su conservación antes de migrar. Las inserciones con identificador nuevo siguen permitidas. La protección requiere conservar el esquema y sus triggers en futuras migraciones. Quien pueda alterar el esquema o reemplazar el archivo puede modificar el historial. SQLite carece de separación de privilegios por tabla como la de PostgreSQL.\n",
    );
  }
  await copyAuthMigrations(path.join(persistence, "drizzle"), path.join(backendDir, "drizzle"));
  await copyDir(path.join(persistence, language), backendDir, path.basename(backendDir));
  await copyDir(overlay, backendDir, path.basename(backendDir));
  if (options.apiDocs) await documentAuthRoutes(backendDir, options);
  const mode = options.authTransport ?? "cookie";
  const origin =
    options.modality === "fullstack" ? "http://localhost:5173" : "http://localhost:3000";
  await appendEnvBlock(
    path.join(backendDir, ".env.example"),
    AUTH_ENV_EXAMPLE +
      (composeRoot === backendDir
        ? "AUTH_PUBLIC_ORIGIN=https://app.example.test\n"
        : `NODE_ENV=development\nAUTH_PUBLIC_ORIGIN=${origin}\n`),
    "auth",
  );
  await fs.writeFile(pkgPath, JSON.stringify(merged, null, 2) + "\n", "utf8");
  const postgres = database === "postgres";
  const local = postgres
    ? "Proporciona `MIGRATION_DATABASE_URL` de `table_owner` desde el entorno de la orden puntual. Consulta `ops/README.md` para aprovisionar los roles."
    : "Configura `DATABASE_URL` con la misma ruta SQLite en archivo que usa el backend.";
  await fs.appendFile(
    path.join(backendDir, "README.md"),
    `\n## Administrador inicial\n\nDesde el directorio del backend, aplica las migraciones y ejecuta \`npm run auth:bootstrap\` en una terminal. Introduce el email y la contraseña dos veces. La contraseña se introduce de forma oculta. ${local}\n\nPara recuperar la contraseña de esa cuenta activa, ejecuta \`npm run auth:recover-admin\` en una terminal y confirma la nueva contraseña. El comando revoca todas sus sesiones. ${local}\n\n## Caducidad de activación\n\nConfigura \`ACTIVATION_TOKEN_EXPIRY_HOURS\` en el entorno del backend (entero de 1 a 168, 24 por defecto).\n\n## Contadores de abuso de login\n\nConfigura \`LOGIN_IDENTIFIER_FAILURE_LIMIT\` (5), \`LOGIN_IP_REQUEST_LIMIT\` (10) y \`LOGIN_ABUSE_WINDOW_MINUTES\` (15) con enteros positivos hasta 2147483647. Genera \`LOGIN_ABUSE_HMAC_KEY\` con \`openssl rand -hex 32\` y configura la misma clave secreta en todas las instancias que compartan BD. Cambiarla reinicia efectivamente los presupuestos existentes. Con Compose, define estas variables en el entorno o en el archivo \`.env\` de la raíz. La primera solicitud por IP o el primer fallo por identificador abren ventanas independientes. La última plaza se contabiliza y los rechazos posteriores no aplazan el vencimiento. Solo se almacenan claves HMAC, recuentos y vencimientos. SQLite en archivo utiliza el reloj del host compartido. El login consume primero el presupuesto de una IP validada y luego reserva una plaza por identificador durante 60 segundos. Los fallos confirmados y las reservas activas ocupan el presupuesto durante la admisión. Las reservas vencidas liberan su plaza y una verificación tardía no puede emitir sesión. En cada solicitud admitida por IP, la limpieza procesa hasta 100 contadores y 100 reservas vencidas. El adaptador HTTP proporciona una IP confiable y convierte el tiempo restante a Retry-After.\n`,
  );
  await fs.appendFile(
    path.join(backendDir, "README.md"),
    "\n## Auth HTTP\n\n" +
      "El backend monta `/auth/login`, `/auth/session`, `/auth/logout` y `/auth/password`. " +
      (options.modality === "fullstack"
        ? "Desde el frontend utiliza `/api/auth/…` en el mismo origen. "
        : "") +
      (mode === "cookie"
        ? "El login devuelve 204 y fija una cookie HttpOnly. Envía `X-Requested-With: XMLHttpRequest` en las mutaciones mediante fetch y conserva las cookies del mismo origen. El navegador proporciona Origin o Referer. "
        : "El login devuelve `{ token }`. Envía `Authorization: Bearer <token>` al consultar la sesión, cerrar sesión o cambiar la contraseña. ") +
      "Si habilitas API Docs, utiliza una sesión válida para `/docs/` y todos sus recursos. " +
      (mode === "bearer"
        ? "Cada petición de documentación requiere la cabecera Authorization, incluidas las de recursos estáticos. "
        : "") +
      "\n\nConfigura `AUTH_PUBLIC_ORIGIN` con el origen público canónico, sin barra final. " +
      "HTTPS es obligatorio salvo desarrollo explícito con `NODE_ENV=development`, origen localhost o 127.0.0.1 y conexión local. " +
      "Para Compose configura el origen HTTPS público en el `.env` raíz. Si utilizas varios orígenes de desarrollo, ajusta el origen configurado al puerto que realmente utiliza Vite.\n\n" +
      "Deja `AUTH_TRUSTED_PROXIES` vacío para conexiones directas. Detrás de un proxy, configura solo las IP literales de los saltos controlados, separadas por comas. " +
      "El proxy de entrada debe eliminar `X-Forwarded-For` y `X-Forwarded-Proto` del cliente. Construye la cadena con IP verificadas y entrega un único valor `https` al backend si la conexión pública se estableció mediante TLS. " +
      "Si TLS termina antes del Nginx de fullstack, limita el acceso a su listener al terminador confiable y configura allí el valor https de X-Forwarded-Proto para las conexiones reenviadas por ese terminador. Restringe el acceso directo al backend. " +
      "Express camina desde el socket hasta el primer salto no confiable. No se admiten nombres, rangos ni conteos de saltos.\n",
  );
  if (composeRoot) {
    const args = postgres ? "-e MIGRATION_DATABASE_URL " : "";
    const entry = language === "ts" ? "node dist/auth/bootstrap-cli.js" : "npm run auth:bootstrap";
    const recovery =
      language === "ts" ? "node dist/auth/recover-admin-cli.js" : "npm run auth:recover-admin";
    const migration = postgres
      ? "Usa el host `postgres` en `MIGRATION_DATABASE_URL` y proporciona la variable desde el entorno de esta orden. Conserva `DATABASE_URL` de `app_exec` en el backend."
      : "El contenedor puntual usa el mismo volumen SQLite que el backend.";
    await fs.appendFile(
      path.join(composeRoot, "README.md"),
      `\n### Bootstrap y recuperación interactivos con Compose\n\nDesde la raíz del proyecto, después de construir la imagen y aplicar las migraciones, ejecuta el comando con una terminal interactiva. ${migration}\n\n\`\`\`bash\ndocker compose run --rm ${args}backend ${entry}\ndocker compose run --rm ${args}backend ${recovery}\n\`\`\`\n\nCompose toma \`ACTIVATION_TOKEN_EXPIRY_HOURS\` del entorno o del archivo \`.env\` de la raíz (24 por defecto).\n\nLos contadores de login también toman de ese entorno \`LOGIN_ABUSE_WINDOW_MINUTES\`, \`LOGIN_IDENTIFIER_FAILURE_LIMIT\`, \`LOGIN_IP_REQUEST_LIMIT\` y la clave secreta \`LOGIN_ABUSE_HMAC_KEY\`. Consulta la sección de contadores en el README del backend.\n`,
    );
  }
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
  if (options.auth && (modality === "frontend" || database === "none")) {
    return { ok: false, error: { kind: "auth_requires_backend_database" } };
  }

  if (
    options.authTransport !== undefined &&
    (!options.auth ||
      !["cookie", "bearer"].includes(options.authTransport) ||
      (modality === "fullstack" && options.authTransport !== "cookie"))
  ) {
    return { ok: false, error: { kind: "invalid_auth_transport" } };
  }

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

  // Resumen previo a la generación
  if (!isVerified(options)) {
    const label = variantLabel(options);
    console.warn(
      `\nNota: combinación experimental (${label}), aún no verificada de extremo a extremo por Brixa.\n`,
    );
  }

  if (modality === "fullstack") {
    try {
      const projectName = path.basename(outputDir);
      const frontendTpl = language === "ts" ? "frontend-react-ts" : "frontend-react-js";
      const backendTpl = language === "ts" ? "backend-express-ts" : "backend-express-js";

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

      await applyFullstackViteProxy(frontendDest, language);

      const readmeContent = generateFullstackReadme(projectName, language);
      await fs.writeFile(path.join(outputDir, "README.md"), readmeContent, "utf-8");

      if (database === "postgres") {
        await applyPostgresOverlay(backendDest, language, options.auth);
        await appendRootReadmeDatabase(path.join(outputDir, "README.md"));
      } else if (database === "sqlite") {
        await applySqliteOverlay(backendDest, language);
        await appendRootReadmeDatabaseSqlite(path.join(outputDir, "README.md"));
      }

      if (options.apiDocs) {
        await applyApiDocsOverlay(backendDest, language);
        await appendRootReadmeApiDocsFullstack(path.join(outputDir, "README.md"));
      }

      if (options.docker) {
        await applyFullstackDockerOverlay(
          outputDir,
          frontendDest,
          backendDest,
          language,
          database,
          options.auth && database === "postgres",
        );
        await composeDockerEnv(outputDir, options);
      }

      if (options.i18n) {
        await applyI18nOverlay(frontendDest, language);
        await appendFrontendReadmeI18n(path.join(frontendDest, "README.md"));
        await appendRootReadmeI18nFullstack(path.join(outputDir, "README.md"));
      }

      if (options.auth)
        await applyAuthOverlay(
          backendDest,
          language,
          database,
          options,
          options.docker ? outputDir : undefined,
        );
      await cleanupUnresolvedFrontendInsertionPoints(frontendDest, language);
      await composeBackendInsertionPoints(backendDest, options);

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

    if (modality === "frontend") {
      if (options.i18n) {
        await applyI18nOverlay(outputDir, language);
        await appendFrontendReadmeI18n(path.join(outputDir, "README.md"));
      }
      await cleanupUnresolvedFrontendInsertionPoints(outputDir, language);
    }

    if (modality === "backend") {
      if (database === "postgres") {
        await applyPostgresOverlay(outputDir, language, options.auth, options.docker);
      } else if (database === "sqlite") {
        await applySqliteOverlay(outputDir, language);
      }
      if (options.apiDocs) {
        await applyApiDocsOverlay(outputDir, language);
      }
      if (options.docker) {
        await applyDockerOverlay(
          outputDir,
          language,
          database,
          options.auth && database === "postgres",
        );
        await composeDockerEnv(outputDir, options);
      }
      if (options.auth)
        await applyAuthOverlay(
          outputDir,
          language,
          database,
          options,
          options.docker ? outputDir : undefined,
        );
      await composeBackendInsertionPoints(outputDir, options);
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
    // Directorios con prefijo _ que no corresponden a un renombrado conocido se omiten.
    // Convención: _fragments/ contiene archivos de fragmento internos, no para copiar.
    if (
      entry.name.startsWith("_") &&
      entry.name !== "_gitignore" &&
      entry.name !== "_dockerignore"
    ) {
      continue;
    }
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

async function composeBackendInsertionPoints(
  backendDir: string,
  options: UserOptions,
): Promise<void> {
  for (const basename of ["app", "index"] as const) {
    const file = path.join(backendDir, "src", `${basename}.${options.language}`);
    const content = await fs.readFile(file, "utf8");
    const cleaned = cleanupInsertionPoints(content);
    const insertions: InsertionMap = {};
    const add = (point: string, contributor: string, lines: string[]) => {
      (insertions[point] ??= []).push({ contributor, lines });
    };
    const contributors = [];
    if (options.apiDocs) contributors.push("api-docs");
    if (options.auth && basename === "index") contributors.push("auth");
    if (options.auth && options.database === "postgres" && basename === "index")
      contributors.push("auth-postgres");
    for (const contributor of contributors) {
      const overlay = path.join(templatesDir(), contributor, options.language);
      for (const point of ["imports", basename === "app" ? "routes" : "startup"]) {
        const lines = await readFragment(overlay, `${basename}.${point}`);
        if (options.auth && basename === "app" && point === "routes") {
          lines[0] = "setupApiDocs(app, protectApiDocs);";
        }
        add(point, contributor, lines);
      }
    }
    if (options.auth && basename === "app") {
      add("imports", "auth", [
        options.apiDocs
          ? 'import { authRoutes, protectApiDocs } from "./auth/http-runtime.js";'
          : 'import { authRoutes } from "./auth/http-runtime.js";',
      ]);
      add("beforeJson", "auth", ['app.use("/auth", authRoutes);']);
    }
    if (options.auth && basename === "index") {
      const name =
        "brixa-session-" +
        createHash("sha256")
          .update(path.basename(path.resolve(options.outputDir)))
          .digest("hex")
          .slice(0, 20);
      const sqlite = options.database === "sqlite";
      add("startup", "http-auth", [
        'const { initializeAuthHttp } = await import("./auth/http-runtime.js");',
        'const { db } = await import("./db/client.js");',
        ...(sqlite
          ? [
              'const { sqliteActivationDatabase } = await import("./db/activation-write.js");',
              'const { requirePersistentSqliteUrl } = await import("./db/local-admin.js");',
              "const writer = sqliteActivationDatabase({ url: requirePersistentSqliteUrl(process.env.DATABASE_URL) });",
            ]
          : ["const writer = db;"]),
        `await initializeAuthHttp(${JSON.stringify(options.authTransport ?? "cookie")}, ${JSON.stringify(name)}, db, writer);`,
      ]);
    }
    const result = Object.keys(insertions).length
      ? resolveInsertionPoints(content, insertions)
      : cleaned;
    if (result !== content) await fs.writeFile(file, result, "utf8");
  }
}

export async function applyFullstackViteProxy(
  frontendDest: string,
  language: Language,
): Promise<void> {
  const viteFile = language === "ts" ? "vite.config.ts" : "vite.config.js";
  const vitePath = path.join(frontendDest, viteFile);
  const content = await fs.readFile(vitePath, "utf-8");

  const insertions: InsertionMap = {
    imports: [
      {
        contributor: "fullstack-proxy",
        lines: ["import process from 'node:process'"],
      },
    ],
    config: [
      {
        contributor: "fullstack-proxy",
        lines: [
          "server: {",
          "  proxy: {",
          "    '/api': {",
          "      target: process.env.BACKEND_URL || 'http://localhost:3000',",
          "      changeOrigin: true,",
          "      rewrite: (path) => path.replace(/^\\/api(?=\\/|$)/, ''),",
          "    },",
          "  },",
          "},",
        ],
      },
    ],
  };

  const resolved = resolveInsertionPoints(content, insertions);
  await fs.writeFile(vitePath, resolved, "utf-8");
}

export async function cleanupUnresolvedFrontendInsertionPoints(
  frontendDir: string,
  language: Language,
): Promise<void> {
  const mainExt = language === "ts" ? "tsx" : "jsx";
  const viteExt = language === "ts" ? "ts" : "js";
  const files = [
    path.join(frontendDir, "src", `main.${mainExt}`),
    path.join(frontendDir, `vite.config.${viteExt}`),
  ];
  for (const file of files) {
    let content: string;
    try {
      content = await fs.readFile(file, "utf-8");
    } catch (err) {
      if ((err as NodeJS.ErrnoException).code === "ENOENT") {
        continue;
      }
      throw err;
    }
    const cleaned = cleanupInsertionPoints(content, KNOWN_FRONTEND_INSERTION_POINTS);
    if (cleaned !== content) {
      await fs.writeFile(file, cleaned, "utf-8");
    }
  }
}

// ---------------------------------------------------------------------------
// Generación del README raíz para proyectos fullstack
// ---------------------------------------------------------------------------

function generateFullstackReadme(projectName: string, language: string): string {
  const langLabel = language === "ts" ? "TypeScript" : "JavaScript";
  return `# ${projectName}

Aplicación fullstack generada con Brixa.

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

El proxy de Vite es exclusivo para desarrollo local. El despliegue en producción no está resuelto por Brixa. Para producción es necesario:

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
    case "auth_requires_backend_database":
      return "Auth requiere un backend con base de datos.";
    case "invalid_auth_transport":
      return "Usa cookies o Bearer con Auth en un backend independiente. Fullstack solo admite cookies.";
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
 * Si la combinación no está entre las verificadas, incluye un aviso EXPERIMENTAL.
 */
export function nextStepsMessage(
  outputDir: string,
  modality?: Modality,
  database?: Database,
  docker?: boolean,
  language?: Language,
  apiDocs?: boolean,
  i18n?: boolean,
): string {
  const name = path.basename(outputDir);

  const experimentalWarning =
    modality && language && !isVerified({ modality, language, database, docker, apiDocs, i18n })
      ? "\n  Combinación experimental (" +
        variantLabel({ modality, language, database, docker, apiDocs, i18n }) +
        "). Si algo falla, abre un issue: https://github.com/acjoell/brixa/issues"
      : "";

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
      );
      if (database === "postgres" || database === "sqlite") {
        lines.push(
          "  # (Importante: ejecuta npm run db:generate dentro de backend/ antes de docker compose build; sin la carpeta drizzle/ el build falla)",
        );
      }
      lines.push(
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

    if (apiDocs) {
      lines.push(
        "",
        "  # Documentación de API:",
        "  # 1. Configura ENABLE_API_DOCS=true en .env para activarla",
        "  # 2. Accede en el navegador a http://localhost:5173/api/docs/ (o http://localhost:8080/api/docs/ con Docker)",
      );
    }

    if (i18n) {
      lines.push(
        "",
        "  # Internacionalización:",
        "  # Verifica paridad de claves y marcadores:",
        "  cd frontend && npm run check:i18n && cd ..",
      );
    }

    if (experimentalWarning) lines.push(experimentalWarning);
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
    );
    if (database === "postgres" || database === "sqlite") {
      lines.push(
        "  # (Importante: ejecuta npm run db:generate antes de docker compose build; sin la carpeta drizzle/ el build falla)",
      );
    }
    lines.push("  docker compose up -d");
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

  if (apiDocs) {
    lines.push(
      "",
      "  # Documentación de API:",
      "  # 1. Configura ENABLE_API_DOCS=true en .env para activarla",
      "  # 2. Accede en el navegador a http://localhost:3000/docs",
    );
  }

  if (i18n) {
    lines.push(
      "",
      "  # Internacionalización:",
      "  # Verifica paridad de claves y marcadores:",
      "  npm run check:i18n",
    );
  }

  if (experimentalWarning) lines.push(experimentalWarning);
  lines.push("");
  return lines.join("\n");
}
