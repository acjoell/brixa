import assert from "node:assert/strict";
import { cp, mkdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { executeCommand } from "./mutation-engine.js";
import { AUTH_VARIANTS, runStep, verifyVariant } from "./verify-auth.js";
import { checkBackendSecurity } from "./fixtures/auth-final/backend.js";

const backendCookie = {
  modality: "backend",
  language: "js",
  database: "sqlite",
  authTransport: "cookie",
  auth: true,
  apiDocs: true,
};

async function audit(directory, signal, productionOnly = false) {
  const result = await executeCommand(
    "npm",
    ["audit", "--audit-level=moderate", "--json", ...(productionOnly ? ["--omit=dev"] : [])],
    directory,
    {
      env: { npm_config_offline: "false", npm_config_fetch_retries: "0" },
      timeoutMs: 60_000,
      signal,
    },
  );
  const report = JSON.parse(result.stdout || "{}");
  assert(report.metadata?.vulnerabilities, "No se obtuvo un informe de npm audit.");
  const { info, low, moderate, high, critical, total } = report.metadata.vulnerabilities;
  assert.equal(result.exitCode, moderate + high + critical > 0 ? 1 : 0);
  console.log(productionOnly ? "Auditoría runtime" : "Auditoría completa", {
    info,
    low,
    moderate,
    high,
    critical,
  });
  if (total) {
    console.table(
      Object.entries(report.vulnerabilities).map(([name, finding]) => ({
        name,
        severity: finding.severity,
        direct: finding.isDirect,
        via: finding.via.map((item) => (typeof item === "string" ? item : item.url)).join(", "),
      })),
    );
  }
  if (total && !productionOnly) await audit(directory, signal, true);
  return result.exitCode === 0;
}

async function checkOptionalDependencies(directory, signal) {
  const omitted = path.join(path.dirname(directory), "without-optional");
  await mkdir(omitted);
  for (const file of ["package.json", "package-lock.json", "src"])
    await cp(path.join(directory, file), path.join(omitted, file), { recursive: true });
  await runStep(
    "Instalación sin opcionales",
    "npm",
    ["ci", "--omit=optional", "--no-audit", "--no-fund"],
    omitted,
    {
      signal,
      timeoutMs: 180_000,
    },
  );
  const options = {
    env: {
      NAPI_RS_NATIVE_LIBRARY_PATH: undefined,
      NAPI_RS_FORCE_WASI: undefined,
      NODE_OPTIONS: undefined,
      PORT: "0",
    },
    shell: false,
    timeoutMs: 10_000,
    signal,
  };
  const detectListen = `data:text/javascript,${encodeURIComponent(`
    import { Server } from "node:net";
    Server.prototype.listen = function () {
      process.exit(97);
    };
  `)}`;
  for (const args of [
    ["--input-type=module", "-e", 'await import("@node-rs/argon2")'],
    ["--import", detectListen, "src/index.js"],
  ]) {
    const result = await executeCommand(process.execPath, args, omitted, options);
    assert.equal(result.exitCode, 1, "El proceso sin binario debe terminar con error.");
    assert(
      /(?:Cannot find|Failed to load) native binding/.test(result.stderr),
      "Falta el diagnóstico del binding nativo.",
    );
    assert.doesNotMatch(result.stdout, /Servidor escuchando/);
  }
  console.log("Sin opcionales: carga nativa y backend rechazados antes de escuchar.");
}

export async function runFinalAuthChecks(mode, signal) {
  if (!["general", "backend", "optional"].includes(mode))
    throw new Error("Indica general, backend u optional.");
  const failures = [];
  const checkInstall = async (directory, { variant, backend, signal }) => {
    const label = [
      variant.modality,
      variant.language,
      variant.database,
      variant.authTransport,
      path.basename(directory),
    ].join("/");
    const check = async (name, operation) => {
      signal?.throwIfAborted();
      try {
        await operation();
      } catch (error) {
        signal?.throwIfAborted();
        console.error(label, name, error.message);
        failures.push(label + " " + name);
      }
    };
    await check("npm audit", async () => {
      console.log(label);
      if (!(await audit(directory, signal))) {
        throw new Error("npm audit no supera el umbral moderate.");
      }
    });
    if (!backend) return;
    await check("HTTP 500/CORS/CSP/redacción", () =>
      runStep(
        "Controles generales",
        "npm",
        ["test", "--", "tests/errors.test", "tests/cors.test", "tests/health.test"],
        directory,
        {
          signal,
          timeoutMs: 60_000,
        },
      ),
    );
  };
  if (mode === "general") {
    // Se auditan las instalaciones y los controles base. El ciclo 4/4 ya tiene evidencia.
    for (const variant of [...AUTH_VARIANTS, backendCookie])
      await verifyVariant(variant, signal, { checkInstall, installOnly: true });
  } else if (mode === "backend") {
    await verifyVariant(backendCookie, signal, {
      checkBackend: (directory, env) => checkBackendSecurity(directory, env, signal),
    });
  } else {
    await verifyVariant(AUTH_VARIANTS[0], signal, {
      installOnly: true,
      checkInstall: (directory) => checkOptionalDependencies(directory, signal),
    });
  }
  if (failures.length) throw new Error("Comprobaciones pendientes: " + failures.join("; "));
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  const controller = new globalThis.AbortController();
  const interrupt = () => controller.abort(new Error("Verificación interrumpida."));
  process.once("SIGINT", interrupt);
  process.once("SIGTERM", interrupt);
  runFinalAuthChecks(process.argv[2], controller.signal)
    .catch((error) => {
      console.error(error.message);
      process.exitCode = 1;
    })
    .finally(() => {
      process.off("SIGINT", interrupt);
      process.off("SIGTERM", interrupt);
    });
}
