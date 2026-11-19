#!/usr/bin/env node
/**
 * Brixa — verify:security
 *
 * Arnés de verificación avanzada de seguridad mediante mutaciones controladas.
 * Comprueba de forma reproducible sobre proyectos generados temporales que
 * las protecciones de seguridad están cubiertas por aserciones capaces de
 * detectar su ausencia.
 *
 * Piloto T-018:
 *   - backend+ts
 *   - backend+js
 *   - fullstack+ts
 */
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { performance } from "node:perf_hooks";
import {
  generateProject,
  getVariantLabel,
  getPortableVariants,
  setupPostgres,
  verifyDatabaseIntegration,
  verifySqliteIntegration,
  verifyDockerVariant,
} from "./verify-generated.js";
import { runReportedVerification } from "./verification-report.js";
import {
  executeCommand,
  runMutationCheck,
  parseVitestReport,
  validateBaseline,
} from "./mutation-engine.js";
import { PILOT_SECURITY_MUTATIONS } from "./security-mutations.js";

const suiteStartTime = performance.now();

function formatDuration(ms) {
  if (ms < 1000) return `${Math.round(ms)}ms`;
  return `${(ms / 1000).toFixed(2)}s`;
}

function getElapsedSuite() {
  return formatDuration(performance.now() - suiteStartTime);
}

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, "..");

export const PILOT_VARIANTS = [
  { modality: "backend", language: "ts" },
  { modality: "backend", language: "js" },
  { modality: "fullstack", language: "ts" },
];

// §6.3: remove only capabilities that do not exist yet (Auth, RBAC, tenancy).
export const SECURITY_PROJECTIONS = [
  { modality: "backend", language: "ts", database: "postgres", docker: true },
  { modality: "backend", language: "js", database: "postgres" },
  { modality: "backend", language: "ts", database: "sqlite" },
  { modality: "backend", language: "ts", database: "sqlite", docker: true },
  { modality: "fullstack", language: "js", database: "postgres" },
  { modality: "fullstack", language: "ts", database: "postgres" },
  { modality: "fullstack", language: "js", database: "sqlite" },
];
export const SECURITY_VARIANTS = [...PILOT_VARIANTS, ...SECURITY_PROJECTIONS];

export function securityVariantsForScope(scope) {
  if (scope === "full") return SECURITY_VARIANTS;
  if (scope === "portable") return getPortableVariants(SECURITY_VARIANTS);
  throw new Error(`VERIFY_SCOPE inválido: ${scope}`);
}

/**
 * Ejecuta un comando sincrónico/asincrónico con control de errores fatal.
 */
async function runStep(label, cmd, args, cwd) {
  console.log(`\n$ ${label} (cwd: ${cwd}) [T+${getElapsedSuite()}]`);
  const start = performance.now();
  const res = await executeCommand(cmd, args, cwd, {
    timeoutMs: args[0] === "install" ? 300_000 : 60_000,
  });
  if (res.exitCode !== 0) {
    console.error(`✖ Falló "${label}" tras ${formatDuration(performance.now() - start)}`);
    if (res.stderr) console.error(res.stderr);
    if (res.stdout) console.error(res.stdout);
    throw new Error(`INFRASTRUCTURE_ERROR: Paso "${label}" falló con código ${res.exitCode}`);
  }
  console.log(`✔ ${label} (${formatDuration(performance.now() - start)})`);
}

/**
 * Verifica una variante del piloto con el catálogo de mutaciones de seguridad.
 */
