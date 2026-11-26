#!/usr/bin/env node
/**
 * Brixa — verify:generated
 *
 * Verifica de forma reproducible que los proyectos generados se instalan,
 * compilan y pasan el lint correctamente, incluyendo las variantes con persistencia PostgreSQL.
 *
 * Pasos:
 *   1. npm run build (Brixa CLI)
 *   2. Para cada variante soportada:
 *      a. Genera el proyecto en un directorio temporal
 *      b. npm install, npm run build, npm run lint, tests
 *      c. Para variantes con PostgreSQL: genera esquema mínimo, db:generate, db:migrate, verifica tabla y tests
 *      d. Para variantes sin base de datos: comprueba que no existen artefactos de base de datos
 *      e. Limpia el directorio temporal (incluso si hay error)
 *
 * No se ejecuta dentro de npm test porque es lento y usa red.
 * process.exit solo se llama aquí (fuera de src/).
 * --functional-only verifica funcionamiento sin evaluar seguridad.
 * --audit-only instala y audita sin ejecutar comprobaciones funcionales.
 * Sin estos flags conserva la verificación integral estricta.
 */
import { execFileSync, spawn } from "node:child_process";
import { randomBytes } from "node:crypto";
import { provisionPostgres } from "./fixtures/postgres.js";
import fs from "node:fs";
import net from "node:net";
import os from "node:os";
import path from "node:path";
import { createInterface } from "node:readline";
import { fileURLToPath, pathToFileURL, URL } from "node:url";
import { performance } from "node:perf_hooks";
import { verifyI18n } from "./verify-i18n.js";
import { runReportedVerification } from "./verification-report.js";

const suiteStartTime = performance.now();
let verificationMode = "all";

export function getVerificationMode(args) {
  const modes = args.filter((arg) => arg === "--functional-only" || arg === "--audit-only");
  if (modes.length > 1) throw new Error("Selecciona un único modo de verificación.");
  return modes[0] === "--functional-only"
    ? "functional"
    : modes[0] === "--audit-only"
      ? "audit"
      : "all";
}

function formatDuration(ms) {
  if (ms < 1000) return `${Math.round(ms)}ms`;
  return `${(ms / 1000).toFixed(2)}s`;
}

function getElapsedSuite() {
  return formatDuration(performance.now() - suiteStartTime);
}

const timeoutSignal = (ms) => globalThis.AbortSignal.timeout(ms);

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, "..");

// ---------------------------------------------------------------------------
// Utilidades
// ---------------------------------------------------------------------------

/** Timeout por defecto según el comando y sus argumentos para evitar bloqueos indefinidos. */
function getDefaultTimeout(cmd, args) {
  if (cmd === "docker") {
    return 300_000; // 5 minutos para operaciones de docker (build/run/migrate)
  }
  if (cmd === "npm") {
    const sub = args[0];
    if (sub === "install" || sub === "ci") {
      return 300_000; // 5 minutos para instalaciones en Windows CI (NTFS + Defender)
    }
    if (sub === "audit") {
      return 60_000; // 1 minuto para auditoría (llamada remota a registro)
    }
    if (sub === "run") {
      const script = args[1];
      if (script === "build") return 120_000; // 2 minutos para compilación
      if (["lint", "typecheck", "format:check", "test", "check:i18n"].includes(script)) {
        return 60_000; // 1 minuto para comprobaciones estáticas o tests unitarios
      }
      if (script?.startsWith("db:")) return 60_000; // 1 minuto para migraciones
    }
  }
  return 120_000; // 2 minutos por defecto
}

function verificationEnv(extra = {}) {
  const reserved = [
    "DATABASE_URL",
    "MIGRATION_DATABASE_URL",
    "POSTGRES_PASSWORD",
    "PGPASSWORD",
    "PGPASSFILE",
    "VERIFY_DATABASE_URL",
    "VERIFY_MIGRATION_DATABASE_URL",
  ];
  const inherited = Object.fromEntries(
    Object.entries(process.env).filter(([key]) => !reserved.includes(key)),
  );
  return { ...inherited, ...extra };
}

/** Ejecuta un comando sincrónico e imprime la salida heredada con medición de tiempo y timeout. */
function run(cmd, args, cwd, extraEnv = {}, customTimeoutMs = null) {
  const timeoutMs = customTimeoutMs ?? getDefaultTimeout(cmd, args);
  const startTime = performance.now();
  const label = `${cmd} ${args.join(" ")}`;
  console.log(`\n$ ${label}  (cwd: ${cwd}) [T+${getElapsedSuite()}]`);

  // Excluir NODE_ENV del entorno heredado para que los builds de Vite usen "production".
  // Vite establece NODE_ENV="development" cuando lanza createServer, y si ese valor
  // se propaga a builds hijos, React se incluye en modo desarrollo (~70 kB extra).
  const env = verificationEnv(extraEnv);
  delete env.NODE_ENV;
  const isWindows = process.platform === "win32";
  const actualCmd = isWindows && cmd === "npm" ? "npm.cmd" : cmd;

  try {
    execFileSync(actualCmd, args, {
      cwd,
      stdio: "inherit",
      env,
      shell: isWindows,
      timeout: timeoutMs,
    });
    const duration = performance.now() - startTime;
    console.log(`✔ ${label} (${formatDuration(duration)})`);
  } catch (err) {
    const duration = performance.now() - startTime;
    const isTimeout = err.code === "ETIMEDOUT" || err.signal === "SIGTERM" || duration >= timeoutMs;
    console.error(
      `✖ Falló "${label}" tras ${formatDuration(duration)}${isTimeout ? ` (TIMEOUT alcanzado: ${formatDuration(timeoutMs)})` : ""} (T+${getElapsedSuite()})`,
    );
    throw err;
  }
}

export function prepareDependencies(projectDir, mode = "all") {
  run("npm", ["install", "--no-audit"], projectDir);
  if (mode === "functional") {
    console.log(
      "FUNCIONAL: auditoría no evaluada; requiere verify:generated:audit para seguridad.",
    );
  } else {
    run("npm", ["audit", "--audit-level=moderate"], projectDir);
  }
}

const stoppingProcesses = new WeakMap();

/** Espera la salida del proceso, incluso si otra llamada ya solicitó detenerlo. */
export function stopProcess(child) {
  if (!child?.pid || child.exitCode !== null || child.signalCode !== null) return Promise.resolve();
  if (stoppingProcesses.has(child)) return stoppingProcesses.get(child);

  const stopped = new Promise((resolve, reject) => {
    let timer;
    const onExit = () => {
      clearTimeout(timer);
      resolve();
    };
    child.once("exit", onExit);
    try {
      if (process.platform === "win32") {
        execFileSync("taskkill", ["/pid", String(child.pid), "/T", "/F"], {
          stdio: "ignore",
          timeout: 4000,
        });
      } else {
        child.kill("SIGTERM");
      }
    } catch {
      // El proceso puede haber terminado antes de recibir la señal.
    }
    timer = setTimeout(() => {
      try {
        if (process.platform !== "win32") child.kill("SIGKILL");
      } catch {
        // Conserva la espera de salida aunque falle el envío de la señal.
      }
      timer = setTimeout(() => {
        child.removeListener("exit", onExit);
        reject(new Error("No se confirmó la terminación del proceso."));
      }, 4000);
    }, 4000);
  });
  stoppingProcesses.set(child, stopped);
  return stopped;
}

/** Obtiene un puerto TCP libre asignado por el sistema operativo. */
async function getFreePort() {
  return new Promise((resolve, reject) => {
    const srv = net.createServer();
    srv.listen(0, "127.0.0.1", () => {
      const addr = srv.address();
      const port = typeof addr === "object" && addr ? addr.port : 0;
      srv.close((err) => {
        if (err) reject(err);
        else resolve(port);
      });
    });
  });
}

