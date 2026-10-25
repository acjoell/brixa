#!/usr/bin/env node
/**
 * Foundry — verify:generated
 *
 * Verifica de forma reproducible que el proyecto generado se instala,
 * compila y pasa el lint correctamente.
 *
 * Pasos:
 *   1. npm run build (Foundry CLI)
 *   2. Genera un proyecto frontend+ts en un directorio temporal
 *   3. En el proyecto generado: npm install, npm run build, npm run lint
 *   4. Limpia el directorio temporal siempre (incluso si hay error)
 *
 * No se ejecuta dentro de npm test porque es lento y usa red.
 * process.exit solo se llama aquí (fuera de src/).
 */
import { execFileSync } from "node:child_process";
import fs from "node:fs";
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

// ---------------------------------------------------------------------------
// Función pública de generación: reutilizable y testable en aislamiento
// ---------------------------------------------------------------------------

/**
 * Genera un proyecto frontend+ts en `outputDir` usando el CLI compilado.
 * Requiere que `dist/` ya exista (ejecutar npm run build antes).
 *
 * @param {string} outputDir - Ruta absoluta del directorio de destino.
 */
export async function generateProject(outputDir) {
  // Importamos generate() del CLI compilado para no depender del proceso de prompts.
  const distGenerate = path.join(root, "dist", "generator", "generate.js");
  const { generate } = await import(distGenerate);

  const result = await generate({
    modality: "frontend",
    language: "ts",
    outputDir,
  });

  if (!result.ok) {
    throw new Error(`generate() falló: ${JSON.stringify(result.error)}`);
  }
}

// ---------------------------------------------------------------------------
// Script principal
// ---------------------------------------------------------------------------

async function main() {
  // 1. Build Foundry
  console.log("=== 1/4  npm run build ===");
  run("npm", ["run", "build"], root);

  // 2. Crear directorio temporal y generar proyecto
  console.log("\n=== 2/4  Generando proyecto frontend+ts ===");
  const tmpBase = fs.mkdtempSync(path.join(os.tmpdir(), "foundry-verify-"));
  const projectDir = path.join(tmpBase, "test-project");

  try {
    await generateProject(projectDir);
    console.log(`Proyecto generado en: ${projectDir}`);

    // 3. Verificar el proyecto generado
    console.log("\n=== 3/4  npm install ===");
    run("npm", ["install"], projectDir);

    console.log("\n=== 3/4  npm run build ===");
    run("npm", ["run", "build"], projectDir);

    console.log("\n=== 3/4  npm run lint ===");
    run("npm", ["run", "lint"], projectDir);

    console.log("\n=== 4/4  ✔ verify:generated completado con éxito ===");
  } finally {
    // 4. Limpiar siempre, incluso si hay error
    console.log(`\nLimpiando ${tmpBase} …`);
    fs.rmSync(tmpBase, { recursive: true, force: true });
  }
}

main().catch((err) => {
  console.error("\n✖ verify:generated falló:", err.message ?? err);
  process.exit(1);
});
