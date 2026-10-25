#!/usr/bin/env node
/**
 * Foundry — verify:generated
 *
 * Verifica de forma reproducible que los proyectos generados se instalan,
 * compilan y pasan el lint correctamente, incluyendo las variantes con persistencia PostgreSQL.
 *
 * Pasos:
 *   1. npm run build (Foundry CLI)
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
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, "..");

// ---------------------------------------------------------------------------
// Utilidades
// ---------------------------------------------------------------------------

/** Ejecuta un comando sincrónico e imprime la salida heredada sin exponer variables de entorno sensibles. */
function run(cmd, args, cwd, extraEnv = {}) {
  console.log(`\n$ ${cmd} ${args.join(" ")}  (cwd: ${cwd})`);
  execFileSync(cmd, args, { cwd, stdio: "inherit", env: { ...process.env, ...extraEnv } });
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
async function startBackendServer(projectDir, entryPoint = "dist/index.js") {
  console.log(`\nIniciando servidor backend (${entryPoint})...`);
  const child = spawn("node", [entryPoint], {
    cwd: projectDir,
    env: { ...process.env, PORT: "0" },
    stdio: ["ignore", "pipe", "pipe"],
  });

  const port = await new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      reject(new Error("Timeout esperando a que el servidor backend arranque"));
    }, 10000);

    let stdout = "";
    child.stdout.on("data", (chunk) => {
      stdout += chunk.toString();
      const match = stdout.match(/http:\/\/localhost:(\d+)/);
      if (match) {
        clearTimeout(timeout);
        resolve(Number(match[1]));
      }
    });

    child.stderr.on("data", (chunk) => {
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

  return { child, port };
}

/** Arranca el servidor de desarrollo de Vite sin usar npm run, con puerto libre, --strictPort y BACKEND_URL. */
async function startViteServer(frontendDir, backendPort) {
  const vitePort = await getFreePort();
  const viteBin = path.join(frontendDir, "node_modules", "vite", "bin", "vite.js");

  console.log(
    `\nIniciando servidor de desarrollo de Vite en puerto ${vitePort} (BACKEND_URL=http://127.0.0.1:${backendPort})...`,
  );
  const child = spawn("node", [viteBin, "--port", String(vitePort), "--strictPort"], {
    cwd: frontendDir,
    env: { ...process.env, BACKEND_URL: `http://127.0.0.1:${backendPort}` },
    stdio: ["ignore", "pipe", "pipe"],
  });

  await new Promise((resolve, reject) => {
    let resolved = false;
    const timeout = setTimeout(() => {
      if (!resolved) {
        resolved = true;
        reject(new Error("Timeout esperando a que el servidor de Vite arranque"));
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
      if (text.includes("Local:") || text.includes(`:${vitePort}`)) {
        checkReady();
      }
    });

    child.stderr.on("data", (chunk) => {
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
async function checkBackendServer(projectDir, entryPoint = "dist/index.js") {
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
  const containerName = `foundry-pg-verify-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
  const user = "foundry_test";
  const pass = "foundry_pass";
  const db = "foundry_db";

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
    const forbiddenPkgs = ["drizzle-orm", "drizzle-kit", "pg", "@types/pg"];
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

/**
 * Genera un proyecto en `outputDir` usando el CLI compilado.
 * Requiere que `dist/` ya exista (ejecutar npm run build antes).
 */
export async function generateProject(modality, language, outputDir, database = "none") {
  const distGenerate = path.join(root, "dist", "generator", "generate.js");
  const { generate } = await import(distGenerate);

  const result = await generate({ modality, language, database, outputDir });

  if (!result.ok) {
    throw new Error(`generate() falló: ${JSON.stringify(result.error)}`);
  }
}

// ---------------------------------------------------------------------------
// Verificación de una variante
// ---------------------------------------------------------------------------

async function verifyVariant(variant, step, total, pgContext) {
  const { modality, language, database = "none" } = variant;
  const label =
    database !== "none" ? `${modality}+${language}+${database}` : `${modality}+${language}`;
  console.log(`\n=== ${step}/${total}  Generando proyecto ${label} ===`);

  const tmpBase = fs.mkdtempSync(
    path.join(os.tmpdir(), `foundry-verify-${label.replace(/\+/g, "-")}-`),
  );
  const projectDir = path.join(tmpBase, "test-project");

  try {
    await generateProject(modality, language, projectDir, database);
    console.log(`Proyecto generado en: ${projectDir}`);

    const hasDb = database === "postgres";

    if (modality === "fullstack") {
      const frontendDir = path.join(projectDir, "frontend");
      const backendDir = path.join(projectDir, "backend");

      if (!hasDb) {
        verifyNoDatabaseArtifacts(backendDir);
      }

      // Frontend: install, build, lint
      run("npm", ["install"], frontendDir);
      run("npm", ["run", "build"], frontendDir);
      run("npm", ["run", "lint"], frontendDir);

      // Backend: install, build (si TS), lint, typecheck (si TS), test
      run("npm", ["install"], backendDir);
      if (language === "ts") {
        run("npm", ["run", "build"], backendDir);
        run("npm", ["run", "typecheck"], backendDir);
      }
      run("npm", ["run", "lint"], backendDir);

      if (hasDb) {
        await verifyDatabaseIntegration(backendDir, language, pgContext, label);
      } else {
        run("npm", ["run", "test"], backendDir);
      }

      // Verificación de comunicación frontend-backend vía proxy Vite
      const entryPoint = language === "ts" ? "dist/index.js" : "src/index.js";
      let backendChild;
      let viteChild;
      try {
        const backend = await startBackendServer(backendDir, entryPoint);
        backendChild = backend.child;

        const vite = await startViteServer(frontendDir, backend.port);
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
      } finally {
        console.log("Cerrando servidores Vite y backend...");
        await stopProcess(viteChild);
        await stopProcess(backendChild);
      }
    } else {
      if (modality === "backend" && !hasDb) {
        verifyNoDatabaseArtifacts(projectDir);
      }

      run("npm", ["install"], projectDir);
      if (modality === "frontend" || language === "ts") {
        run("npm", ["run", "build"], projectDir);
      }
      run("npm", ["run", "lint"], projectDir);

      if (modality === "backend") {
        if (language === "ts") {
          run("npm", ["run", "typecheck"], projectDir);
        }

        if (hasDb) {
          await verifyDatabaseIntegration(projectDir, language, pgContext, label);
        } else {
          run("npm", ["run", "test"], projectDir);
        }

        const entryPoint = language === "ts" ? "dist/index.js" : "src/index.js";
        await checkBackendServer(projectDir, entryPoint);
      }
    }

    if (hasDb && !pgContext.available) {
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
    const dbName = `foundry_${variantLabel.replace(/[^a-z0-9]/gi, "_").toLowerCase()}`;
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
];

async function main() {
  const total = VARIANTS.length + 2; // 1 build + N variantes + 1 resumen
  console.log(`=== 1/${total}  npm run build ===`);
  run("npm", ["run", "build"], root);

  const pgContext = await setupPostgres();

  try {
    for (let i = 0; i < VARIANTS.length; i++) {
      await verifyVariant(VARIANTS[i], i + 2, total, pgContext);
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

main().catch((err) => {
  console.error("\n✖ verify:generated falló:", err.message ?? err);
  process.exit(1);
});
