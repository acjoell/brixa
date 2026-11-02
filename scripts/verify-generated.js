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
 */
import { execFileSync, spawn } from "node:child_process";
import fs from "node:fs";
import net from "node:net";
import os from "node:os";
import path from "node:path";
import { fileURLToPath, pathToFileURL, URL } from "node:url";
import { verifyI18n } from "./verify-i18n.js";

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, "..");

// ---------------------------------------------------------------------------
// Utilidades
// ---------------------------------------------------------------------------

/** Ejecuta un comando sincrónico e imprime la salida heredada sin exponer variables de entorno sensibles. */
function run(cmd, args, cwd, extraEnv = {}) {
  console.log(`\n$ ${cmd} ${args.join(" ")}  (cwd: ${cwd})`);
  // Excluir NODE_ENV del entorno heredado para que los builds de Vite usen "production".
  // Vite establece NODE_ENV="development" cuando lanza createServer, y si ese valor
  // se propaga a builds hijos, React se incluye en modo desarrollo (~70 kB extra).
  const env = { ...process.env, ...extraEnv };
  delete env.NODE_ENV;
  const isWindows = process.platform === "win32";
  const actualCmd = isWindows && cmd === "npm" ? "npm.cmd" : cmd;
  execFileSync(actualCmd, args, { cwd, stdio: "inherit", env, shell: isWindows });
}

/** Cierra un proceso de forma limpia y fuerza el cierre de todo el árbol en Windows si es necesario. */
async function stopProcess(child) {
  if (!child || child.killed || child.exitCode !== null) return;

  if (process.platform === "win32") {
    try {
      execFileSync("taskkill", ["/pid", String(child.pid), "/T", "/F"], { stdio: "ignore" });
    } catch {
      // Ignorar si el proceso ya terminó
    }
  } else {
    try {
      child.kill("SIGTERM");
    } catch {
      // ignore
    }
  }

  await new Promise((resolve) => {
    if (child.exitCode !== null) return resolve();
    child.once("exit", () => resolve());
    setTimeout(() => {
      try {
        if (process.platform !== "win32") child.kill("SIGKILL");
      } catch {
        // ignore
      }
      resolve();
    }, 4000);
  });
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
async function startBackendServer(
  projectDir,
  entryPoint = path.join("dist", "index.js"),
  extraEnv = {},
) {
  const normEntryPoint = path.normalize(entryPoint);
  console.log(`\nIniciando servidor backend (${normEntryPoint})...`);
  const serverEnv = { ...process.env, PORT: "0", ...extraEnv };
  delete serverEnv.NODE_ENV;
  const child = spawn("node", [normEntryPoint], {
    cwd: projectDir,
    env: serverEnv,
    stdio: ["ignore", "pipe", "pipe"],
  });

  const stdoutLines = [];
  const stderrLines = [];

  const port = await new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      const outTail = stdoutLines.slice(-30).join("\n").trim();
      const errTail = stderrLines.slice(-30).join("\n").trim();
      reject(
        new Error(
          `Timeout esperando a que el servidor backend arranque.\n--- Últimas líneas stdout del backend ---\n${outTail || "(vacío)"}\n--- Últimas líneas stderr del backend ---\n${errTail || "(vacío)"}`,
        ),
      );
    }, 10000);

    let stdout = "";
    child.stdout.on("data", (chunk) => {
      const str = chunk.toString();
      stdoutLines.push(...str.split("\n"));
      stdout += str;
      const match = stdout.match(/http:\/\/localhost:(\d+)/);
      if (match) {
        clearTimeout(timeout);
        resolve(Number(match[1]));
      }
    });

    child.stderr.on("data", (chunk) => {
      stderrLines.push(...chunk.toString().split("\n"));
      process.stderr.write(chunk);
    });

    child.on("error", (err) => {
      clearTimeout(timeout);
      reject(err);
    });

    child.on("exit", (code) => {
      clearTimeout(timeout);
      reject(new Error(`El servidor backend terminó prematuramente con código ${code}`));
    });
  });

  return { child, port, stdoutLines, stderrLines };
}

/** Arranca el servidor de desarrollo de Vite sin usar npm run, con puerto libre, --strictPort y BACKEND_URL. */
async function startViteServer(frontendDir, backendPort, backendLogs = null) {
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
    const timeout = setTimeout(() => {
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
          const res = await fetch(`http://127.0.0.1:${vitePort}/`);
          if (res.ok) {
            checkReady();
            break;
          }
        } catch {
          // Aún no listo
        }
      }
    })();
  });

  return { child, port: vitePort };
}

