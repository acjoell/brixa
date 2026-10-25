#!/usr/bin/env node
/**
 * Foundry — verify:generated
 *
 * Verifica de forma reproducible que los proyectos generados se instalan,
 * compilan y pasan el lint correctamente.
 *
 * Pasos:
 *   1. npm run build (Foundry CLI)
 *   2. Para cada variante soportada (frontend+ts, frontend+js, backend+ts, backend+js, fullstack+ts, fullstack+js):
 *      a. Genera el proyecto en un directorio temporal
 *      b. npm install, npm run build, npm run lint
 *      c. Limpia el directorio temporal (incluso si hay error)
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

/** Ejecuta un comando sincrónico e imprime la salida heredada. */
function run(cmd, args, cwd) {
  console.log(`\n$ ${cmd} ${args.join(" ")}  (cwd: ${cwd})`);
  execFileSync(cmd, args, { cwd, stdio: "inherit" });
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
// Función pública de generación: reutilizable y testable en aislamiento
// ---------------------------------------------------------------------------

/**
 * Genera un proyecto en `outputDir` usando el CLI compilado.
 * Requiere que `dist/` ya exista (ejecutar npm run build antes).
 *
 * @param {string} modality - Modalidad del proyecto.
 * @param {string} language - Lenguaje del proyecto ("ts" | "js").
 * @param {string} outputDir - Ruta absoluta del directorio de destino.
 */
export async function generateProject(modality, language, outputDir) {
  // Importamos generate() del CLI compilado para no depender del proceso de prompts.
  const distGenerate = path.join(root, "dist", "generator", "generate.js");
  const { generate } = await import(distGenerate);

  const result = await generate({ modality, language, outputDir });

  if (!result.ok) {
    throw new Error(`generate() falló: ${JSON.stringify(result.error)}`);
  }
}

// ---------------------------------------------------------------------------
// Verificación de una variante
// ---------------------------------------------------------------------------

/**
 * Genera y verifica una variante concreta en un directorio temporal aislado.
 *
 * @param {string} modality
 * @param {string} language
 * @param {number} step - Número de paso para mostrar en los logs.
 * @param {number} total - Total de variantes.
 */
async function verifyVariant(modality, language, step, total) {
  const label = `${modality}+${language}`;
  console.log(`\n=== ${step}/${total}  Generando proyecto ${label} ===`);

  const tmpBase = fs.mkdtempSync(path.join(os.tmpdir(), `foundry-verify-${label}-`));
  const projectDir = path.join(tmpBase, "test-project");

  try {
    await generateProject(modality, language, projectDir);
    console.log(`Proyecto generado en: ${projectDir}`);

    if (modality === "fullstack") {
      const frontendDir = path.join(projectDir, "frontend");
      const backendDir = path.join(projectDir, "backend");

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
      run("npm", ["run", "test"], backendDir);

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
      run("npm", ["install"], projectDir);
      if (modality === "frontend" || language === "ts") {
        run("npm", ["run", "build"], projectDir);
      }
      run("npm", ["run", "lint"], projectDir);

      if (modality === "backend") {
        if (language === "ts") {
          run("npm", ["run", "typecheck"], projectDir);
        }
        run("npm", ["run", "test"], projectDir);
        const entryPoint = language === "ts" ? "dist/index.js" : "src/index.js";
        await checkBackendServer(projectDir, entryPoint);
      }
    }

    console.log(`\n✔ ${label} verificado correctamente`);
  } finally {
    console.log(`\nLimpiando ${tmpBase} …`);
    fs.rmSync(tmpBase, { recursive: true, force: true });
  }
}

// ---------------------------------------------------------------------------
// Script principal
// ---------------------------------------------------------------------------

const VARIANTS = [
  { modality: "frontend", language: "ts" },
  { modality: "frontend", language: "js" },
  { modality: "backend", language: "ts" },
  { modality: "backend", language: "js" },
  { modality: "fullstack", language: "ts" },
  { modality: "fullstack", language: "js" },
];

async function main() {
  // 1. Build Foundry (una sola vez para todas las variantes)
  const total = VARIANTS.length + 2; // 1 build + N variantes + 1 resumen
  console.log(`=== 1/${total}  npm run build ===`);
  run("npm", ["run", "build"], root);

  // 2. Verificar cada variante soportada
  for (let i = 0; i < VARIANTS.length; i++) {
    const { modality, language } = VARIANTS[i];
    await verifyVariant(modality, language, i + 2, total);
  }

  console.log(`\n=== ${total}/${total}  ✔ verify:generated completado con éxito ===`);
}

main().catch((err) => {
  console.error("\n✖ verify:generated falló:", err.message ?? err);
  process.exit(1);
});