/** Arranca el servidor backend en puerto efímero (PORT=0) y devuelve el proceso y el puerto asignado. */
export async function startBackendServer(
  projectDir,
  entryPoint = path.join("dist", "index.js"),
  extraEnv = {},
  { sanitizeOutput } = {},
) {
  const normEntryPoint = path.normalize(entryPoint);
  console.log(`\nIniciando servidor backend (${normEntryPoint})...`);
  const serverEnv = verificationEnv({ PORT: "0", ...extraEnv });
  delete serverEnv.NODE_ENV;
  const child = spawn("node", [normEntryPoint], {
    cwd: projectDir,
    env: serverEnv,
    stdio: ["ignore", "pipe", "pipe"],
  });

  const stdoutLines = [];
  const stderrLines = [];

  const port = await new Promise((resolve, reject) => {
    let stdout = "";
    const timeout = setTimeout(() => {
      const outTail = (sanitizeOutput ? sanitizeOutput(stdout).split("\n") : stdoutLines)
        .slice(-30)
        .join("\n")
        .trim();
      const errTail = stderrLines.slice(-30).join("\n").trim();
      reject(
        new Error(
          `Timeout esperando a que el servidor backend arranque.\n--- Últimas líneas stdout del backend ---\n${outTail || "(vacío)"}\n--- Últimas líneas stderr del backend ---\n${errTail || "(vacío)"}`,
        ),
      );
    }, 10000);

    child.stdout.on("data", (chunk) => {
      const str = chunk.toString();
      if (!sanitizeOutput) stdoutLines.push(...str.split("\n"));
      stdout += str;
      const match = stdout.match(/http:\/\/localhost:(\d+)/);
      if (match) {
        clearTimeout(timeout);
        resolve(Number(match[1]));
      }
    });

    if (sanitizeOutput) {
      createInterface({ input: child.stderr }).on("line", (line) => {
        const safe = sanitizeOutput(line);
        stderrLines.push(safe);
        process.stderr.write(safe + "\n");
      });
    } else {
      child.stderr.on("data", (chunk) => {
        stderrLines.push(...chunk.toString().split("\n"));
        process.stderr.write(chunk);
      });
    }

    child.on("error", (err) => {
      clearTimeout(timeout);
      reject(err);
    });

    child.on("exit", (code) => {
      clearTimeout(timeout);
      reject(new Error(`El servidor backend terminó prematuramente con código ${code}`));
    });
  }).catch(async (error) => {
    await stopProcess(child);
    throw error;
  });

  return { child, port, stdoutLines, stderrLines };
}

/** Arranca el servidor de desarrollo de Vite sin usar npm run, con puerto libre, --strictPort y BACKEND_URL. */
export async function startViteServer(frontendDir, backendPort, backendLogs = null) {
  const vitePort = await getFreePort();
  const viteBin = path.join(frontendDir, "node_modules", "vite", "bin", "vite.js");

  console.log(
    `\nIniciando servidor de desarrollo de Vite en puerto ${vitePort} (BACKEND_URL=http://127.0.0.1:${backendPort})...`,
  );
  const viteEnv = { ...process.env, BACKEND_URL: `http://127.0.0.1:${backendPort}` };
  delete viteEnv.NODE_ENV;
  const child = spawn(
    "node",
    [viteBin, "--host", "127.0.0.1", "--port", String(vitePort), "--strictPort"],
    {
      cwd: frontendDir,
      env: viteEnv,
      stdio: ["ignore", "pipe", "pipe"],
    },
  );

  const stdoutLines = [];
  const stderrLines = [];

  await new Promise((resolve, reject) => {
    let resolved = false;
    const timeout = setTimeout(async () => {
      if (!resolved) {
        resolved = true;
        const outTail = stdoutLines.slice(-30).join("\n").trim();
        const errTail = stderrLines.slice(-30).join("\n").trim();
        const parts = [
          "Timeout esperando a que el servidor de Vite arranque (15s).",
          "--- Últimas líneas stdout de Vite ---",
          outTail || "(vacío)",
          "--- Últimas líneas stderr de Vite ---",
          errTail || "(vacío)",
        ];
        if (backendLogs) {
          const bOut = backendLogs.stdoutLines?.slice(-30).join("\n").trim();
          const bErr = backendLogs.stderrLines?.slice(-30).join("\n").trim();
          parts.push(
            "--- Últimas líneas stdout del backend ---",
            bOut || "(vacío)",
            "--- Últimas líneas stderr del backend ---",
            bErr || "(vacío)",
          );
        }
        await stopProcess(child);
        reject(new Error(parts.join("\n")));
      }
    }, 15000);

    const checkReady = () => {
      if (!resolved) {
        resolved = true;
        clearTimeout(timeout);
        resolve();
      }
    };

    child.stdout.on("data", (chunk) => {
      const text = chunk.toString();
      stdoutLines.push(...text.split("\n"));
      if (text.includes("Local:") || text.includes(`:${vitePort}`)) {
        checkReady();
      }
    });

    child.stderr.on("data", (chunk) => {
      stderrLines.push(...chunk.toString().split("\n"));
      process.stderr.write(chunk);
    });

    child.on("error", (err) => {
      if (!resolved) {
        resolved = true;
        clearTimeout(timeout);
        reject(err);
      }
    });

    child.on("exit", (code) => {
      if (!resolved) {
        resolved = true;
        clearTimeout(timeout);
        reject(new Error(`El servidor de Vite terminó prematuramente con código ${code}`));
      }
    });

    // Sondeo HTTP hasta que responda
    (async () => {
      while (!resolved) {
        await new Promise((r) => setTimeout(r, 200));
        if (resolved) break;
        try {
          const res = await fetch(`http://127.0.0.1:${vitePort}/`, {
            signal: timeoutSignal(1000),
          });
          if (res.ok) {
            checkReady();
            break;
          }
        } catch {
          // Aún no listo o timeout del sondeo puntual
        }
      }
    })();
  });

  return { child, port: vitePort };
}

/** Comprueba que el servidor backend arranca y responde 200 en /health antes de cerrarlo. */
async function checkBackendServer(projectDir, entryPoint, env) {
  let backend;
  const httpStart = performance.now();
  try {
    backend = await startBackendServer(projectDir, entryPoint, env);
    console.log(
      `Servidor backend escuchando en puerto ${backend.port}. Verificando GET /health...`,
    );
    const res = await fetch(`http://localhost:${backend.port}/health`, {
      signal: timeoutSignal(5000),
    });
    if (res.status !== 200) {
      throw new Error(`Esperado status 200 en /health, recibido ${res.status}`);
    }
    const body = await res.json();
    if (body.status !== "ok") {
      throw new Error(
        `Esperado body { status: "ok" } en /health, recibido ${JSON.stringify(body)}`,
      );
    }
    console.log(
      `✔ GET /health respondió 200 con status: ok (${formatDuration(performance.now() - httpStart)})`,
    );
  } catch (err) {
    console.error(
      `✖ Error en verificación HTTP /health tras ${formatDuration(performance.now() - httpStart)}: ${err.message ?? err}`,
    );
    throw err;
  } finally {
    if (backend?.child) {
      console.log("Cerrando servidor backend...");
      await stopProcess(backend.child);
    }
  }
}

