import { writeProjectDocs } from "./documentation.js";
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
  DEFAULT_AUTH_APP_MODE,
  DEFAULT_AUTH_TRANSPORT,
  formatAuthOptionsError,
  validateAuthOptions,
  type AuthOptionsError,
} from "../validation/options.js";
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
  | AuthOptionsError
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
async function appendEnvExample(envPath: string, docker: boolean): Promise<void> {
  const migrationInstructions = docker
    ? "Para Compose, usa el .env raíz protegido. MIGRATION_DATABASE_URL solo se entrega al proceso puntual. Consulta docs/deployment.md."
    : "Guarda solo DATABASE_URL de app_exec en este .env. Proporciona MIGRATION_DATABASE_URL de table_owner por separado para las operaciones puntuales. Consulta ops/README.md.";
  const line = `DATABASE_URL=${docker ? composeRuntimeExample : runtimePostgresExample}\n# ${migrationInstructions}\n`;
  await appendEnvBlock(envPath, line, "PostgreSQL");
}

async function applyPostgresOverlay(
  targetBackendDir: string,
  language: Language,
  docker = false,
): Promise<void> {
  const overlayDir = path.join(templatesDir(), "database-postgres", language);
  await copyDir(overlayDir, targetBackendDir, path.basename(targetBackendDir));
  await copyTemplate(
    path.join(templatesDir(), "database-postgres", "ops"),
    path.join(targetBackendDir, "ops"),
    path.basename(targetBackendDir),
  );

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
  await appendEnvExample(path.join(targetBackendDir, ".env.example"), docker);
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
}

// ---------------------------------------------------------------------------
// Modificadores de archivos para overlay Docker
// ---------------------------------------------------------------------------

async function appendEnvExampleDockerPostgres(envPath: string): Promise<void> {
  const content = `# Configuración para Docker Compose
# Proporciona POSTGRES_PASSWORD solo a Compose para el servicio PostgreSQL.
POSTGRES_USER=postgres
POSTGRES_DB=app
`;
  await appendEnvBlock(envPath, content, "Docker PostgreSQL");
}

function dockerMigrationCommand(language: Language, postgres: boolean): string {
  const command = language === "ts" ? "node dist/db/migrate.js" : "npm run db:migrate";
  return `docker compose run --rm ${postgres ? "-e MIGRATION_DATABASE_URL " : ""}backend ${command}`;
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
}

async function applyFullstackDockerOverlay(
  outputDir: string,
  frontendDest: string,
  backendDest: string,
  language: Language,
  database: Database,
  auth = false,
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
    await appendEnvExample(path.join(outputDir, ".env.example"), true);
  }

  if (auth) {
    await fs.copyFile(
      path.join(fullstackTemplates, "compose.tls.yaml"),
      path.join(outputDir, "compose.tls.yaml"),
    );
    await fs.copyFile(
      path.join(frontendTemplates, "nginx.tls.conf"),
      path.join(frontendDest, "nginx.tls.conf"),
    );
    await appendEnvBlock(
      path.join(outputDir, ".env.example"),
      "# Solo con compose.tls.yaml. Completa las rutas absolutas fuera del proyecto.\n" +
        "TLS_CERT_PATH=\nTLS_KEY_PATH=\nTLS_CA_PATH=\nTLS_PORT=8443\n" +
        "TLS_SUBNET=172.30.240.0/28\nTLS_DYNAMIC_RANGE=172.30.240.8/29\nTLS_NGINX_IP=172.30.240.2\n",
      "Docker TLS",
    );
  }
}

// ---------------------------------------------------------------------------
// Overlay opcional: Documentación de API (OpenAPI 3 + Swagger UI)
// ---------------------------------------------------------------------------

