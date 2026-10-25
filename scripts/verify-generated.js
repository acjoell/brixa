#!/usr/bin/env node
/**
 * Foundry — verify:generated
 *
 * Verifica de forma reproducible que los proyectos generados se instalan,
 * compilan y pasan el lint correctamente.
 *
 * Pasos:
 *   1. npm run build (Foundry CLI)
 *   2. Para cada variante soportada (frontend+ts, frontend+js):
 *      a. Genera el proyecto en un directorio temporal
 *      b. npm install, npm run build, npm run lint
 *      c. Limpia el directorio temporal (incluso si hay error)
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

    run("npm", ["install"], projectDir);
    run("npm", ["run", "build"], projectDir);
    run("npm", ["run", "lint"], projectDir);

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
];

async function main() {
  // 1. Build Foundry (una sola vez para todas las variantes)
  console.log("=== 1/4  npm run build ===");
  run("npm", ["run", "build"], root);

  // 2. Verificar cada variante soportada
  const total = VARIANTS.length + 2; // 1 build + N variantes + 1 resumen
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