/** Comprueba que el servidor backend arranca y responde 200 en /health antes de cerrarlo. */
async function checkBackendServer(projectDir, entryPoint = path.join("dist", "index.js")) {
  let backend;
  try {
    backend = await startBackendServer(projectDir, entryPoint);
    console.log(
      `Servidor backend escuchando en puerto ${backend.port}. Verificando GET /health...`,
    );
    const res = await fetch(`http://localhost:${backend.port}/health`);
    if (res.status !== 200) {
      throw new Error(`Esperado status 200 en /health, recibido ${res.status}`);
    }
    const body = await res.json();
    if (body.status !== "ok") {
      throw new Error(
        `Esperado body { status: "ok" } en /health, recibido ${JSON.stringify(body)}`,
      );
    }
    console.log("✔ GET /health respondió 200 con status: ok");
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
    const res = await fetch(assetUrl);
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
    const res = await fetch(assetUrl);
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
async function checkBackendDocs(projectDir, entryPoint = path.join("dist", "index.js")) {
  const envExample = path.join(projectDir, ".env.example");
  const envFile = path.join(projectDir, ".env");

  // 1. Sin ENABLE_API_DOCS: verificamos que /docs y /docs/ devuelven 404
  let backendWithoutDocs;
  try {
    backendWithoutDocs = await startBackendServer(projectDir, entryPoint);
    console.log(
      `Verificando GET http://localhost:${backendWithoutDocs.port}/docs (sin ENABLE_API_DOCS)...`,
    );
    const res = await fetch(`http://localhost:${backendWithoutDocs.port}/docs`, {
      redirect: "manual",
    });
    if (res.status !== 404) {
      throw new Error(`Esperado status 404 en /docs sin ENABLE_API_DOCS, recibido ${res.status}`);
    }
    const resSlash = await fetch(`http://localhost:${backendWithoutDocs.port}/docs/`, {
      redirect: "manual",
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

    backendWithDocs = await startBackendServer(projectDir, entryPoint);
    console.log(`Verificando redirección GET http://localhost:${backendWithDocs.port}/docs...`);
    const resRedirect = await fetch(`http://localhost:${backendWithDocs.port}/docs`, {
      redirect: "manual",
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

async function startPostgresContainer() {
  const port = await getFreePort();
  const containerName = `brixa-pg-verify-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
  const user = "brixa_test";
  const pass = "brixa_pass";
  const db = "brixa_db";

  console.log(`\nIniciando contenedor PostgreSQL desechable en 127.0.0.1:${port}...`);
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
      `POSTGRES_PASSWORD=${pass}`,
      "-e",
      `POSTGRES_DB=${db}`,
      "-p",
      `127.0.0.1:${port}:5432`,
      "postgres:17-alpine",
    ],
    { stdio: "inherit" },
  );

  const databaseUrl = `postgresql://${user}:${pass}@127.0.0.1:${port}/${db}`;

  const startTime = Date.now();
  let ready = false;
  while (Date.now() - startTime < 30000) {
    try {
      execFileSync("docker", ["exec", containerName, "pg_isready", "-U", user, "-d", db], {
        stdio: "ignore",
      });
      ready = true;
      break;
    } catch {
      await new Promise((r) => setTimeout(r, 500));
    }
  }

  if (!ready) {
    try {
      execFileSync("docker", ["stop", containerName], { stdio: "ignore" });
    } catch {
      // ignore
    }
    throw new Error("Timeout esperando a que el contenedor PostgreSQL esté listo");
  }

  console.log("✔ Contenedor PostgreSQL iniciado y listo para pruebas");

  const stop = async () => {
    console.log(`\nDeteniendo contenedor PostgreSQL ${containerName}...`);
    try {
      execFileSync("docker", ["stop", containerName], { stdio: "ignore" });
    } catch {
      // Ignorar si ya terminó
    }
  };

  return { databaseUrl, stop, containerName, user, pass, port };
}

async function setupPostgres() {
  if (process.env.VERIFY_DATABASE_URL) {
    console.log("\nUsando VERIFY_DATABASE_URL provista por el entorno.");
    return {
      databaseUrl: process.env.VERIFY_DATABASE_URL,
      stop: async () => {},
      available: true,
      containerName: null,
      user: null,
      pass: null,
      port: null,
    };
  }

  if (!isDockerAvailable()) {
    return {
      databaseUrl: null,
      stop: async () => {},
      available: false,
      containerName: null,
      user: null,
      pass: null,
      port: null,
    };
  }

  try {
    const container = await startPostgresContainer();
    return {
      databaseUrl: container.databaseUrl,
      stop: container.stop,
      available: true,
      containerName: container.containerName,
      user: container.user,
      pass: container.pass,
      port: container.port,
    };
  } catch (err) {
    console.warn("\nAdvertencia: no se pudo iniciar PostgreSQL vía Docker:", err.message ?? err);
    return {
      databaseUrl: null,
      stop: async () => {},
      available: false,
      containerName: null,
      user: null,
      pass: null,
      port: null,
    };
  }
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

/** Verifica variantes con Docker usando docker compose */
async function verifyDockerVariant(
  projectDir,
  modality,
  language,
  database,
  variantLabel,
  apiDocs = false,
) {
  console.log(`\nIniciando verificación Docker para ${variantLabel}...`);

  if (modality === "fullstack") {
    const backendDir = path.join(projectDir, "backend");
    const frontendDir = path.join(projectDir, "frontend");

    const envLines = [];
    if (database === "postgres") {
      envLines.push(
        "POSTGRES_USER=brixa_test",
        "POSTGRES_PASSWORD=brixa_pass_123",
        "POSTGRES_DB=brixa_db",
      );
    }
    if (apiDocs) {
      envLines.push("ENABLE_API_DOCS=true");
    }
    if (envLines.length > 0) {
      const envFile = path.join(projectDir, ".env");
      fs.writeFileSync(envFile, envLines.join("\n") + "\n", "utf-8");
    }

    run("npm", ["install"], backendDir);
    run("npm", ["audit", "--audit-level=moderate"], backendDir);
    run("npm", ["install"], frontendDir);
    run("npm", ["audit", "--audit-level=moderate"], frontendDir);

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
      run("docker", ["compose", "build"], projectDir);
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
      const resRoot = await fetch("http://localhost:8080/");
      if (resRoot.status !== 200) {
        throw new Error(
          `Esperado status 200 en http://localhost:8080/, recibido ${resRoot.status}`,
        );
      }
      console.log("✔ GET http://localhost:8080/ respondió 200");

      console.log("Verificando GET http://localhost:8080/api/health...");
      const resHealth = await fetch("http://localhost:8080/api/health");
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
          signal: globalThis.AbortSignal.timeout(1500),
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

      if (database === "postgres") {
        const migrateArgs =
          language === "ts"
            ? ["compose", "run", "--rm", "backend", "node", "dist/db/migrate.js"]
            : ["compose", "run", "--rm", "backend", "npm", "run", "db:migrate"];
        run("docker", migrateArgs, projectDir);

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
        execFileSync("docker", ["compose", "down", "-v"], { cwd: projectDir, stdio: "inherit" });
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
      ["POSTGRES_USER=brixa_test", "POSTGRES_PASSWORD=brixa_pass_123", "POSTGRES_DB=brixa_db"].join(
        "\n",
      ) + "\n";
    fs.writeFileSync(envFile, envContent, "utf-8");
  }

  run("npm", ["install"], projectDir);
  run("npm", ["audit", "--audit-level=moderate"], projectDir);

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
    run("docker", ["compose", "build"], projectDir);
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
    const res = await fetch("http://localhost:3000/health");
    if (res.status !== 200) {
      throw new Error(`Esperado status 200 en /health, recibido ${res.status}`);
    }
    const body = await res.json();
    if (body.status !== "ok") {
      throw new Error(`Esperado status: ok en /health, recibido ${JSON.stringify(body)}`);
    }
    console.log("✔ GET /health respondió 200 con status: ok");

    if (database === "postgres") {
      const migrateArgs =
        language === "ts"
          ? ["compose", "run", "--rm", "backend", "node", "dist/db/migrate.js"]
          : ["compose", "run", "--rm", "backend", "npm", "run", "db:migrate"];
      run("docker", migrateArgs, projectDir);

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
      execFileSync("docker", ["compose", "down", "-v"], { cwd: projectDir, stdio: "inherit" });
    } catch {
      // Ignorar
    }
  }
}

// ---------------------------------------------------------------------------
// Verificación de una variante
// ---------------------------------------------------------------------------

function getVariantLabel(variant) {
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
  console.log(`\n=== ${step}/${total}  Generando proyecto ${label} ===`);

  const tmpBase = fs.mkdtempSync(
    path.join(os.tmpdir(), `brixa-verify-${label.replace(/\+/g, "-")}-`),
  );
  const projectDir = path.join(tmpBase, "test-project");

  try {
    await generateProject(modality, language, projectDir, database, docker, apiDocs, i18n);
    console.log(`Proyecto generado en: ${projectDir}`);

    if (docker) {
      if (!isDockerComposeV2Available()) {
        console.log("\n========================================================");
        console.log("NO VERIFICADO: Docker Compose v2");
        console.log("========================================================");
        return;
      }
      await verifyDockerVariant(projectDir, modality, language, database, label, apiDocs);
      console.log(`\n✔ ${label} verificado correctamente`);
      return;
    }

    const hasPostgres = database === "postgres";
    const hasSqlite = database === "sqlite";
    const hasDb = hasPostgres || hasSqlite;

    if (modality === "fullstack") {
      const frontendDir = path.join(projectDir, "frontend");
      const backendDir = path.join(projectDir, "backend");

      if (!hasDb) {
        verifyNoDatabaseArtifacts(backendDir);
      }

      // Frontend: install, audit, build, lint
      run("npm", ["install"], frontendDir);
      run("npm", ["audit", "--audit-level=moderate"], frontendDir);
      run("npm", ["run", "build"], frontendDir);
      run("npm", ["run", "lint"], frontendDir);

      // Backend: install, audit, build (si TS), lint, typecheck (si TS), test
      run("npm", ["install"], backendDir);
      run("npm", ["audit", "--audit-level=moderate"], backendDir);
      if (language === "ts") {
        run("npm", ["run", "build"], backendDir);
        run("npm", ["run", "typecheck"], backendDir);
      }
      run("npm", ["run", "lint"], backendDir);

      if (hasPostgres) {
        await verifyDatabaseIntegration(backendDir, language, pgContext, label);
      } else if (hasSqlite) {
        await verifySqliteIntegration(backendDir, language);
      } else {
        run("npm", ["run", "test"], backendDir);
      }

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

        const backend = await startBackendServer(backendDir, entryPoint);
        backendChild = backend.child;

        const vite = await startViteServer(frontendDir, backend.port, backend);
        viteChild = vite.child;

        console.log(`Vite escuchando en puerto ${vite.port}. Verificando GET /api/health...`);
        const res = await fetch(`http://127.0.0.1:${vite.port}/api/health`);
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
      } finally {
        if (createdEnv) {
          fs.rmSync(envFile, { force: true });
        }
        console.log("Cerrando servidores Vite y backend...");
        await stopProcess(viteChild);
        await stopProcess(backendChild);
      }

      if (i18n) {
        await verifyI18n(frontendDir, language);
      }
    } else {
      if (modality === "backend" && !hasDb) {
        verifyNoDatabaseArtifacts(projectDir);
      }

      run("npm", ["install"], projectDir);
      run("npm", ["audit", "--audit-level=moderate"], projectDir);
      if (modality === "frontend" || language === "ts") {
        run("npm", ["run", "build"], projectDir);
      }
      run("npm", ["run", "lint"], projectDir);

      if (modality === "frontend" && i18n) {
        await verifyI18n(projectDir, language);
      }

      if (modality === "backend") {
        if (language === "ts") {
          run("npm", ["run", "typecheck"], projectDir);
        }

        if (hasPostgres) {
          await verifyDatabaseIntegration(projectDir, language, pgContext, label);
        } else if (hasSqlite) {
          await verifySqliteIntegration(projectDir, language);
        } else {
          run("npm", ["run", "test"], projectDir);
        }

        const entryPoint =
          language === "ts" ? path.join("dist", "index.js") : path.join("src", "index.js");
        await checkBackendServer(projectDir, entryPoint);
        if (apiDocs) {
          await checkBackendDocs(projectDir, entryPoint);
        }
      }
    }

    if (hasPostgres && !pgContext.available) {
      console.log(`\n⚠ ${label}: NO VERIFICADO: PostgreSQL (código y build verificados sin BD)`);
    } else {
      console.log(`\n✔ ${label} verificado correctamente`);
    }
  } finally {
    console.log(`\nLimpiando ${tmpBase} …`);
    fs.rmSync(tmpBase, { recursive: true, force: true });
  }
}

/** Verifica integración con PostgreSQL: schema, db:generate, db:migrate, existencia de tabla y tests. */
async function verifyDatabaseIntegration(backendDir, language, pgContext, variantLabel) {
  // 0. Comprobar auditoría de seguridad de dependencias (falla si hay avisos >= moderate)
  run("npm", ["audit", "--audit-level=moderate"], backendDir);

  if (!pgContext.available || !pgContext.databaseUrl) {
    console.log("\n========================================================");
    console.log("NO VERIFICADO: PostgreSQL (Docker no disponible ni VERIFY_DATABASE_URL)");
    console.log("========================================================");
    run("npm", ["run", "test"], backendDir);
    return;
  }

  // Derivar una base de datos propia para esta variante (aislamiento entre variantes)
  let databaseUrl = pgContext.databaseUrl;
  if (pgContext.containerName && pgContext.user && pgContext.pass && pgContext.port) {
    // Nombre seguro para la base de datos: solo letras, dígitos y guiones bajos
    const dbName = `brixa_${variantLabel.replace(/[^a-z0-9]/gi, "_").toLowerCase()}`;
    console.log(`\nCreando base de datos aislada '${dbName}' para variante ${variantLabel}...`);
    execFileSync(
      "docker",
      ["exec", pgContext.containerName, "createdb", "-U", pgContext.user, dbName],
      { stdio: "inherit" },
    );
    databaseUrl = `postgresql://${pgContext.user}:${pgContext.pass}@127.0.0.1:${pgContext.port}/${dbName}`;
  }

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

  // 3. Aplicar migraciones con DATABASE_URL
  run("npm", ["run", "db:migrate"], backendDir, { DATABASE_URL: databaseUrl });

  // 4. Comprobar que la tabla existe en la base de datos
  const checkScript = `
import pg from "pg";
const { Client } = pg;
const client = new Client({ connectionString: process.env.DATABASE_URL });
await client.connect();
const res = await client.query("SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'test_items'");
if (res.rows.length === 0) {
  throw new Error("La tabla 'test_items' no existe en la base de datos tras ejecutar migraciones.");
}
console.log("✔ Tabla 'test_items' encontrada en PostgreSQL.");
await client.end();
`;
  const checkPath = path.join(backendDir, "verify-table.mjs");
  fs.writeFileSync(checkPath, checkScript, "utf-8");
  try {
    run("node", ["verify-table.mjs"], backendDir, { DATABASE_URL: databaseUrl });
  } finally {
    fs.rmSync(checkPath, { force: true });
  }

  // 5. Ejecutar tests con DATABASE_URL definida
  run("npm", ["run", "test"], backendDir, { DATABASE_URL: databaseUrl });
}

/** Verifica integración con SQLite: schema, db:generate, db:migrate (incluso con data/ borrada), existencia de tabla y tests. */
async function verifySqliteIntegration(backendDir, language) {
  // 0. Comprobar auditoría de seguridad de dependencias (falla si hay avisos >= moderate)
  run("npm", ["audit", "--audit-level=moderate"], backendDir);

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
  run("npm", ["run", "test"], backendDir, { DATABASE_URL: databaseUrl });
}

// ---------------------------------------------------------------------------
// Script principal
// ---------------------------------------------------------------------------

const VARIANTS = [
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

async function main() {
  const scope = process.env.VERIFY_SCOPE || "full";
  if (scope !== "portable" && scope !== "full") {
    console.error(`VERIFY_SCOPE inválido: '${scope}'. Valores permitidos: 'portable' o 'full'.`);
    process.exit(1);
  }

  const filterArgs = process.argv.slice(2);
  let variantsToRun =
    filterArgs.length > 0
      ? VARIANTS.filter((v) => filterArgs.includes(getVariantLabel(v)))
      : VARIANTS;

  if (scope === "portable") {
    variantsToRun = variantsToRun.filter((v) => !v.docker && v.database !== "postgres");
  }

  if (variantsToRun.length === 0) {
    console.error(
      filterArgs.length > 0
        ? `Ninguna variante coincide con: ${filterArgs.join(", ")} (ámbito: ${scope})`
        : `Ninguna variante coincide con los criterios (ámbito: ${scope})`,
    );
    process.exit(1);
  }

  const total = variantsToRun.length + 2; // 1 build + N variantes + 1 resumen
  console.log(`=== 1/${total}  npm run build ===`);
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
  const needsPostgres = variantsToRun.some((v) => v.database === "postgres" && !v.docker);
  const pgContext = needsPostgres
    ? await setupPostgres()
    : { databaseUrl: null, stop: async () => {}, available: true };

  try {
    for (let i = 0; i < variantsToRun.length; i++) {
      await verifyVariant(variantsToRun[i], i + 2, total, pgContext);
    }
  } finally {
    await pgContext.stop();
  }

  if (!pgContext.available) {
    console.log(
      `\n=== ${total}/${total}  ⚠ verify:generated completado con advertencias (PostgreSQL: NO VERIFICADO) ===`,
    );
  } else {
    console.log(`\n=== ${total}/${total}  ✔ verify:generated completado con éxito ===`);
  }
}

const isDirectRun =
  process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1]);

if (isDirectRun) {
  main().catch((err) => {
    console.error("\n✖ verify:generated falló:", err.message ?? err);
    process.exit(1);
  });
}