async function verifySecurityVariant(variant, step, total, pgContext) {
  const { modality, language, database = "none", docker = false } = variant;
  const label = getVariantLabel(variant);
  console.log(
    `\n========================================================\n[${step}/${total}] Verificando seguridad en variante: ${label}\n======================================================== [T+${getElapsedSuite()}]`,
  );
  const variantStart = performance.now();

  const tmpRoot = fs.realpathSync.native(os.tmpdir());
  const tmpBase = fs.mkdtempSync(
    path.join(tmpRoot, `brixa-verify-security-${label.replace(/\+/g, "-")}-`),
  );
  const projectDir = path.join(tmpBase, "test-project");

  try {
    // 1. Generar proyecto
    await generateProject(modality, language, projectDir, database, docker, false, false);
    console.log(`Proyecto generado en: ${projectDir}`);

    // 2. Resolver directorios según modalidad
    let backendDir = projectDir;
    if (modality === "fullstack") {
      backendDir = path.join(projectDir, "backend");
      const frontendDir = path.join(projectDir, "frontend");
      if (!fs.existsSync(backendDir) || !fs.existsSync(frontendDir)) {
        throw new Error(
          `Estructura fullstack inválida: no se encontraron los directorios frontend o backend.`,
        );
      }
      console.log(`Variante fullstack: backend resuelto en ${backendDir}`);
    }

    // 3. Preparación del backend (instalación y comprobaciones estáticas)
    await runStep("npm install (backend)", "npm", ["install", "--no-audit"], backendDir);
    await runStep("npm audit (backend)", "npm", ["audit", "--audit-level=moderate"], backendDir);

    if (language === "ts") {
      await runStep("npm run build (backend)", "npm", ["run", "build"], backendDir);
      await runStep("npm run typecheck (backend)", "npm", ["run", "typecheck"], backendDir);
    }
    await runStep("npm run lint (backend)", "npm", ["run", "lint"], backendDir);

    if (database === "postgres") {
      if (!pgContext.available) throw new Error("PostgreSQL obligatorio no disponible");
      await verifyDatabaseIntegration(backendDir, language, pgContext, label);
    } else if (database === "sqlite") {
      await verifySqliteIntegration(backendDir, language);
    }

    // 4. Verificación de Línea Base sin mutación (debe estar 100% verde)
    console.log(`\nComprobando línea base de tests sin mutación...`);
    const baselineReportPath = path.join(backendDir, `.baseline-report-${Date.now()}.json`);
    const baselineExec = await executeCommand(
      "npm",
      ["run", "test:unit", "--", "--reporter=json", `--outputFile=${baselineReportPath}`],
      backendDir,
    );
    const baselineReport = parseVitestReport(baselineReportPath);
    if (fs.existsSync(baselineReportPath)) fs.unlinkSync(baselineReportPath);
    const baselineError = validateBaseline(baselineReport, baselineExec);
    if (baselineError) {
      console.error(
        JSON.stringify(
          {
            command: "npm run test:unit -- --reporter=json",
            cwd: backendDir,
            reportPath: baselineReportPath,
            ...baselineExec,
            report: baselineReport,
          },
          null,
          2,
        ),
      );
      throw new Error(`INFRASTRUCTURE_ERROR: Línea base inválida en ${label}: ${baselineError}`);
    }
    console.log(
      `✔ Línea base sin mutación 100% verde (${baselineReport.numPassedTests} tests superados).`,
    );

    // 5. Ejecutar catálogo de mutaciones controladas
    console.log(
      `\nEjecutando catálogo de mutaciones controladas (${PILOT_SECURITY_MUTATIONS.length} mutaciones)...`,
    );
    const mutationResults = [];

    for (const mutation of PILOT_SECURITY_MUTATIONS) {
      const relPath = mutation.targetRelPath(language);
      const testFile = mutation.testFile(language);

      console.log(`\n-> Mutación [${mutation.id}]: ${mutation.name}`);
      console.log(`   Archivo objetivo: ${relPath}`);
      console.log(`   Test asociado: ${testFile} -> "${mutation.expectedTest}"`);

      const res = await runMutationCheck({
        projectDir: backendDir,
        targetRelPath: relPath,
        searchPattern: mutation.searchPattern,
        replacement: mutation.replacement,
        testFile,
        expectedTest: mutation.expectedTest,
        expectedFailurePattern: mutation.expectedFailurePattern,
        allowedRelatedTests: mutation.allowedRelatedTests,
      });

      mutationResults.push({ id: mutation.id, name: mutation.name, ...res });

      if (res.status === "MUTATION_DETECTED") {
        console.log(`✔ [DETECTADA] ${res.details} (${formatDuration(res.durationMs)})`);
      } else if (res.status === "MUTATION_SURVIVED") {
        console.error(`✖ [SOBREVIVIENTE] ${res.details}`);
        throw new Error(
          `MUTACIÓN SOBREVIVIENTE en ${label} [${mutation.id}]: el test no detectó la pérdida de protección.`,
        );
      } else {
        console.error(`✖ [ERROR INFRAESTRUCTURA] ${res.reason}: ${res.details}`);
        throw new Error(
          `ERROR DE INFRAESTRUCTURA en ${label} [${mutation.id}] (${res.reason}): ${res.details}`,
        );
      }
    }

    if (docker) {
      await verifyDockerVariant(projectDir, modality, language, database, label, false, true);
    }
    const variantDuration = performance.now() - variantStart;
    console.log(
      `\n✔ Variante ${label} verificada con éxito: todas las mutaciones fueron detectadas (${formatDuration(variantDuration)})`,
    );
    return {
      variant: label,
      durationMs: variantDuration,
      mutations: mutationResults,
    };
  } finally {
    // 6. Limpieza garantizada del directorio temporal de la variante
    fs.rmSync(tmpBase, { recursive: true, force: true });
  }
}

/**
 * Función principal del arnés de verificación de seguridad.
 */
export async function runSecurityVerification() {
  const variants = securityVariantsForScope(process.env.VERIFY_SCOPE || "full");
  console.log("========================================================");
  console.log("Brixa — verify:security (Arnés de Verificación de Seguridad)");
  console.log("========================================================");
  console.log(`Node: ${process.version} | Plataforma: ${process.platform} ${process.arch}`);
  console.log(`Variantes seleccionadas: ${variants.map(getVariantLabel).join(", ")}`);
  console.log(`Mutaciones piloto: ${PILOT_SECURITY_MUTATIONS.map((m) => m.id).join(", ")}`);

  // Verificar siempre las fuentes actuales, aunque exista un dist/ anterior.
  await runStep("npm run build", "npm", ["run", "build"], root);

  const results = [];
  const total = variants.length;
  const pgContext = variants.some((v) => v.database === "postgres")
    ? await setupPostgres()
    : { available: false, stop: async () => {} };
  try {
    await runReportedVerification(SECURITY_VARIANTS, variants, async (variant, index) => {
      results.push(await verifySecurityVariant(variant, index + 1, total, pgContext));
    });
  } finally {
    await pgContext.stop();
  }

  const totalDuration = performance.now() - suiteStartTime;
  console.log("\n========================================================");
  console.log("RESUMEN DE VERIFICACIÓN DE SEGURIDAD");
  console.log("========================================================");
  for (const r of results) {
    console.log(`✔ ${r.variant} (${formatDuration(r.durationMs)}):`);
    for (const m of r.mutations) {
      console.log(`   - [DETECTADA] ${m.id} (${formatDuration(m.durationMs)})`);
    }
  }
  console.log(`\nTiempo total: ${formatDuration(totalDuration)}`);
  console.log("Estado: TODAS LAS MUTACIONES FUERON DETECTADAS EXITOSAMENTE.");
  console.log("========================================================");
}

// Ejecutar automáticamente si se invoca directamente desde CLI
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  runSecurityVerification().catch((err) => {
    console.error(`\n✖ verify:security falló: ${err.message}`);
    process.exit(1);
  });
}