/** Extrae y verifica los assets CSS y JS referenciados en el HTML de Swagger UI. */
async function verifySwaggerUiAssets(html, docsUrl) {
  const cssMatches = Array.from(html.matchAll(/<link[^>]+href=["']([^"']+\.css[^"']*)["']/gi)).map(
    (m) => m[1],
  );
  const jsMatches = Array.from(html.matchAll(/<script[^>]+src=["']([^"']+\.js[^"']*)["']/gi)).map(
    (m) => m[1],
  );

  if (cssMatches.length === 0 || jsMatches.length === 0) {
    throw new Error(`No se encontraron suficientes referencias a assets CSS o JS en ${docsUrl}`);
  }

  for (const rel of cssMatches) {
    const assetUrl = new URL(rel, docsUrl).href;
    console.log(`Verificando asset CSS: ${assetUrl}...`);
    const res = await fetch(assetUrl, { signal: timeoutSignal(5000) });
    if (res.status !== 200) {
      throw new Error(`Esperado status 200 para ${assetUrl}, recibido ${res.status}`);
    }
    const ct = res.headers.get("content-type") || "";
    if (!ct.includes("text/css")) {
      throw new Error(`Esperado Content-Type text/css para ${assetUrl}, recibido "${ct}"`);
    }
  }

  for (const rel of jsMatches) {
    const assetUrl = new URL(rel, docsUrl).href;
    console.log(`Verificando asset JS: ${assetUrl}...`);
    const res = await fetch(assetUrl, { signal: timeoutSignal(5000) });
    if (res.status !== 200) {
      throw new Error(`Esperado status 200 para ${assetUrl}, recibido ${res.status}`);
    }
    const ct = res.headers.get("content-type") || "";
    if (!ct.includes("javascript")) {
      throw new Error(`Esperado Content-Type javascript para ${assetUrl}, recibido "${ct}"`);
    }
  }
}

/** Comprueba que la documentación de API responde 404 por defecto y 200/301 con ENABLE_API_DOCS=true. */
async function checkBackendDocs(projectDir, entryPoint, env) {
  const docsStart = performance.now();
  const envExample = path.join(projectDir, ".env.example");
  const envFile = path.join(projectDir, ".env");

  try {
    // 1. Sin ENABLE_API_DOCS: verificamos que /docs y /docs/ devuelven 404
    let backendWithoutDocs;
    try {
      backendWithoutDocs = await startBackendServer(projectDir, entryPoint, env);
      console.log(
        `Verificando GET http://localhost:${backendWithoutDocs.port}/docs (sin ENABLE_API_DOCS)...`,
      );
      const res = await fetch(`http://localhost:${backendWithoutDocs.port}/docs`, {
        redirect: "manual",
        signal: timeoutSignal(5000),
      });
      if (res.status !== 404) {
        throw new Error(`Esperado status 404 en /docs sin ENABLE_API_DOCS, recibido ${res.status}`);
      }
      const resSlash = await fetch(`http://localhost:${backendWithoutDocs.port}/docs/`, {
        redirect: "manual",
        signal: timeoutSignal(5000),
      });
      if (resSlash.status !== 404) {
        throw new Error(
          `Esperado status 404 en /docs/ sin ENABLE_API_DOCS, recibido ${resSlash.status}`,
        );
      }
      console.log("✔ GET /docs y /docs/ respondieron 404 sin ENABLE_API_DOCS");
    } finally {
      if (backendWithoutDocs?.child) await stopProcess(backendWithoutDocs.child);
    }

    // 2. Con ENABLE_API_DOCS=true cargado desde .env (copiado desde .env.example)
    let backendWithDocs;
    try {
      let envContent = fs.existsSync(envExample) ? fs.readFileSync(envExample, "utf-8") : "";
      if (envContent.includes("ENABLE_API_DOCS=")) {
        envContent = envContent.replace(/ENABLE_API_DOCS=.*/, "ENABLE_API_DOCS=true");
      } else {
        envContent += "\nENABLE_API_DOCS=true\n";
      }
      fs.writeFileSync(envFile, envContent, "utf-8");

      backendWithDocs = await startBackendServer(projectDir, entryPoint, env);
      console.log(`Verificando redirección GET http://localhost:${backendWithDocs.port}/docs...`);
      const resRedirect = await fetch(`http://localhost:${backendWithDocs.port}/docs`, {
        redirect: "manual",
        signal: timeoutSignal(5000),
      });
      if (resRedirect.status !== 301) {
        throw new Error(`Esperado status 301 en /docs, recibido ${resRedirect.status}`);
      }
      const location = resRedirect.headers.get("location");
      if (location !== "docs/") {
        throw new Error(`Esperada cabecera Location: 'docs/', recibido '${location}'`);
      }
      console.log("✔ GET /docs respondió 301 con Location: docs/");

      console.log(`Verificando GET http://localhost:${backendWithDocs.port}/docs/...`);
      const resHtml = await fetch(`http://localhost:${backendWithDocs.port}/docs/`, {
        redirect: "manual",
        signal: timeoutSignal(5000),
      });
      if (resHtml.status !== 200) {
        throw new Error(`Esperado status 200 directo en /docs/, recibido ${resHtml.status}`);
      }
      if (resHtml.headers.get("location")) {
        throw new Error(
          `Inesperada redirección en /docs/ con Location: '${resHtml.headers.get("location")}'`,
        );
      }
      const html = await resHtml.text();
      if (!html.includes("swagger-ui")) {
        throw new Error("HTML en /docs/ no contiene 'swagger-ui'");
      }
      console.log("✔ GET /docs/ respondió 200 directo con Swagger UI");

      await verifySwaggerUiAssets(html, `http://localhost:${backendWithDocs.port}/docs/`);
      console.log(
        "✔ Assets CSS y JS de Swagger UI verificados correctamente (status 200 y Content-Type)",
      );
    } finally {
      fs.rmSync(envFile, { force: true });
      if (backendWithDocs?.child) await stopProcess(backendWithDocs.child);
    }
    console.log(
      `✔ Verificación API docs completada (${formatDuration(performance.now() - docsStart)})`,
    );
  } catch (err) {
    console.error(
      `✖ Error en verificación API docs tras ${formatDuration(performance.now() - docsStart)}: ${err.message ?? err}`,
    );
    throw err;
  }
}

// ---------------------------------------------------------------------------
// Gestión de PostgreSQL y Docker desechable
// ---------------------------------------------------------------------------

function isDockerAvailable() {
  try {
    execFileSync("docker", ["--version"], { stdio: "ignore" });
    return true;
  } catch {
    return false;
  }
}

export async function startPostgresContainer({ auth = false } = {}) {
  const port = await getFreePort();
  const containerName = `brixa-pg-verify-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
  const user = "brixa_test";
  const pass = randomBytes(24).toString("hex");
  const db = "brixa_db";

  console.log(`\nIniciando contenedor PostgreSQL desechable en 127.0.0.1:${port}...`);
  const stop = async () => {
    console.log(`\nDeteniendo contenedor PostgreSQL ${containerName}...`);
    try {
      execFileSync("docker", ["stop", containerName], {
        stdio: "ignore",
        timeout: 15_000,
      });
    } catch {
      execFileSync("docker", ["rm", "-f", "-v", containerName], {
        stdio: "ignore",
        timeout: 15_000,
      });
    }
  };
  try {
    execFileSync(
      "docker",
      [
        "run",
        "-d",
        "--name",
        containerName,
        "--rm",
        "-e",
        `POSTGRES_USER=${user}`,
        "-e",
        "POSTGRES_PASSWORD",
        "-e",
        `POSTGRES_DB=${db}`,
        "-p",
        `127.0.0.1:${port}:5432`,
        ...(auth
          ? [
              "--pull=never",
              "--memory=256m",
              "--cpus=1",
              "--tmpfs",
              "/var/lib/postgresql/data:rw,size=128m",
            ]
          : []),
        "postgres:17.4-alpine",
      ],
      {
        stdio: "inherit",
        env: verificationEnv({ POSTGRES_PASSWORD: pass }),
        timeout: 30_000,
      },
    );
  } catch (error) {
    if (error.code === "ETIMEDOUT") await stop();
    throw error;
  }

  const databaseUrl = `postgresql://${user}:${pass}@127.0.0.1:${port}/${db}`;

  const startTime = Date.now();
  let ready = false;
  while (Date.now() - startTime < 30000) {
    try {
      const host = ["-h", "127.0.0.1"];
      execFileSync("docker", ["exec", containerName, "pg_isready", ...host, "-U", user, "-d", db], {
        stdio: "ignore",
        timeout: 3000,
      });
      ready = true;
      break;
    } catch {
      await new Promise((r) => setTimeout(r, 500));
    }
  }

  if (!ready) {
    await stop();
    throw new Error("Timeout esperando a que el contenedor PostgreSQL esté listo");
  }

  console.log("✔ Contenedor PostgreSQL iniciado y listo para pruebas");

  return { databaseUrl, stop, containerName, user, pass, port, database: db };
}

export async function setupPostgres() {
  const {
    VERIFY_DATABASE_URL: DATABASE_URL,
    VERIFY_MIGRATION_DATABASE_URL: MIGRATION_DATABASE_URL,
  } = process.env;
  const stop = async () => {};
  if (DATABASE_URL || MIGRATION_DATABASE_URL) {
    if (!DATABASE_URL || !MIGRATION_DATABASE_URL) {
      throw new Error(
        "Configura juntas VERIFY_DATABASE_URL de app_exec y VERIFY_MIGRATION_DATABASE_URL de table_owner.",
      );
    }
    console.log("\nUsando roles preaprovisionados en la base PostgreSQL de verificación.");
    return {
      available: true,
      stop,
      open: async () => ({ DATABASE_URL, MIGRATION_DATABASE_URL, stop }),
    };
  }
  return {
    available: isDockerAvailable(),
    stop,
    async open(backendDir) {
      const container = await startPostgresContainer();
      try {
        return { ...(await provisionPostgres(container, backendDir)), stop: container.stop };
      } catch (error) {
        await container.stop();
        throw error;
      }
    },
  };
}

// ---------------------------------------------------------------------------
// Comprobación de que no existen artefactos de persistencia
// ---------------------------------------------------------------------------

function verifyNoDatabaseArtifacts(dir) {
  const forbiddenFiles = [
    "drizzle.config.ts",
    "drizzle.config.js",
    path.join("src", "db"),
    path.join("tests", "db.test.ts"),
    path.join("tests", "db.test.js"),
  ];
  for (const rel of forbiddenFiles) {
    const full = path.join(dir, rel);
    if (fs.existsSync(full)) {
      throw new Error(`Artefacto de persistencia inesperado en variante sin base de datos: ${rel}`);
    }
  }

  const pkgFile = path.join(dir, "package.json");
  if (fs.existsSync(pkgFile)) {
    const pkg = JSON.parse(fs.readFileSync(pkgFile, "utf-8"));
    const allDeps = { ...(pkg.dependencies ?? {}), ...(pkg.devDependencies ?? {}) };
    const forbiddenPkgs = ["drizzle-orm", "drizzle-kit", "pg", "@types/pg", "@libsql/client"];
    for (const p of forbiddenPkgs) {
      if (p in allDeps) {
        throw new Error(
          `Dependencia '${p}' inesperada en package.json en variante sin base de datos`,
        );
      }
    }
    const scripts = pkg.scripts ?? {};
    if ("db:generate" in scripts || "db:migrate" in scripts) {
      throw new Error(
        "Scripts de base de datos inesperados en package.json en variante sin base de datos",
      );
    }
  }
}

// ---------------------------------------------------------------------------
// Función pública de generación
// ---------------------------------------------------------------------------

function isDockerComposeV2Available() {
  try {
    const out = execFileSync("docker", ["compose", "version"], { stdio: "pipe" }).toString();
    return out.includes("Docker Compose");
  } catch {
    return false;
  }
}

/**
 * Genera un proyecto en `outputDir` usando el CLI compilado.
 * Requiere que `dist/` ya exista (ejecutar npm run build antes).
 */
export async function generateProject(
  modality,
  language,
  outputDir,
  database = "none",
  docker = false,
  apiDocs = false,
  i18n = false,
) {
  const distGenerate = pathToFileURL(path.join(root, "dist", "generator", "generate.js")).href;
  const { generate } = await import(distGenerate);

  const result = await generate({
    modality,
    language,
    database,
    docker,
    apiDocs,
    i18n,
    outputDir,
  });

  if (!result.ok) {
    throw new Error(`generate() falló: ${JSON.stringify(result.error)}`);
  }
}

function addFixtureGrants(backendDir) {
  const directory = path.join(backendDir, "drizzle");
  const journalPath = path.join(directory, "meta", "_journal.json");
  const journal = JSON.parse(fs.readFileSync(journalPath, "utf8"));
  const migration = journal.entries.at(-1);
  // The external verification database can be reused for this identical fixture.
  migration.when = 1;
  fs.writeFileSync(journalPath, JSON.stringify(journal));
  fs.appendFileSync(
    path.join(directory, migration.tag + ".sql"),
    "\n--> statement-breakpoint\nGRANT SELECT, INSERT ON public.test_items TO app_exec;\n" +
      "--> statement-breakpoint\nGRANT USAGE ON SEQUENCE public.test_items_id_seq TO app_exec;\n",
  );
}

const pendingRuntimeUrl = "DATABASE_URL=postgresql://app_exec:pending@postgres:5432/brixa_db";

async function provisionComposePostgres(projectDir, backendDir) {
  run("docker", ["compose", "up", "-d", "--wait", "postgres"], projectDir);
  const containerName = execFileSync("docker", ["compose", "ps", "-q", "postgres"], {
    cwd: projectDir,
    env: verificationEnv(),
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  }).trim();
  const connection = await provisionPostgres(
    { containerName, database: "brixa_db", user: "brixa_test", port: 5432 },
    backendDir,
    "postgres",
  );
  const envPath = path.join(projectDir, ".env");
  const content = fs.readFileSync(envPath, "utf8");
  fs.writeFileSync(
    envPath,
    content.replace(pendingRuntimeUrl, () => "DATABASE_URL=" + connection.DATABASE_URL),
  );
  return connection;
}

function migrateComposePostgres(projectDir, language, connection) {
  const entry = language === "ts" ? ["node", "dist/db/migrate.js"] : ["npm", "run", "db:migrate"];
  run(
    "docker",
    [
      "compose",
      "run",
      "--rm",
      "--no-deps",
      "-T",
      "-e",
      "MIGRATION_DATABASE_URL",
      "backend",
      ...entry,
    ],
    projectDir,
    { MIGRATION_DATABASE_URL: connection.MIGRATION_DATABASE_URL },
  );
}

const verifyPostgresRuntime = `
import assert from "node:assert/strict";
import pg from "pg";
assert.equal(process.env.POSTGRES_PASSWORD, undefined);
assert.equal(process.env.MIGRATION_DATABASE_URL, undefined);
const client = new pg.Client({ connectionString: process.env.DATABASE_URL });
try {
  await client.connect();
  const { rows: [identity] } = await client.query("SELECT current_user AS role, pg_get_userbyid(relowner) AS owner FROM pg_class WHERE oid = 'public.test_items'::regclass");
  assert.deepEqual(identity, { role: "app_exec", owner: "table_owner" });
  await client.query("BEGIN");
  try {
    const { rows } = await client.query("INSERT INTO public.test_items (title) VALUES ('verification') RETURNING id");
    assert.equal((await client.query("SELECT title FROM public.test_items WHERE id = $1", [rows[0].id])).rows[0].title, "verification");
  } finally {
    await client.query("ROLLBACK");
  }
  for (const sql of ["CREATE TABLE public.__brixa_forbidden (id int)", "TRUNCATE public.test_items",
                     "ALTER TABLE public.test_items ADD COLUMN forbidden int", "SELECT * FROM drizzle.__drizzle_migrations"]) {
    await client.query("BEGIN");
    try {
      await assert.rejects(client.query(sql), { code: "42501" });
    } finally {
      await client.query("ROLLBACK");
    }
  }
} finally {
  await client.end();
}
`;

function checkComposePostgresRuntime(projectDir) {
  execFileSync("docker", ["compose", "exec", "-T", "backend", "node", "--input-type=module"], {
    cwd: projectDir,
    env: verificationEnv(),
    input: verifyPostgresRuntime,
    stdio: ["pipe", "inherit", "inherit"],
    timeout: 30_000,
  });
}

/** Verifica variantes con Docker usando docker compose */
export async function verifyDockerVariant(
  projectDir,
  modality,
  language,
  database,
  variantLabel,
  apiDocs = false,
  backendPrepared = false,
) {
  console.log(`\nIniciando verificación Docker para ${variantLabel}...`);

  if (modality === "fullstack") {
    const backendDir = path.join(projectDir, "backend");
    const frontendDir = path.join(projectDir, "frontend");

    const envLines = [];
    if (database === "postgres") {
      envLines.push(
        "POSTGRES_USER=brixa_test",
        "POSTGRES_PASSWORD=" + randomBytes(24).toString("hex"),
        "POSTGRES_DB=brixa_db",
        pendingRuntimeUrl,
      );
    }
    if (apiDocs) {
      envLines.push("ENABLE_API_DOCS=true");
    }
    if (envLines.length > 0) {
      const envFile = path.join(projectDir, ".env");
      fs.writeFileSync(envFile, envLines.join("\n") + "\n", "utf-8");
    }

    if (!backendPrepared) prepareDependencies(backendDir, verificationMode);
    prepareDependencies(frontendDir, verificationMode);

    if (database === "postgres") {
      const schemaFile = path.join(
        backendDir,
        "src",
        "db",
        language === "ts" ? "schema.ts" : "schema.js",
      );
      const schemaSnippet = `
import { pgTable, serial, text } from "drizzle-orm/pg-core";

export const testItems = pgTable("test_items", {
  id: serial("id").primaryKey(),
  title: text("title").notNull(),
});
`;
      fs.writeFileSync(schemaFile, schemaSnippet, "utf-8");
      run("npm", ["run", "db:generate"], backendDir);
      addFixtureGrants(backendDir);
    } else if (database === "sqlite") {
      const schemaFile = path.join(
        backendDir,
        "src",
        "db",
        language === "ts" ? "schema.ts" : "schema.js",
      );
      const schemaSnippet = `
import { sqliteTable, integer, text } from "drizzle-orm/sqlite-core";

export const testItems = sqliteTable("test_items", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  title: text("title").notNull(),
});
`;
      fs.writeFileSync(schemaFile, schemaSnippet, "utf-8");
      run("npm", ["run", "db:generate"], backendDir);
    }

    try {
      const postgres =
        database === "postgres"
          ? await provisionComposePostgres(projectDir, backendDir)
          : undefined;
      run("docker", ["compose", "build"], projectDir);
      if (postgres) migrateComposePostgres(projectDir, language, postgres);
      run("docker", ["compose", "up", "-d"], projectDir);

      console.log("Esperando a que los servicios estén healthy en Docker...");
      const startTime = Date.now();
      let backendHealthy = false;
      let frontendHealthy = false;
      while (Date.now() - startTime < 60000) {
        try {
          const outBackend = execFileSync(
            "docker",
            ["compose", "ps", "backend", "--format", "json"],
            { cwd: projectDir, stdio: "pipe" },
          ).toString();
          if (outBackend.includes('"healthy"')) {
            backendHealthy = true;
          }
          const outFrontend = execFileSync(
            "docker",
            ["compose", "ps", "frontend", "--format", "json"],
            { cwd: projectDir, stdio: "pipe" },
          ).toString();
          if (outFrontend.includes('"healthy"')) {
            frontendHealthy = true;
          }
          if (backendHealthy && frontendHealthy) {
            break;
          }
        } catch {
          // ignore
        }
        await new Promise((r) => setTimeout(r, 1000));
      }
      if (!backendHealthy || !frontendHealthy) {
        throw new Error(
          `Timeout esperando a que los servicios estén healthy en Docker (backend=${backendHealthy}, frontend=${frontendHealthy})`,
        );
      }
      console.log("✔ Servicios healthy en Docker");

      console.log("Verificando GET http://localhost:8080/...");
      const resRoot = await fetch("http://localhost:8080/", { signal: timeoutSignal(5000) });
      if (resRoot.status !== 200) {
        throw new Error(
          `Esperado status 200 en http://localhost:8080/, recibido ${resRoot.status}`,
        );
      }
      console.log("✔ GET http://localhost:8080/ respondió 200");

      console.log("Verificando GET http://localhost:8080/api/health...");
      const resHealth = await fetch("http://localhost:8080/api/health", {
        signal: timeoutSignal(5000),
      });
      if (resHealth.status !== 200) {
        throw new Error(
          `Esperado status 200 en /api/health vía nginx, recibido ${resHealth.status}`,
        );
      }
      const body = await resHealth.json();
      if (body.status !== "ok") {
        throw new Error(`Esperado status: ok en /api/health, recibido ${JSON.stringify(body)}`);
      }
      console.log("✔ GET http://localhost:8080/api/health respondió 200 con status: ok");

      console.log("Verificando que http://localhost:3000 NO responde desde el host...");
      try {
        const resDirect = await fetch("http://localhost:3000/health", {
          signal: timeoutSignal(1500),
        });
        throw new Error(
          `Inseguridad: backend expuso http://localhost:3000/health al host con status ${resDirect.status}`,
        );
      } catch (err) {
        if (err.message && err.message.startsWith("Inseguridad:")) {
          throw err;
        }
        console.log("✔ Confirmado: el puerto 3000 del backend no es accesible desde el host");
      }

      if (apiDocs) {
        console.log("Verificando redirección GET http://localhost:8080/api/docs...");
        const resDocsRedirect = await fetch("http://localhost:8080/api/docs", {
          redirect: "manual",
          signal: timeoutSignal(5000),
        });
        if (resDocsRedirect.status !== 301) {
          throw new Error(
            `Esperado status 301 en /api/docs vía Docker, recibido ${resDocsRedirect.status}`,
          );
        }
        const location = resDocsRedirect.headers.get("location");
        if (location !== "docs/") {
          throw new Error(
            `Esperada cabecera Location: 'docs/' en /api/docs vía Docker, recibido '${location}'`,
          );
        }
        console.log("✔ GET http://localhost:8080/api/docs respondió 301 con Location: docs/");

        console.log("Verificando GET http://localhost:8080/api/docs/...");
        const resDocs = await fetch("http://localhost:8080/api/docs/", {
          redirect: "manual",
          signal: timeoutSignal(5000),
        });
        if (resDocs.status !== 200) {
          throw new Error(
            `Esperado status 200 directo en /api/docs/ vía Docker, recibido ${resDocs.status}`,
          );
        }
        if (resDocs.headers.get("location")) {
          throw new Error(
            `Inesperada redirección en /api/docs/ vía Docker con Location: '${resDocs.headers.get("location")}'`,
          );
        }
        const docsHtml = await resDocs.text();
        if (!docsHtml.includes("swagger-ui")) {
          throw new Error("HTML en /api/docs/ vía Docker no contiene 'swagger-ui'");
        }
        console.log("✔ GET http://localhost:8080/api/docs/ respondió 200 directo con Swagger UI");

        await verifySwaggerUiAssets(docsHtml, "http://localhost:8080/api/docs/");
        console.log(
          "✔ Assets CSS y JS de Swagger UI verificados correctamente vía Docker (status 200 y Content-Type)",
        );
      }

      if (postgres) {
        checkComposePostgresRuntime(projectDir);

        const checkSql =
          "SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'test_items';";
        const checkOut = execFileSync(
          "docker",
          [
            "compose",
            "exec",
            "-T",
            "postgres",
            "psql",
            "-U",
            "brixa_test",
            "-d",
            "brixa_db",
            "-tAc",
            checkSql,
          ],
          { cwd: projectDir, stdio: "pipe" },
        )
          .toString()
          .trim();
        if (!checkOut.includes("test_items")) {
          throw new Error(
            "La tabla 'test_items' no existe en PostgreSQL tras migración vía Docker",
          );
        }
        console.log("✔ Tabla 'test_items' confirmada en PostgreSQL vía Docker");
      } else if (database === "sqlite") {
        const migrateArgs =
          language === "ts"
            ? ["compose", "run", "--rm", "backend", "node", "dist/db/migrate.js"]
            : ["compose", "run", "--rm", "backend", "npm", "run", "db:migrate"];
        run("docker", migrateArgs, projectDir);

        const checkScript =
          "import { createClient } from '@libsql/client'; const client = createClient({ url: 'file:./data/app.db' }); const res = await client.execute(\"SELECT name FROM sqlite_master WHERE type='table' AND name='test_items'\"); client.close(); if (res.rows.length === 0) process.exit(1);";
        execFileSync("docker", ["compose", "run", "--rm", "backend", "node", "-e", checkScript], {
          cwd: projectDir,
          stdio: "pipe",
        });
        console.log("✔ Tabla 'test_items' confirmada en SQLite vía Docker");
      }
    } finally {
      console.log("\nLimpiando recursos Docker (docker compose down -v)...");
      try {
        execFileSync("docker", ["compose", "down", "-v"], {
          cwd: projectDir,
          env: verificationEnv(),
          stdio: "inherit",
        });
      } catch {
        // Ignorar
      }
    }
    return;
  }

  // Backend
  if (database === "postgres") {
    const envFile = path.join(projectDir, ".env");
    const envContent =
      [
        "POSTGRES_USER=brixa_test",
        "POSTGRES_PASSWORD=" + randomBytes(24).toString("hex"),
        "POSTGRES_DB=brixa_db",
        pendingRuntimeUrl,
      ].join("\n") + "\n";
    fs.writeFileSync(envFile, envContent, "utf-8");
  }

  if (!backendPrepared) prepareDependencies(projectDir, verificationMode);

  if (database === "postgres") {
    const schemaFile = path.join(
      projectDir,
      "src",
      "db",
      language === "ts" ? "schema.ts" : "schema.js",
    );
    const schemaSnippet = `
import { pgTable, serial, text } from "drizzle-orm/pg-core";

export const testItems = pgTable("test_items", {
  id: serial("id").primaryKey(),
  title: text("title").notNull(),
});
`;
    fs.writeFileSync(schemaFile, schemaSnippet, "utf-8");
    run("npm", ["run", "db:generate"], projectDir);
    addFixtureGrants(projectDir);
  } else if (database === "sqlite") {
    const schemaFile = path.join(
      projectDir,
      "src",
      "db",
      language === "ts" ? "schema.ts" : "schema.js",
    );
    const schemaSnippet = `
import { sqliteTable, integer, text } from "drizzle-orm/sqlite-core";

export const testItems = sqliteTable("test_items", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  title: text("title").notNull(),
});
`;
    fs.writeFileSync(schemaFile, schemaSnippet, "utf-8");
    run("npm", ["run", "db:generate"], projectDir);
  }

  try {
    const postgres =
      database === "postgres" ? await provisionComposePostgres(projectDir, projectDir) : undefined;
    run("docker", ["compose", "build"], projectDir);
    if (postgres) migrateComposePostgres(projectDir, language, postgres);
    run("docker", ["compose", "up", "-d"], projectDir);

    console.log("Esperando a que el backend esté healthy en Docker...");
    const startTime = Date.now();
    let healthy = false;
    while (Date.now() - startTime < 60000) {
      try {
        const out = execFileSync("docker", ["compose", "ps", "backend", "--format", "json"], {
          cwd: projectDir,
          stdio: "pipe",
        }).toString();
        if (out.includes('"healthy"')) {
          healthy = true;
          break;
        }
      } catch {
        // ignore
      }
      await new Promise((r) => setTimeout(r, 1000));
    }
    if (!healthy) {
      throw new Error("Timeout esperando a que el servicio backend esté healthy en Docker");
    }
    console.log("✔ Backend healthy en Docker");

    console.log("Verificando GET http://localhost:3000/health...");
    const res = await fetch("http://localhost:3000/health", { signal: timeoutSignal(5000) });
    if (res.status !== 200) {
      throw new Error(`Esperado status 200 en /health, recibido ${res.status}`);
    }
    const body = await res.json();
    if (body.status !== "ok") {
      throw new Error(`Esperado status: ok en /health, recibido ${JSON.stringify(body)}`);
    }
    console.log("✔ GET /health respondió 200 con status: ok");

    if (postgres) {
      checkComposePostgresRuntime(projectDir);

      const checkSql =
        "SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'test_items';";
      const checkOut = execFileSync(
        "docker",
        [
          "compose",
          "exec",
          "-T",
          "postgres",
          "psql",
          "-U",
          "brixa_test",
          "-d",
          "brixa_db",
          "-tAc",
          checkSql,
        ],
        { cwd: projectDir, stdio: "pipe" },
      )
        .toString()
        .trim();
      if (!checkOut.includes("test_items")) {
        throw new Error("La tabla 'test_items' no existe en PostgreSQL tras migración vía Docker");
      }
      console.log("✔ Tabla 'test_items' confirmada en PostgreSQL vía Docker");
    } else if (database === "sqlite") {
      const migrateArgs =
        language === "ts"
          ? ["compose", "run", "--rm", "backend", "node", "dist/db/migrate.js"]
          : ["compose", "run", "--rm", "backend", "npm", "run", "db:migrate"];
      run("docker", migrateArgs, projectDir);

      const checkScript =
        "import { createClient } from '@libsql/client'; const client = createClient({ url: 'file:./data/app.db' }); const res = await client.execute(\"SELECT name FROM sqlite_master WHERE type='table' AND name='test_items'\"); client.close(); if (res.rows.length === 0) process.exit(1);";
      execFileSync("docker", ["compose", "run", "--rm", "backend", "node", "-e", checkScript], {
        cwd: projectDir,
        stdio: "pipe",
      });
      console.log("✔ Tabla 'test_items' confirmada en SQLite vía Docker");
    }
  } finally {
    console.log("\nLimpiando recursos Docker (docker compose down -v)...");
    try {
      execFileSync("docker", ["compose", "down", "-v"], {
        cwd: projectDir,
        env: verificationEnv(),
        stdio: "inherit",
      });
    } catch {
      // Ignorar
    }
  }
}

// ---------------------------------------------------------------------------
// Verificación de una variante
// ---------------------------------------------------------------------------

export function getVariantLabel(variant) {
  const {
    modality,
    language,
    database = "none",
    docker = false,
    apiDocs = false,
    i18n = false,
  } = variant;
  const labelParts = [modality, language];
  if (database !== "none") labelParts.push(database);
  if (docker) labelParts.push("docker");
  if (apiDocs) labelParts.push("docs");
  if (i18n) labelParts.push("i18n");
  return labelParts.join("+");
}

async function verifyVariant(variant, step, total, pgContext) {
  const {
    modality,
    language,
    database = "none",
    docker = false,
    apiDocs = false,
    i18n = false,
  } = variant;
  const label = getVariantLabel(variant);
  console.log(`\n=== ${step}/${total}  Generando proyecto ${label} === [T+${getElapsedSuite()}]`);
  const variantStartTime = performance.now();

  const tmpRoot = fs.realpathSync.native(os.tmpdir());
  const tmpBase = fs.mkdtempSync(path.join(tmpRoot, `brixa-verify-${label.replace(/\+/g, "-")}-`));
  const projectDir = path.join(tmpBase, "test-project");

  let postgres;
  try {
    await generateProject(modality, language, projectDir, database, docker, apiDocs, i18n);
    console.log(`Proyecto generado en: ${projectDir}`);

    if (verificationMode === "audit") {
      const directories =
        modality === "fullstack"
          ? [path.join(projectDir, "frontend"), path.join(projectDir, "backend")]
          : [projectDir];
      for (const directory of directories) prepareDependencies(directory, verificationMode);
      console.log(`✔ ${label}: auditoría correcta; funcionamiento no evaluado.`);
      return;
    }

    if (docker) {
      if (!isDockerComposeV2Available()) {
        console.log("\n========================================================");
        console.log("NO VERIFICADO: Docker Compose v2");
        console.log("========================================================");
        return "NOT_VERIFIED";
      }
      await verifyDockerVariant(projectDir, modality, language, database, label, apiDocs);
      const variantDuration = performance.now() - variantStartTime;
      console.log(
        `\n✔ ${label} verificado correctamente (${formatDuration(variantDuration)}, acumulado: ${getElapsedSuite()})`,
      );
      return;
    }

    const hasPostgres = database === "postgres";
    const hasSqlite = database === "sqlite";
    const hasDb = hasPostgres || hasSqlite;
    const databaseDir = modality === "fullstack" ? path.join(projectDir, "backend") : projectDir;
    if (hasPostgres && pgContext.available) postgres = await pgContext.open(databaseDir);
    const runtimeEnv = postgres ? { DATABASE_URL: postgres.DATABASE_URL } : {};

    if (modality === "fullstack") {
      const frontendDir = path.join(projectDir, "frontend");
      const backendDir = path.join(projectDir, "backend");

      if (!hasDb) {
        verifyNoDatabaseArtifacts(backendDir);
      }

      // Frontend: install, audit, build, lint
      prepareDependencies(frontendDir, verificationMode);
      run("npm", ["run", "build"], frontendDir);
      run("npm", ["run", "lint"], frontendDir);

      // Backend: install, audit, build (si TS), lint, typecheck (si TS), test
      prepareDependencies(backendDir, verificationMode);
      if (language === "ts") {
        run("npm", ["run", "build"], backendDir);
        run("npm", ["run", "typecheck"], backendDir);
      }
      run("npm", ["run", "lint"], backendDir);
      run("npm", ["run", "format:check"], backendDir);

      if (hasPostgres) {
        await verifyDatabaseIntegration(backendDir, language, pgContext, postgres);
      } else if (hasSqlite) {
        await verifySqliteIntegration(backendDir, language);
      } else {
        run("npm", ["run", "test"], backendDir);
      }

      if (!hasPostgres || postgres) {
        // Verificación de comunicación frontend-backend vía proxy Vite
        const entryPoint =
          language === "ts" ? path.join("dist", "index.js") : path.join("src", "index.js");
        let backendChild;
        let viteChild;

        const envExample = path.join(backendDir, ".env.example");
        const envFile = path.join(backendDir, ".env");
        let createdEnv = false;

        try {
          if (apiDocs) {
            let envContent = fs.existsSync(envExample) ? fs.readFileSync(envExample, "utf-8") : "";
            if (envContent.includes("ENABLE_API_DOCS=")) {
              envContent = envContent.replace(/ENABLE_API_DOCS=.*/, "ENABLE_API_DOCS=true");
            } else {
              envContent += "\nENABLE_API_DOCS=true\n";
            }
            fs.writeFileSync(envFile, envContent, "utf-8");
            createdEnv = true;
          }

          const proxyStart = performance.now();
          const backend = await startBackendServer(backendDir, entryPoint, runtimeEnv);
          backendChild = backend.child;

          const vite = await startViteServer(frontendDir, backend.port, backend);
          viteChild = vite.child;

          console.log(`Vite escuchando en puerto ${vite.port}. Verificando GET /api/health...`);
          const res = await fetch(`http://127.0.0.1:${vite.port}/api/health`, {
            signal: timeoutSignal(5000),
          });
          if (res.status !== 200) {
            throw new Error(
              `Esperado status 200 en /api/health vía proxy de Vite, recibido ${res.status}`,
            );
          }
          const body = await res.json();
          if (body.status !== "ok") {
            throw new Error(
              `Esperado body { status: "ok" } en /api/health, recibido ${JSON.stringify(body)}`,
            );
          }
          console.log("✔ GET /api/health vía Vite proxy respondió 200 con status: ok");

          if (apiDocs) {
            console.log(`Verificando redirección GET http://127.0.0.1:${vite.port}/api/docs...`);
            const resDocsRedirect = await fetch(`http://127.0.0.1:${vite.port}/api/docs`, {
              redirect: "manual",
              signal: timeoutSignal(5000),
            });
            if (resDocsRedirect.status !== 301) {
              throw new Error(
                `Esperado status 301 en /api/docs vía Vite, recibido ${resDocsRedirect.status}`,
              );
            }
            const location = resDocsRedirect.headers.get("location");
            if (location !== "docs/") {
              throw new Error(`Esperada cabecera Location: 'docs/', recibido '${location}'`);
            }
            console.log("✔ GET /api/docs vía Vite respondió 301 con Location: docs/");

            console.log(`Verificando GET http://127.0.0.1:${vite.port}/api/docs/...`);
            const resDocs = await fetch(`http://127.0.0.1:${vite.port}/api/docs/`, {
              redirect: "manual",
              signal: timeoutSignal(5000),
            });
            if (resDocs.status !== 200) {
              throw new Error(
                `Esperado status 200 directo en /api/docs/ vía Vite, recibido ${resDocs.status}`,
              );
            }
            if (resDocs.headers.get("location")) {
              throw new Error(
                `Inesperada redirección en /api/docs/ vía Vite con Location: '${resDocs.headers.get("location")}'`,
              );
            }
            const docsHtml = await resDocs.text();
            if (!docsHtml.includes("swagger-ui")) {
              throw new Error("HTML en /api/docs/ vía Vite no contiene 'swagger-ui'");
            }
            console.log("✔ GET /api/docs/ vía Vite respondió 200 directo con Swagger UI");

            await verifySwaggerUiAssets(docsHtml, `http://127.0.0.1:${vite.port}/api/docs/`);
            console.log(
              "✔ Assets CSS y JS de Swagger UI verificados correctamente vía Vite proxy (status 200 y Content-Type)",
            );
          }
          console.log(
            `✔ Verificación proxy Vite completada (${formatDuration(performance.now() - proxyStart)})`,
          );
        } finally {
          if (createdEnv) {
            fs.rmSync(envFile, { force: true });
          }
          console.log("Cerrando servidores Vite y backend...");
          await stopProcess(viteChild);
          await stopProcess(backendChild);
        }
      }

      if (i18n) {
        const i18nStart = performance.now();
        await verifyI18n(frontendDir, language);
        console.log(
          `✔ Verificación i18n completada (${formatDuration(performance.now() - i18nStart)})`,
        );
      }
    } else {
      if (modality === "backend" && !hasDb) {
        verifyNoDatabaseArtifacts(projectDir);
      }

      prepareDependencies(projectDir, verificationMode);
      if (modality === "frontend" || language === "ts") {
        run("npm", ["run", "build"], projectDir);
      }
      run("npm", ["run", "lint"], projectDir);

      if (modality === "frontend" && i18n) {
        const i18nStart = performance.now();
        await verifyI18n(projectDir, language);
        console.log(
          `✔ Verificación i18n completada (${formatDuration(performance.now() - i18nStart)})`,
        );
      }

      if (modality === "backend") {
        run("npm", ["run", "format:check"], projectDir);
        if (language === "ts") {
          run("npm", ["run", "typecheck"], projectDir);
        }

        if (hasPostgres) {
          await verifyDatabaseIntegration(projectDir, language, pgContext, postgres);
        } else if (hasSqlite) {
          await verifySqliteIntegration(projectDir, language);
        } else {
          run("npm", ["run", "test"], projectDir);
        }

        const entryPoint =
          language === "ts" ? path.join("dist", "index.js") : path.join("src", "index.js");
        if (!hasPostgres || postgres) {
          await checkBackendServer(projectDir, entryPoint, runtimeEnv);
          if (apiDocs) await checkBackendDocs(projectDir, entryPoint, runtimeEnv);
        }
      }
    }

    const variantDuration = performance.now() - variantStartTime;
    if (hasPostgres && !pgContext.available) {
      console.log(
        `\n⚠ ${label}: NO VERIFICADO: PostgreSQL (${formatDuration(variantDuration)}, acumulado: ${getElapsedSuite()})`,
      );
      return "NOT_VERIFIED";
    } else {
      console.log(
        `\n✔ ${label} verificado correctamente (${formatDuration(variantDuration)}, acumulado: ${getElapsedSuite()})`,
      );
    }
  } catch (err) {
    const variantDuration = performance.now() - variantStartTime;
    console.error(
      `\n✖ ${label} falló tras ${formatDuration(variantDuration)} (acumulado: ${getElapsedSuite()}): ${err.message ?? err}`,
    );
    throw err;
  } finally {
    try {
      await postgres?.stop();
    } finally {
      const cleanStart = performance.now();
      try {
        console.log(`\nLimpiando ${tmpBase} …`);
        fs.rmSync(tmpBase, { recursive: true, force: true, maxRetries: 5, retryDelay: 300 });
        console.log(`✔ Limpieza completada (${formatDuration(performance.now() - cleanStart)})`);
      } catch (error) {
        console.warn(
          `Aviso: no se pudo limpiar ${tmpBase} tras ${formatDuration(performance.now() - cleanStart)}: ${error.message}`,
        );
      }
    }
  }
}

/** Verifica integración con PostgreSQL: schema, db:generate, db:migrate, existencia de tabla y tests. */
export async function verifyDatabaseIntegration(backendDir, language, pgContext, postgres) {
  // La auditoría se ejecuta en modo integral o audit; el modo functional no la evalúa.

  if (!pgContext.available) {
    console.log("\n========================================================");
    console.log(
      "NO VERIFICADO: PostgreSQL (Docker no disponible ni URLs de verificación configuradas)",
    );
    console.log("========================================================");
    run("npm", ["run", "test"], backendDir);
    return;
  }

  const connection = postgres ?? (await pgContext.open(backendDir));
  try {
    // 1. Añadir tabla mínima en el schema dentro del directorio temporal (nunca en la plantilla)
    const schemaFile = path.join(
      backendDir,
      "src",
      "db",
      language === "ts" ? "schema.ts" : "schema.js",
    );
    const schemaSnippet = `
import { pgTable, serial, text } from "drizzle-orm/pg-core";

export const testItems = pgTable("test_items", {
  id: serial("id").primaryKey(),
  title: text("title").notNull(),
});
`;
    fs.writeFileSync(schemaFile, schemaSnippet, "utf-8");

    // 2. Generar migraciones
    run("npm", ["run", "db:generate"], backendDir);

    addFixtureGrants(backendDir);
    run("npm", ["run", "db:migrate"], backendDir, {
      MIGRATION_DATABASE_URL: connection.MIGRATION_DATABASE_URL,
    });

    // 4. Comprobar que la tabla existe en la base de datos
    const checkPath = path.join(backendDir, "verify-table.mjs");
    fs.writeFileSync(checkPath, verifyPostgresRuntime, "utf-8");
    try {
      run("node", ["verify-table.mjs"], backendDir, { DATABASE_URL: connection.DATABASE_URL });
    } finally {
      fs.rmSync(checkPath, { force: true });
    }

    // 5. Ejecutar tests con DATABASE_URL definida
    run("npm", ["run", "test:unit"], backendDir);
    run("npm", ["run", "test:db"], backendDir, { DATABASE_URL: connection.DATABASE_URL });
  } finally {
    if (!postgres) await connection.stop();
  }
}

/** Verifica integración con SQLite: schema, db:generate, db:migrate (incluso con data/ borrada), existencia de tabla y tests. */
export async function verifySqliteIntegration(backendDir, language) {
  // La auditoría se ejecuta en modo integral o audit; el modo functional no la evalúa.

  const databaseUrl = "file:./data/app.db";

  // 1. Añadir tabla mínima en el schema dentro del directorio temporal (nunca en la plantilla)
  const schemaFile = path.join(
    backendDir,
    "src",
    "db",
    language === "ts" ? "schema.ts" : "schema.js",
  );
  const schemaSnippet = `
import { sqliteTable, integer, text } from "drizzle-orm/sqlite-core";

export const testItems = sqliteTable("test_items", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  title: text("title").notNull(),
});
`;
  fs.writeFileSync(schemaFile, schemaSnippet, "utf-8");

  // 2. Generar migraciones
  run("npm", ["run", "db:generate"], backendDir);

  // 3. Comprobar que db:migrate funciona con data/ borrada
  const dataDir = path.join(backendDir, "data");
  if (fs.existsSync(dataDir)) {
    fs.rmSync(dataDir, { recursive: true, force: true });
  }

  // 4. Aplicar migraciones con DATABASE_URL
  run("npm", ["run", "db:migrate"], backendDir, { DATABASE_URL: databaseUrl });

  if (!fs.existsSync(dataDir)) {
    throw new Error("El directorio 'data/' no fue creado automáticamente por db:migrate.");
  }

  // 5. Comprobar que la tabla existe en la base de datos SQLite
  const checkScript = `
import { createClient } from "@libsql/client";
const client = createClient({ url: process.env.DATABASE_URL });
const res = await client.execute("SELECT name FROM sqlite_master WHERE type='table' AND name='test_items'");
if (res.rows.length === 0) {
  throw new Error("La tabla 'test_items' no existe en la base de datos tras ejecutar migraciones.");
}
console.log("✔ Tabla 'test_items' encontrada en SQLite.");
client.close();
`;
  const checkPath = path.join(backendDir, "verify-table.mjs");
  fs.writeFileSync(checkPath, checkScript, "utf-8");
  try {
    run("node", ["verify-table.mjs"], backendDir, { DATABASE_URL: databaseUrl });
  } finally {
    fs.rmSync(checkPath, { force: true });
  }

  // 6. Ejecutar tests con DATABASE_URL definida
  run("npm", ["run", "test:unit"], backendDir);
  run("npm", ["run", "test:db"], backendDir, { DATABASE_URL: databaseUrl });
}

// ---------------------------------------------------------------------------
// Script principal
// ---------------------------------------------------------------------------

export const VARIANTS = [
  { modality: "frontend", language: "ts", database: "none" },
  { modality: "frontend", language: "js", database: "none" },
  { modality: "backend", language: "ts", database: "none" },
  { modality: "backend", language: "js", database: "none" },
  { modality: "fullstack", language: "ts", database: "none" },
  { modality: "fullstack", language: "js", database: "none" },
  { modality: "backend", language: "ts", database: "postgres" },
  { modality: "backend", language: "js", database: "postgres" },
  { modality: "fullstack", language: "ts", database: "postgres" },
  { modality: "fullstack", language: "js", database: "postgres" },
  { modality: "backend", language: "ts", database: "sqlite" },
  { modality: "backend", language: "js", database: "sqlite" },
  { modality: "fullstack", language: "ts", database: "sqlite" },
  { modality: "fullstack", language: "js", database: "sqlite" },
  { modality: "backend", language: "ts", database: "none", docker: true },
  { modality: "backend", language: "js", database: "none", docker: true },
  { modality: "backend", language: "ts", database: "postgres", docker: true },
  { modality: "backend", language: "js", database: "postgres", docker: true },
  { modality: "backend", language: "ts", database: "sqlite", docker: true },
  { modality: "backend", language: "js", database: "sqlite", docker: true },
  { modality: "fullstack", language: "ts", database: "none", docker: true },
  { modality: "fullstack", language: "js", database: "none", docker: true },
  { modality: "fullstack", language: "ts", database: "postgres", docker: true },
  { modality: "fullstack", language: "js", database: "postgres", docker: true },
  { modality: "fullstack", language: "ts", database: "sqlite", docker: true },
  { modality: "fullstack", language: "js", database: "sqlite", docker: true },
  { modality: "backend", language: "ts", database: "none", apiDocs: true },
  { modality: "backend", language: "js", database: "none", apiDocs: true },
  { modality: "fullstack", language: "ts", database: "postgres", docker: true, apiDocs: true },
  { modality: "fullstack", language: "js", database: "sqlite", docker: false, apiDocs: true },
  { modality: "frontend", language: "ts", database: "none", i18n: true },
  { modality: "fullstack", language: "js", database: "sqlite", docker: false, i18n: true },
];

export function getPortableVariants(variants = VARIANTS) {
  return variants.filter((v) => !v.docker && v.database !== "postgres");
}

export const PORTABLE_PARTITIONS = Object.freeze({
  A: Object.freeze([
    "frontend+ts",
    "frontend+js",
    "backend+js",
    "backend+ts+sqlite",
    "fullstack+js+sqlite",
    "backend+ts+docs",
    "backend+js+docs",
    "fullstack+js+sqlite+docs",
  ]),
  B: Object.freeze([
    "backend+ts",
    "fullstack+ts",
    "fullstack+js",
    "backend+js+sqlite",
    "fullstack+ts+sqlite",
    "frontend+ts+i18n",
    "fullstack+js+sqlite+i18n",
  ]),
});

export function validatePortablePartitions(portableVariants, partitions = PORTABLE_PARTITIONS) {
  if (!partitions || typeof partitions !== "object") {
    throw new Error("Particiones no definidas o con formato inválido.");
  }
  const partitionKeys = Object.keys(partitions);
  if (partitionKeys.length === 0) {
    throw new Error("No hay particiones definidas.");
  }

  const portableLabels = new Set(portableVariants.map(getVariantLabel));
  const seen = new Set();

  for (const key of partitionKeys) {
    const list = partitions[key];
    if (!Array.isArray(list) || list.length === 0) {
      throw new Error(`Partición '${key}' está vacía o no es un array.`);
    }
    for (const label of list) {
      if (!portableLabels.has(label)) {
        throw new Error(`Variante desconocida o no portable '${label}' en partición '${key}'.`);
      }
      if (seen.has(label)) {
        throw new Error(
          `Variante duplicada '${label}' presente en más de una partición (intersección no vacía).`,
        );
      }
      seen.add(label);
    }
  }

  const missing = [...portableLabels].filter((label) => !seen.has(label));
  if (missing.length > 0) {
    throw new Error(`Variantes portables omitidas en las particiones: ${missing.join(", ")}`);
  }
}

async function main() {
  const scope = process.env.VERIFY_SCOPE || "full";
  if (scope !== "portable" && scope !== "full") {
    console.error(`VERIFY_SCOPE inválido: '${scope}'. Valores permitidos: 'portable' o 'full'.`);
    process.exit(1);
  }

  // Parseo de argumentos de línea de comandos y variables de entorno para partición
  verificationMode = getVerificationMode(process.argv.slice(2));
  console.log(
    `Modo: ${verificationMode}${verificationMode === "functional" ? " (seguridad NO EVALUADA)" : ""}`,
  );
  const rawArgs = process.argv
    .slice(2)
    .filter((arg) => arg !== "--functional-only" && arg !== "--audit-only");
  let cliPartition = null;
  const filterArgs = [];

  for (let i = 0; i < rawArgs.length; i++) {
    const arg = rawArgs[i];
    if (arg.startsWith("--partition=")) {
      cliPartition = arg.slice("--partition=".length).trim();
    } else if (arg === "--partition" || arg === "-p") {
      i++;
      if (i < rawArgs.length) {
        cliPartition = rawArgs[i].trim();
      } else {
        console.error(
          "Falta el valor para el argumento --partition. Valores permitidos: 'A' o 'B'.",
        );
        process.exit(1);
      }
    } else {
      filterArgs.push(arg);
    }
  }

  const envPartition = process.env.VERIFY_PARTITION?.trim() || null;
  if (cliPartition && envPartition && cliPartition !== envPartition) {
    console.error(
      `Conflicto entre argumento --partition='${cliPartition}' y variable VERIFY_PARTITION='${envPartition}'.`,
    );
    process.exit(1);
  }

  const partition = cliPartition || envPartition;

  // Validación estricta del parámetro de partición
  if (partition !== null) {
    if (partition !== "A" && partition !== "B") {
      console.error(`VERIFY_PARTITION inválido: '${partition}'. Valores permitidos: 'A' o 'B'.`);
      process.exit(1);
    }
    if (scope !== "portable") {
      console.error(
        `VERIFY_PARTITION solo es válido con VERIFY_SCOPE='portable' (actual: '${scope}').`,
      );
      process.exit(1);
    }
    if (filterArgs.length > 0) {
      console.error(
        `No se puede combinar selección manual de variantes (${filterArgs.join(", ")}) con partición '${partition}'.`,
      );
      process.exit(1);
    }
  }

  // Validación automatizada de las particiones portables en cada ejecución
  try {
    validatePortablePartitions(getPortableVariants());
  } catch (err) {
    console.error(`✖ Error de validación de particiones portables: ${err.message}`);
    process.exit(1);
  }

  let variantsToRun;
  if (filterArgs.length > 0) {
    variantsToRun = VARIANTS.filter((v) => filterArgs.includes(getVariantLabel(v)));
  } else if (partition) {
    const partitionLabels = new Set(PORTABLE_PARTITIONS[partition]);
    variantsToRun = getPortableVariants().filter((v) => partitionLabels.has(getVariantLabel(v)));
  } else {
    variantsToRun = VARIANTS;
  }

  if (scope === "portable" && !partition) {
    variantsToRun = getPortableVariants(variantsToRun);
  }

  if (variantsToRun.length === 0) {
    console.error(
      filterArgs.length > 0
        ? `Ninguna variante coincide con: ${filterArgs.join(", ")} (ámbito: ${scope})`
        : `Ninguna variante coincide con los criterios (ámbito: ${scope}${partition ? `, partición: ${partition}` : ""})`,
    );
    process.exit(1);
  }

  if (partition) {
    console.log(
      `Partición portable activa: Grupo ${partition} (${variantsToRun.length} variantes)`,
    );
  }

  const total = variantsToRun.length + 2; // 1 build + N variantes + 1 resumen
  console.log(`=== 1/${total}  npm run build === [T+${getElapsedSuite()}]`);
  run("npm", ["run", "build"], root);

  // Comprobar que VERIFIED_VARIANTS de dist/ coincide exactamente con VARIANTS del arnés.
  // Si no coinciden, alguien modificó uno sin actualizar el otro.
  // D-053: La comprobación se hace contra la lista COMPLETA de VARIANTS antes de filtrar por VERIFY_SCOPE.
  {
    const distVerified = await import(
      pathToFileURL(path.join(root, "dist", "verified-variants.js")).href
    );
    const distLabels = new Set(distVerified.VERIFIED_VARIANTS.map(distVerified.variantLabel));
    const arnésLabels = VARIANTS.map(getVariantLabel);
    const missingInDist = arnésLabels.filter((l) => !distLabels.has(l));
    const extraInDist = [...distLabels].filter((l) => !arnésLabels.includes(l));
    if (missingInDist.length > 0 || extraInDist.length > 0) {
      if (missingInDist.length > 0)
        console.error(`✖ VERIFIED_VARIANTS falta en dist: ${missingInDist.join(", ")}`);
      if (extraInDist.length > 0)
        console.error(`✖ VERIFIED_VARIANTS tiene de más en dist: ${extraInDist.join(", ")}`);
      process.exit(1);
    }
    console.log(
      `✔ VERIFIED_VARIANTS coincide exactamente con VARIANTS del arnés (${VARIANTS.length} entradas).`,
    );
  }

  // El contenedor de PostgreSQL solo se arranca si alguna variante seleccionada lo necesita.
  const needsPostgres =
    verificationMode !== "audit" &&
    variantsToRun.some((v) => v.database === "postgres" && !v.docker);
  const pgContext = needsPostgres
    ? await setupPostgres()
    : { databaseUrl: null, stop: async () => {}, available: true };

  try {
    await runReportedVerification(
      VARIANTS,
      variantsToRun,
      (variant, index) => verifyVariant(variant, index + 2, total, pgContext),
      verificationMode,
    );
  } finally {
    await pgContext.stop();
  }

  const totalElapsed = performance.now() - suiteStartTime;
  if (!pgContext.available) {
    console.log(
      `\n=== ${total}/${total}  ⚠ verify:generated completado con advertencias (PostgreSQL: NO VERIFICADO) en ${formatDuration(totalElapsed)} ===`,
    );
  } else {
    console.log(
      `\n=== ${total}/${total}  ✔ verify:generated (${verificationMode}) completado con éxito${verificationMode === "functional" ? "; seguridad NO EVALUADA" : ""} en ${formatDuration(totalElapsed)} ===`,
    );
  }
}

const isDirectRun =
  process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1]);

if (isDirectRun) {
  main().catch((err) => {
    console.error(
      `\n✖ verify:generated (${verificationMode}) falló tras ${getElapsedSuite()}:`,
      err.message ?? err,
    );
    process.exit(1);
  });
}
