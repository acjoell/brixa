import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { randomBytes } from "node:crypto";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { generate } from "../src/generator/generate.ts";
import { executeCommand } from "./mutation-engine.js";
import {
  getVariantLabel,
  startBackendServer,
  startPostgresContainer,
  startViteServer,
  stopProcess,
} from "./verify-generated.js";
import { runReportedVerification } from "./verification-report.js";

export const AUTH_VARIANTS = [
  { modality: "backend", language: "js", database: "postgres", authTransport: "bearer" },
  { modality: "backend", language: "ts", database: "sqlite", authTransport: "bearer" },
  { modality: "fullstack", language: "ts", database: "sqlite", authTransport: "cookie" },
  { modality: "fullstack", language: "js", database: "postgres", authTransport: "cookie" },
].map((variant) => ({ ...variant, auth: true, apiDocs: true }));

export async function runStep(
  label,
  cmd,
  args,
  cwd,
  { env, timeoutMs, signal, sensitive = false },
) {
  const result = await executeCommand(cmd, args, cwd, {
    env,
    timeoutMs,
    signal,
    ...(cmd === process.execPath ? { shell: false } : {}),
  });
  signal?.throwIfAborted();
  console.log(`${label}: ${(result.durationMs / 1000).toFixed(2)} s`);
  if (result.exitCode === 0 && !result.timedOut && !result.spawnError) return;
  const status = result.timedOut
    ? "timeout"
    : (result.spawnError?.code ?? result.signal ?? result.exitCode);
  // Los fallos del driver o de una aserción pueden contener credenciales de la fixture.
  if (!sensitive) console.error(result.stderr.slice(-4000));
  throw new Error(`${label}: ${status}`);
}

async function provisionPostgres(connection, backendDir) {
  const { containerName, database, user, port } = connection;
  const ownerPassword = randomBytes(24).toString("hex");
  const runtimePassword = randomBytes(24).toString("hex");
  const provision = await readFile(path.join(backendDir, "ops", "provision.sql"), "utf8");
  const commands = [
    "SHOW server_version_num;",
    provision,
    `ALTER ROLE table_owner PASSWORD '${ownerPassword}';`,
    `ALTER ROLE app_exec PASSWORD '${runtimePassword}';`,
  ].join("\n");
  try {
    const result = execFileSync(
      "docker",
      [
        "exec",
        "-i",
        containerName,
        "psql",
        "-XAt",
        "-v",
        "ON_ERROR_STOP=1",
        "-U",
        user,
        "-d",
        database,
        "-v",
        "target=" + database,
      ],
      { input: commands, encoding: "utf8", timeout: 15_000, stdio: ["pipe", "pipe", "pipe"] },
    );
    assert.equal(result.split("\n")[0], "170004");
  } catch {
    throw new Error("Falló el aprovisionamiento aislado de PostgreSQL 17.4.");
  }
  const location = `@127.0.0.1:${port}/${database}`;
  return {
    DATABASE_URL: "postgresql://app_exec:" + runtimePassword + location,
    MIGRATION_DATABASE_URL: "postgresql://table_owner:" + ownerPassword + location,
  };
}

async function checkStartup(variant, backendDir, frontendDir, env) {
  const entry = variant.language === "ts" ? "dist/index.js" : "src/index.js";
  const backend = await startBackendServer(backendDir, entry, env);
  let vite;
  try {
    if (frontendDir) vite = await startViteServer(frontendDir, backend.port, backend);
    const origin = `http://127.0.0.1:${vite?.port ?? backend.port}`;
    const base = vite ? origin + "/api" : origin;
    const request = (url, { method = "GET", body } = {}) =>
      fetch(url, {
        method,
        body,
        headers: {
          "X-Forwarded-Proto": "https",
          ...(body ? { "Content-Type": "application/json" } : {}),
        },
        redirect: "manual",
        signal: globalThis.AbortSignal.timeout(5000),
      });
    if (vite) {
      const index = await request(origin + "/");
      assert.equal(index.status, 200);
      assert.match(await index.text(), /<div id="root">/);
    }
    const health = await request(base + "/health");
    assert.equal(health.status, 200);
    assert.equal((await health.json()).status, "ok");
    for (const route of ["/auth/session", "/docs/swagger-ui-init.js"]) {
      const response = await request(base + route);
      assert.equal(response.status, 401, route);
      await response.body?.cancel();
    }
    // Sin prueba CSRF, cookies bloquea antes de validar el cuerpo y Bearer lo valida.
    const login = await request(base + "/auth/login", { method: "POST", body: "{}" });
    assert.equal(
      login.status,
      variant.authTransport === "cookie" ? 403 : 400,
      "Transporte de login",
    );
    await login.body?.cancel();
  } finally {
    try {
      if (vite) await stopProcess(vite.child);
    } finally {
      await stopProcess(backend.child);
    }
  }
}

// Reutiliza el mismo contrato que las comprobaciones aisladas de ⑤-G.
const lifecycle = `
const { AUTH_TEST_LANGUAGE: ext, AUTH_TEST_ENGINE: engine, AUTH_TEST_TRANSPORT: mode } = process.env;
const { checkAuthLifecycle } = await import("./tests/auth-lifecycle-contract." + ext);
const runtime = await import("./src/db/client." + ext);
const connection = runtime.pool ?? runtime.client;
try {
  if (engine === "postgres") {
    await runtime.checkRuntimeIdentity();
    const { withPostgresAdministrator } = await import("./src/db/bootstrap." + ext);
    await checkAuthLifecycle(mode, runtime.db, runtime.db, (operation) =>
      withPostgresAdministrator(operation, {
        MIGRATION_DATABASE_URL: process.env.AUTH_TEST_OWNER_URL,
      }),
    );
  } else {
    const { sqliteActivationDatabase } = await import("./src/db/activation-write." + ext);
    const { withSqliteAdministrator } = await import("./src/db/local-admin." + ext);
    const writer = sqliteActivationDatabase({ url: process.env.DATABASE_URL });
    await checkAuthLifecycle(mode, runtime.db, writer, withSqliteAdministrator);
  }
} finally {
  if (engine === "postgres") await connection.end();
  else connection.close();
}
`;

