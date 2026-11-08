/**
 * Brixa — orquestación de la generación de proyectos.
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
import { isVerified, variantLabel } from "../verified-variants.js";
import { resolveInsertionPoints, cleanupInsertionPoints, type InsertionMap } from "./insertions.js";

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

> **Importante:** ejecuta \`npm run db:generate\` antes de \`docker compose build\`; sin la carpeta \`drizzle/\` el build falla (el directorio debe existir en la imagen).

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

> **Importante:** ejecuta \`npm run db:generate\` dentro de \`backend/\` antes de \`docker compose build\`; sin la carpeta \`drizzle/\` el build falla (el directorio debe existir en la imagen).

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
    await appendEnvExampleDockerPostgres(path.join(outputDir, ".env.example"));
  }

  // 6. Raíz: README.md sección Docker
  await appendRootReadmeDockerFullstack(path.join(outputDir, "README.md"), language, database);
}

// ---------------------------------------------------------------------------
// Overlay opcional: Documentación de API (OpenAPI 3 + Swagger UI)
// ---------------------------------------------------------------------------

async function appendEnvExampleApiDocs(envPath: string): Promise<void> {
  const line =
    "# Documentación de API (OpenAPI/Swagger UI). No habilitar en producción sin una decisión explícita.\nENABLE_API_DOCS=false\n";
  try {
    const existing = await fs.readFile(envPath, "utf-8");
    const separator = existing.endsWith("\n") ? "" : "\n";
    await fs.writeFile(envPath, `${existing}${separator}${line}`, "utf-8");
  } catch {
    await fs.writeFile(envPath, line, "utf-8");
  }
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

async function appendComposeApiDocsEnv(composePath: string): Promise<void> {
  try {
    const content = await fs.readFile(composePath, "utf-8");
    if (content.includes("ENABLE_API_DOCS")) {
      return;
    }
    const updated = content.replace(
      /(services:\s*\n\s*backend:\s*\n(?:.*\n)*?\s*environment:\s*\n)/,
      `$1      ENABLE_API_DOCS: "\${ENABLE_API_DOCS:-false}"\n`,
    );
    await fs.writeFile(composePath, updated, "utf-8");
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

  // 1. Copiar archivos del overlay (docs/, tests/, tsconfig.json si existe).
  //    _fragments/ se omite automáticamente por la convención de copyDir.
  await copyDir(overlayDir, targetBackendDir, path.basename(targetBackendDir));

  // 2. Resolver puntos de inserción en app y index.
  const ext = language === "ts" ? "ts" : "js";
  const contributor = "api-docs";

  for (const basename of ["app", "index"] as const) {
    const srcFile = path.join(targetBackendDir, "src", `${basename}.${ext}`);
    const baseContent = await fs.readFile(srcFile, "utf-8");

    const insertions: InsertionMap = {};

    // Importaciones (tanto app como index tienen el punto imports)
    const importsFragment = await readFragment(overlayDir, `${basename}.imports`);
    insertions["imports"] = [{ contributor, lines: importsFragment }];

    // Punto específico de cada archivo
    if (basename === "app") {
      const routesFragment = await readFragment(overlayDir, "app.routes");
      insertions["routes"] = [{ contributor, lines: routesFragment }];
    } else {
      const startupFragment = await readFragment(overlayDir, "index.startup");
      insertions["startup"] = [{ contributor, lines: startupFragment }];
    }

    const resolved = resolveInsertionPoints(baseContent, insertions);
    await fs.writeFile(srcFile, resolved, "utf-8");
  }

  // 3. Fusionar package.json deterministamente con detección de conflicto.
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
  if (!merged.allowScripts) {
    merged.allowScripts = {};
  }
  merged.allowScripts["@scarf/scarf"] = false;

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

  // 2. Fusionar package.json: añadir dependencias i18n y script check:i18n
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

  // Resumen previo a la generación
  const verified = isVerified({
    modality,
    language,
    database,
    docker: options.docker,
    apiDocs: options.apiDocs,
    i18n: options.i18n,
  });
  if (!verified) {
    const label = variantLabel({
      modality,
      language,
      database,
      docker: options.docker,
      apiDocs: options.apiDocs,
      i18n: options.i18n,
    });
    console.warn(
      `\nNota: combinación experimental (${label}), aún no verificada de extremo a extremo por Brixa.\n`,
    );
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

      if (options.apiDocs) {
        await applyApiDocsOverlay(backendDest, language);
        await appendRootReadmeApiDocsFullstack(path.join(outputDir, "README.md"));
      }

      if (options.docker) {
        await applyFullstackDockerOverlay(outputDir, frontendDest, backendDest, language, database);
        if (options.apiDocs) {
          await appendComposeApiDocsEnv(path.join(outputDir, "compose.yaml"));
          await appendEnvExampleApiDocs(path.join(outputDir, ".env.example"));
        }
      }

      if (options.i18n) {
        await applyI18nOverlay(frontendDest, language);
        await appendFrontendReadmeI18n(path.join(frontendDest, "README.md"));
        await appendRootReadmeI18nFullstack(path.join(outputDir, "README.md"));
      }

      await cleanupUnresolvedInsertionPoints(backendDest, language);

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

    if (modality === "frontend" && options.i18n) {
      await applyI18nOverlay(outputDir, language);
      await appendFrontendReadmeI18n(path.join(outputDir, "README.md"));
    }

    if (modality === "backend") {
      if (database === "postgres") {
        await applyPostgresOverlay(outputDir, language);
      } else if (database === "sqlite") {
        await applySqliteOverlay(outputDir, language);
      }
      if (options.apiDocs) {
        await applyApiDocsOverlay(outputDir, language);
      }
      if (options.docker) {
        await applyDockerOverlay(outputDir, language, database);
        if (options.apiDocs) {
          await appendComposeApiDocsEnv(path.join(outputDir, "compose.yaml"));
          await appendEnvExampleApiDocs(path.join(outputDir, ".env.example"));
        }
      }
      await cleanupUnresolvedInsertionPoints(outputDir, language);
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

async function cleanupUnresolvedInsertionPoints(
  backendDir: string,
  language: Language,
): Promise<void> {
  const ext = language === "ts" ? "ts" : "js";
  for (const basename of ["app", "index"] as const) {
    const file = path.join(backendDir, "src", `${basename}.${ext}`);
    let content: string;
    try {
      content = await fs.readFile(file, "utf-8");
    } catch (err) {
      if ((err as NodeJS.ErrnoException).code === "ENOENT") {
        continue;
      }
      throw err;
    }
    const cleaned = cleanupInsertionPoints(content);
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