async function appendEnvExampleApiDocs(envPath: string): Promise<void> {
  const line =
    "# Documentación de API (OpenAPI/Swagger UI). No habilitar en producción sin una decisión explícita.\nENABLE_API_DOCS=false\n";
  await appendEnvBlock(envPath, line, "API Docs");
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
  "AUTH_PASSWORD_MIN_LENGTH=10\nAUTH_PASSWORD_MAX_LENGTH=64\n" +
  "ACTIVATION_TOKEN_EXPIRY_HOURS=24\nACTIVATION_PAGE_URL=\n" +
  "ACTIVATION_IP_REQUEST_LIMIT=10\nACTIVATION_ABUSE_WINDOW_MINUTES=15\n" +
  "ACTIVATION_VALIDATION_IP_REQUEST_LIMIT=20\nACTIVATION_VALIDATION_ABUSE_WINDOW_MINUTES=15\n" +
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
    const updated = content.replace(
      COMPOSE_AUTH_MARKER,
      () =>
        'ARGON2_MAX_CONCURRENT: "${ARGON2_MAX_CONCURRENT-2}"\n' +
        '      ARGON2_MAX_QUEUE: "${ARGON2_MAX_QUEUE-8}"\n' +
        '      SESSION_IDLE_TIMEOUT_MINUTES: "${SESSION_IDLE_TIMEOUT_MINUTES-30}"\n' +
        '      SESSION_MAX_LIFETIME_HOURS: "${SESSION_MAX_LIFETIME_HOURS-12}"\n' +
        '      AUTH_PASSWORD_MIN_LENGTH: "${AUTH_PASSWORD_MIN_LENGTH-10}"\n' +
        '      AUTH_PASSWORD_MAX_LENGTH: "${AUTH_PASSWORD_MAX_LENGTH-64}"\n' +
        '      ACTIVATION_TOKEN_EXPIRY_HOURS: "${ACTIVATION_TOKEN_EXPIRY_HOURS-24}"\n' +
        '      ACTIVATION_PAGE_URL: "${ACTIVATION_PAGE_URL-}"\n' +
        '      ACTIVATION_IP_REQUEST_LIMIT: "${ACTIVATION_IP_REQUEST_LIMIT-10}"\n' +
        '      ACTIVATION_ABUSE_WINDOW_MINUTES: "${ACTIVATION_ABUSE_WINDOW_MINUTES-15}"\n' +
        '      ACTIVATION_VALIDATION_IP_REQUEST_LIMIT: "${ACTIVATION_VALIDATION_IP_REQUEST_LIMIT-20}"\n' +
        '      ACTIVATION_VALIDATION_ABUSE_WINDOW_MINUTES: "${ACTIVATION_VALIDATION_ABUSE_WINDOW_MINUTES-15}"\n' +
        '      LOGIN_IDENTIFIER_FAILURE_LIMIT: "${LOGIN_IDENTIFIER_FAILURE_LIMIT-5}"\n' +
        '      LOGIN_IP_REQUEST_LIMIT: "${LOGIN_IP_REQUEST_LIMIT-10}"\n' +
        '      LOGIN_ABUSE_WINDOW_MINUTES: "${LOGIN_ABUSE_WINDOW_MINUTES-15}"\n' +
        '      LOGIN_ABUSE_HMAC_KEY: "${LOGIN_ABUSE_HMAC_KEY-}"\n' +
        '      AUTH_TRUSTED_PROXIES: "${AUTH_TRUSTED_PROXIES-}"\n' +
        '      AUTH_PUBLIC_ORIGIN: "${AUTH_PUBLIC_ORIGIN-}"',
    );
    await fs.writeFile(composePath, updated, "utf8");
    if (options.modality === "fullstack")
      await appendEnvBlock(
        envPath,
        AUTH_ENV_EXAMPLE + "AUTH_PUBLIC_ORIGIN=https://localhost:8443\n",
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

async function applyAuthUiOverlay(
  frontend: string,
  language: Language,
  mode: NonNullable<UserOptions["authAppMode"]>,
  i18n: boolean | undefined,
): Promise<void> {
  const overlay = path.join(templatesDir(), "auth-ui");
  await copyDir(path.join(overlay, language), frontend, path.basename(frontend));
  await copyDir(path.join(overlay, "shared"), frontend, path.basename(frontend));

  const manifest = path.join(frontend, "package.json");
  const base = JSON.parse(await fs.readFile(manifest, "utf-8")) as PackageJson;
  const deps = JSON.parse(
    await fs.readFile(path.join(overlay, "package.json"), "utf-8"),
  ) as PackageJsonOverlay;
  await fs.writeFile(
    manifest,
    JSON.stringify(mergePackageJson(base, deps, "auth-ui"), null, 2) + "\n",
  );

  const ext = language === "ts" ? "tsx" : "jsx";
  const authDir = path.join(frontend, "src", "features", "auth");
  const routes = path.join(authDir, `AuthApp.${ext}`);
  const source = await fs.readFile(routes, "utf-8");
  const insertions: InsertionMap =
    mode === "public"
      ? {
          imports: [
            { contributor: "auth-ui", lines: [`import { Welcome } from '../../App.${ext}'`] },
          ],
          landing: [{ contributor: "auth-ui", lines: ["Welcome,"] }],
        }
      : {};
  await fs.writeFile(routes, resolveInsertionPoints(source, insertions));
  if (mode === "private") await fs.unlink(path.join(frontend, "src", `App.${ext}`));

  const test = path.join(authDir, `AuthApp.test.${ext}`);
  const testImports = i18n
    ? { imports: [{ contributor: "i18n", lines: [`import '../../i18n.${language}'`] }] }
    : {};
  await fs.writeFile(test, resolveInsertionPoints(await fs.readFile(test, "utf-8"), testImports));

  if (i18n) {
    for (const [locale, messages] of [
      ["en", path.join(authDir, "messages.json")],
      ["es", path.join(overlay, "es.json")],
    ] as const) {
      const catalog = path.join(frontend, "src", "locales", `${locale}.json`);
      const contents = JSON.parse(await fs.readFile(catalog, "utf-8")) as Record<string, unknown>;
      contents.auth = JSON.parse(await fs.readFile(messages, "utf-8")) as unknown;
      await fs.writeFile(catalog, JSON.stringify(contents, null, 2) + "\n");
    }
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
  const passwordRejected = {
    description:
      "Solicitud inválida. Una contraseña rechazada por la política devuelve el código PASSWORD_POLICY.",
    content: {
      "application/json": {
        schema: {
          type: "object",
          required: ["error"],
          properties: {
            error: { type: "string", enum: ["Bad Request"] },
            code: { type: "string", enum: ["PASSWORD_POLICY"] },
          },
        },
      },
    },
  };
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
          400: passwordRejected,
          204: noContent,
          503: { description: "Verificación saturada", ...retry },
        },
      },
    },
    "/auth/register": {
      post: {
        summary: "Registrar una identidad como administrador global",
        ...secured,
        ...csrf,
        requestBody: requestBody({ email: { type: "string", format: "email" } }),
        responses: {
          ...rejected,
          200: { description: "Identidad existente, sin enlace nuevo" },
          201: { description: "Identidad pendiente y enlace privado de activación" },
        },
      },
    },
    "/auth/activation/revoke": {
      post: {
        summary: "Revocar el enlace pendiente como administrador global",
        ...secured,
        ...csrf,
        requestBody: requestBody({ userId: { type: "string", format: "uuid" } }),
        responses: { ...rejected, 204: noContent },
      },
    },
    "/auth/activation/regenerate": {
      post: {
        summary: "Regenerar el enlace como administrador global",
        ...secured,
        ...csrf,
        requestBody: requestBody({ userId: { type: "string", format: "uuid" } }),
        responses: {
          ...rejected,
          200: { description: "Enlace privado nuevo" },
          409: { description: "La cuenta no está pendiente" },
        },
      },
    },
    "/auth/activate": {
      post: {
        summary: "Establecer la contraseña inicial sin iniciar sesión",
        ...csrf,
        requestBody: requestBody({
          token: { type: "string", minLength: 43, maxLength: 43 },
          password: credential,
        }),
        responses: {
          ...rejected,
          400: passwordRejected,
          204: noContent,
          429: { description: "Límite de activación alcanzado", ...retry },
          503: { description: "Hash saturado", ...retry },
        },
      },
    },
    "/auth/activate/validate": {
      post: {
        summary: "Comprobar la vigencia del enlace de activación sin consumirlo",
        ...csrf,
        requestBody: requestBody({ token: { type: "string", minLength: 43, maxLength: 43 } }),
        responses: {
          200: {
            description: "Token válido en el momento de la comprobación y política efectiva",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  additionalProperties: false,
                  required: ["passwordPolicy"],
                  properties: {
                    passwordPolicy: {
                      type: "object",
                      additionalProperties: false,
                      required: ["minLength", "maxLength", "maxBytes"],
                      properties: {
                        minLength: { type: "integer", minimum: 8, maximum: 128 },
                        maxLength: { type: "integer", minimum: 8, maximum: 128 },
                        maxBytes: { type: "integer", enum: [512] },
                      },
                    },
                  },
                },
              },
            },
          },
          400: { description: "Enlace no válido" },
          403: rejected[403],
          429: { description: "Límite de comprobaciones alcanzado", ...retry },
          500: rejected[500],
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
    await fs.copyFile(
      path.join(persistence, "ops", "auth.md"),
      path.join(backendDir, "ops", "auth.md"),
    );
    await fs.appendFile(
      path.join(backendDir, "ops", "README.md"),
      "\n[Controles adicionales de Auth](auth.md).\n",
    );
  }
  await copyAuthMigrations(path.join(persistence, "drizzle"), path.join(backendDir, "drizzle"));
  await copyDir(path.join(persistence, language), backendDir, path.basename(backendDir));
  await copyDir(overlay, backendDir, path.basename(backendDir));
  const policyPath = path.join(backendDir, "src/auth", `password-policy.${language}`);
  const policy = await fs.readFile(policyPath, "utf8");
  await fs.writeFile(
    policyPath,
    policy.replace(/["']brixa-tpl["']/, () => JSON.stringify(path.basename(options.outputDir))),
    "utf8",
  );
  if (options.apiDocs) await documentAuthRoutes(backendDir, options);
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
async function applySetup(options: UserOptions): Promise<void> {
  const { outputDir, modality, database = "none", auth = false, apiDocs = false } = options;
  const docker = modality !== "frontend" && (options.docker ?? false);
  const fullstack = modality === "fullstack";
  const environment =
    modality === "frontend" || (fullstack && docker && database !== "postgres" && !auth && !apiDocs)
      ? null
      : fullstack && !docker
        ? "backend"
        : ".";
  const manifestPath = path.join(outputDir, "package.json");
  const manifest: PackageJson = fullstack
    ? { private: true, engines: { node: "^24.0.0 || >=26.0.0" } }
    : (JSON.parse(await fs.readFile(manifestPath, "utf8")) as PackageJson);
  manifest.scripts = { ...manifest.scripts, setup: "node scripts/setup.mjs" };
  await fs.writeFile(manifestPath, JSON.stringify(manifest, null, 2) + "\n");

  const scripts = path.join(outputDir, "scripts");
  await fs.mkdir(scripts, { recursive: true });
  await fs.copyFile(
    path.join(templatesDir(), "setup", "setup.mjs"),
    path.join(scripts, "setup.mjs"),
  );
  if (docker)
    await fs.copyFile(
      path.join(templatesDir(), "setup", "setup-docker.mjs"),
      path.join(scripts, "setup-docker.mjs"),
    );
  await fs.writeFile(
    path.join(scripts, "setup.config.json"),
    JSON.stringify(
      {
        modality,
        environment,
        docker,
        database,
        language: docker || database === "postgres" ? options.language : undefined,
        auth,
        cookie: auth && (options.authTransport ?? DEFAULT_AUTH_TRANSPORT) === "cookie",
      },
      null,
      2,
    ) + "\n",
  );
  const lockDir = path.join(outputDir, environment ?? ".");
  await fs.appendFile(path.join(lockDir, ".gitignore"), "\n.brixa-setup/\n");
  if (docker && !fullstack) {
    await fs.appendFile(path.join(lockDir, ".dockerignore"), "\n.brixa-setup/\n");
  }
}

export async function generate(input: UserOptions): Promise<GenerateResult> {
  const authOptions = validateAuthOptions(input);
  if (!authOptions.ok) return authOptions;

  const options = { ...input, authAppMode: authOptions.value };
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

      if (database === "postgres") {
        await applyPostgresOverlay(backendDest, language);
      } else if (database === "sqlite") {
        await applySqliteOverlay(backendDest, language);
      }

      if (options.apiDocs) {
        await applyApiDocsOverlay(backendDest, language);
      }

      if (options.docker) {
        await applyFullstackDockerOverlay(
          outputDir,
          frontendDest,
          backendDest,
          language,
          database,
          options.auth,
        );
        await composeDockerEnv(outputDir, options);
      }

      if (options.i18n) {
        await applyI18nOverlay(frontendDest, language);
      }

      if (options.auth)
        await applyAuthOverlay(
          backendDest,
          language,
          database,
          options,
          options.docker ? outputDir : undefined,
        );
      if (options.authAppMode) {
        await applyAuthUiOverlay(frontendDest, language, options.authAppMode, options.i18n);
      }
      await composeFrontendInsertionPoints(frontendDest, language, options);
      await composeBackendInsertionPoints(backendDest, options);
      await applySetup(options);
      await writeProjectDocs(options);

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
      }
      await composeFrontendInsertionPoints(outputDir, language, options);
    }

    if (modality === "backend") {
      if (database === "postgres") {
        await applyPostgresOverlay(outputDir, language, options.docker);
      } else if (database === "sqlite") {
        await applySqliteOverlay(outputDir, language);
      }
      if (options.apiDocs) {
        await applyApiDocsOverlay(outputDir, language);
      }
      if (options.docker) {
        await applyDockerOverlay(outputDir, language, database);
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
    await applySetup(options);
    await writeProjectDocs(options);

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
    if (options.database === "postgres" && basename === "index") {
      add(
        "startup",
        "database-postgres",
        options.auth
          ? [
              'const { checkAuthPrivileges } = await import("./db/check-auth-privileges.js");',
              "await checkAuthPrivileges();",
            ]
          : [
              'const { checkRuntimeIdentity } = await import("./db/client.js");',
              "await checkRuntimeIdentity();",
            ],
      );
    }
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
        `await initializeAuthHttp(${JSON.stringify(options.authTransport ?? DEFAULT_AUTH_TRANSPORT)}, ${JSON.stringify(name)}, db, writer);`,
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

async function composeFrontendInsertionPoints(
  frontendDir: string,
  language: Language,
  { i18n, authAppMode }: Pick<UserOptions, "i18n" | "authAppMode">,
): Promise<void> {
  const mainExt = language === "ts" ? "tsx" : "jsx";
  const main = path.join(frontendDir, "src", `main.${mainExt}`);
  const entry = authAppMode ? "./features/auth/AuthApp" : "./App";
  const imports = i18n ? [`import './i18n.${language}'`] : [];
  imports.push(`import App from '${entry}.${mainExt}'`);
  await fs.writeFile(
    main,
    resolveInsertionPoints(await fs.readFile(main, "utf-8"), {
      imports: [{ contributor: "frontend", lines: imports }],
    }),
  );

  const vite = path.join(frontendDir, `vite.config.${language}`);
  const config = await fs.readFile(vite, "utf-8");
  const cleaned = cleanupInsertionPoints(config, KNOWN_FRONTEND_INSERTION_POINTS);
  if (cleaned !== config) {
    await fs.writeFile(vite, cleaned);
  }
}

// ---------------------------------------------------------------------------
// Mensajes de usuario
// ---------------------------------------------------------------------------

export function formatGenerateError(error: GenerateError): string {
  switch (error.kind) {
    case "auth_requires_backend_database":
    case "invalid_auth_transport":
    case "invalid_auth_app_mode":
      return formatAuthOptionsError(error);
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
  auth?: boolean,
  authTransport?: UserOptions["authTransport"],
  authAppMode?: UserOptions["authAppMode"],
): string {
  const name = path.basename(outputDir);

  const variant =
    modality && language
      ? {
          modality,
          language,
          database,
          docker,
          apiDocs,
          i18n,
          auth,
          authTransport,
          authAppMode:
            auth && modality === "fullstack" ? (authAppMode ?? DEFAULT_AUTH_APP_MODE) : undefined,
        }
      : undefined;
  const experimentalWarning =
    variant && !isVerified(variant)
      ? "\n  Combinación experimental (" +
        variantLabel(variant) +
        "). Si algo falla, abre un issue: https://github.com/acjoell/brixa/issues"
      : "";

  if (auth) {
    return [
      "",
      `✔ Proyecto creado en: ${outputDir}`,
      `  cd ${name}`,
      "  Sigue el README.md generado para configurar Auth, aplicar las migraciones y crear el administrador inicial.",
      experimentalWarning,
      "",
    ].join("\n");
  }

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
        "  # 1. Consulta backend/ops/README.md; configura DATABASE_URL de app_exec",
        "  # 2. Define tus tablas en backend/src/db/schema",
        "  # 3. Genera y aplica migraciones con MIGRATION_DATABASE_URL según docs/deployment.md.",
      );
      if (docker) {
        const migrateCmd = dockerMigrationCommand(language ?? "js", true);
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
      "  # 3. Genera y aplica migraciones con MIGRATION_DATABASE_URL según docs/deployment.md.",
    );
    if (docker) {
      const migrateCmd = dockerMigrationCommand(language ?? "js", true);
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