export async function verifyVariant(
  variant,
  signal,
  { checkInstall, checkBackend, installOnly } = {},
) {
  signal?.throwIfAborted();
  const label = getVariantLabel(variant) + "+" + variant.authTransport;
  const workspace = await mkdtemp(path.join(tmpdir(), "brixa-verify-auth-"));
  let postgres;
  try {
    console.log(`\n=== ${label} ===`);
    const projectDir = path.join(workspace, "auth-fixture");
    const result = await generate({ ...variant, outputDir: projectDir });
    if (!result.ok) throw new Error("Falló la generación Auth: " + JSON.stringify(result.error));
    const fullstack = variant.modality === "fullstack";
    const backendDir = fullstack ? path.join(projectDir, "backend") : projectDir;
    const frontendDir = fullstack ? path.join(projectDir, "frontend") : null;
    for (const directory of [backendDir, frontendDir].filter(Boolean)) {
      await runStep("Instalación", "npm", ["install", "--no-audit", "--no-fund"], directory, {
        timeoutMs: 300_000,
        signal,
      });
      await checkInstall?.(directory, { variant, backend: directory === backendDir, signal });
      if (installOnly) continue;
      if (directory === frontendDir || variant.language === "ts") {
        await runStep("Compilación", "npm", ["run", "build"], directory, {
          timeoutMs: 120_000,
          signal,
        });
      }
    }
    if (installOnly) return;

    // Las credenciales y ajustes del anfitrión no pertenecen a la fixture.
    const overrides = Object.fromEntries(
      Object.keys(process.env)
        .filter((key) =>
          /^(?:PG|AUTH_|ARGON2_|SESSION_|ACTIVATION_|LOGIN_|DATABASE_|MIGRATION_|POSTGRES_|CORS_)/i.test(
            key,
          ),
        )
        .map((key) => [key, undefined]),
    );
    const usingPostgres = variant.database === "postgres";
    let connection = { DATABASE_URL: "file:" + path.join(workspace, "auth.db") };
    if (usingPostgres) {
      postgres = await startPostgresContainer({ auth: true });
      signal?.throwIfAborted();
      connection = await provisionPostgres(postgres, backendDir);
    }
    const { MIGRATION_DATABASE_URL, DATABASE_URL } = connection;
    const env = {
      ...overrides,
      DATABASE_URL,
      ENABLE_API_DOCS: "true",
      AUTH_PUBLIC_ORIGIN: "https://app.example.test",
      ACTIVATION_PAGE_URL: "https://app.example.test/activar",
      AUTH_TRUSTED_PROXIES: "127.0.0.1",
      LOGIN_ABUSE_HMAC_KEY: randomBytes(32).toString("hex"),
      ARGON2_MAX_CONCURRENT: "2",
      ARGON2_MAX_QUEUE: "8",
    };
    await runStep("Migración", "npm", ["run", "db:migrate"], backendDir, {
      env: { ...env, MIGRATION_DATABASE_URL },
      timeoutMs: 60_000,
      signal,
      sensitive: true,
    });
    await checkStartup(variant, backendDir, frontendDir, env);
    signal?.throwIfAborted();
    await runStep(
      "Ciclo Auth",
      process.execPath,
      [
        ...(variant.language === "ts" ? ["--import", "tsx"] : []),
        "--input-type=module",
        "-e",
        lifecycle,
      ],
      backendDir,
      {
        env: {
          ...env,
          AUTH_TEST_LANGUAGE: variant.language,
          AUTH_TEST_ENGINE: variant.database,
          AUTH_TEST_TRANSPORT: variant.authTransport,
          AUTH_TEST_OWNER_URL: MIGRATION_DATABASE_URL,
        },
        timeoutMs: 60_000,
        signal,
        sensitive: true,
      },
    );
    await checkBackend?.(backendDir, env);
  } finally {
    try {
      await postgres?.stop();
    } finally {
      await rm(workspace, { recursive: true, force: true, maxRetries: 5, retryDelay: 300 });
    }
  }
}

export async function runAuthVerification(signal) {
  return runReportedVerification(
    AUTH_VARIANTS,
    AUTH_VARIANTS,
    (variant) => verifyVariant(variant, signal),
    "auth",
    (outcomes) =>
      console.table(
        AUTH_VARIANTS.map((variant) => ({
          variant: getVariantLabel(variant),
          transport: variant.authTransport,
          status: outcomes.find((outcome) => outcome.variant === variant)?.status ?? "NOT_RUN",
        })),
      ),
  );
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  const controller = new globalThis.AbortController();
  const interrupt = () => controller.abort(new Error("Verificación interrumpida."));
  process.once("SIGINT", interrupt);
  process.once("SIGTERM", interrupt);
  runAuthVerification(controller.signal)
    .catch((error) => {
      console.error("verify:auth falló:", error.message);
      process.exitCode = 1;
    })
    .finally(() => {
      process.off("SIGINT", interrupt);
      process.off("SIGTERM", interrupt);
    });
}
