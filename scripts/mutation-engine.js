import fs from "node:fs";
import path from "node:path";
import { spawn, execFileSync } from "node:child_process";
import { performance } from "node:perf_hooks";

/**
 * Aplica una mutación sobre un archivo en disco preservando el formato de saltos de línea (LF/CRLF).
 * Exige que el patrón de búsqueda aparezca exactamente una vez.
 *
 * @param {string} filePath - Ruta absoluta al archivo a mutar.
 * @param {string} searchPattern - Patrón a buscar.
 * @param {string} replacement - Texto de reemplazo.
 * @returns {{ originalBuffer: Buffer, mutatedText: string }}
 */
export function applyMutation(filePath, searchPattern, replacement) {
  if (!fs.existsSync(filePath)) {
    const error = new Error(`Archivo objetivo no encontrado: ${filePath}`);
    error.code = "FILE_NOT_FOUND";
    throw error;
  }

  const originalBuffer = fs.readFileSync(filePath);
  const originalText = originalBuffer.toString("utf8");

  // Detectar formato de saltos de línea del archivo
  const usesCrlf = originalText.includes("\r\n");
  const adaptedSearch = usesCrlf
    ? searchPattern.replace(/\r?\n/g, "\r\n")
    : searchPattern.replace(/\r?\n/g, "\n");
  const adaptedReplace = usesCrlf
    ? replacement.replace(/\r?\n/g, "\r\n")
    : replacement.replace(/\r?\n/g, "\n");

  const occurrences = originalText.split(adaptedSearch).length - 1;

  if (occurrences === 0) {
    const error = new Error(`Patrón no encontrado (0 coincidencias) en ${filePath}`);
    error.code = "PATTERN_NOT_FOUND";
    throw error;
  }

  if (occurrences > 1) {
    const error = new Error(
      `Patrón ambiguo (${occurrences} coincidencias) en ${filePath}. Debe aparecer exactamente una vez.`,
    );
    error.code = "DUPLICATE_PATTERN";
    throw error;
  }

  const mutatedText = originalText.replace(adaptedSearch, adaptedReplace);
  // Mismo sistema de archivos: un fallo de escritura no trunca el objetivo.
  const temporaryDir = fs.mkdtempSync(path.join(path.dirname(filePath), ".brixa-mutation-"));
  try {
    const temporaryFile = path.join(temporaryDir, "replacement");
    fs.writeFileSync(temporaryFile, mutatedText, { mode: fs.statSync(filePath).mode });
    fs.renameSync(temporaryFile, filePath);
  } finally {
    fs.rmSync(temporaryDir, { recursive: true, force: true });
  }

  return { originalBuffer, mutatedText };
}

/**
 * Restaura el archivo original byte a byte y verifica la restauración.
 *
 * @param {string} filePath
 * @param {Buffer} originalBuffer
 */
export function restoreFile(filePath, originalBuffer) {
  fs.writeFileSync(filePath, originalBuffer);
  const currentBuffer = fs.readFileSync(filePath);
  if (!originalBuffer.equals(currentBuffer)) {
    throw new Error(`Fallo crítico: el archivo ${filePath} no se restauró idéntico al original.`);
  }
}

/**
 * Ejecuta un comando (e.g. Vitest) capturando salida y asegurando que no queden procesos huérfanos.
 *
 * @param {string} cmd
 * @param {string[]} args
 * @param {string} cwd
 * @param {{ env?: Record<string, string>, timeoutMs?: number, shell?: boolean, signal?: AbortSignal }} options
 * @returns {Promise<{ exitCode: number | null, signal: string | null, stdout: string, stderr: string, timedOut: boolean, durationMs: number }>}
 */
export async function executeCommand(
  cmd,
  args,
  cwd,
  { env = {}, timeoutMs = 60_000, shell = process.platform === "win32", signal } = {},
) {
  signal?.throwIfAborted();
  const isWindows = process.platform === "win32";
  const actualCmd = isWindows && cmd === "npm" ? "npm.cmd" : cmd;
  const childEnv = { ...process.env, ...env };
  delete childEnv.NODE_ENV;

  const startTime = performance.now();
  return new Promise((resolve) => {
    let stdout = "";
    let stderr = "";
    let timedOut = false;
    let spawnError;

    const child = spawn(actualCmd, args, {
      cwd,
      env: childEnv,
      shell,
      detached: !isWindows,
      stdio: ["ignore", "pipe", "pipe"],
    });

    const stop = () => {
      try {
        if (isWindows) {
          execFileSync("taskkill", ["/pid", String(child.pid), "/T", "/F"], { stdio: "ignore" });
        } else {
          process.kill(-child.pid, "SIGKILL");
        }
      } catch {
        // Ignorar si el proceso ya terminó
      }
    };
    signal?.addEventListener("abort", stop, { once: true });
    const timer = setTimeout(() => {
      timedOut = true;
      stop();
    }, timeoutMs);

    child.stdout.on("data", (chunk) => {
      stdout += chunk.toString();
    });

    child.stderr.on("data", (chunk) => {
      stderr += chunk.toString();
    });

    child.on("close", (code, exitSignal) => {
      clearTimeout(timer);
      signal?.removeEventListener("abort", stop);
      const durationMs = performance.now() - startTime;
      resolve({
        exitCode: code,
        signal: exitSignal,
        spawnError,
        stdout,
        stderr,
        timedOut,
        durationMs,
      });
    });

    child.on("error", (err) => {
      spawnError = err;
    });
  });
}

/**
 * Parsea el reporte JSON generado por Vitest.
 *
 * @param {string} reportPath
 * @returns {object | null}
 */
export function parseVitestReport(reportPath) {
  if (!fs.existsSync(reportPath)) {
    return null;
  }
  try {
    const raw = fs.readFileSync(reportPath, "utf8");
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

/** Rechaza reportes parciales, inconsistentes o con suites abortadas. */
export function validateVitestReport(report) {
  if (!report || !Array.isArray(report.testResults) || report.testResults.length === 0) {
    return "Reporte ausente, vacío o inválido";
  }
  if (
    report.testResults.some(
      (suite) =>
        !suite ||
        !Array.isArray(suite.assertionResults) ||
        suite.assertionResults.length === 0 ||
        !["passed", "failed"].includes(suite.status) ||
        suite.message,
    )
  )
    return "Suite abortada o inválida";
  const assertions = report.testResults.flatMap((suite) => suite.assertionResults);
  if (
    assertions.some(
      (test) =>
        !test ||
        typeof test.title !== "string" ||
        !["passed", "failed"].includes(test.status) ||
        !Array.isArray(test.failureMessages) ||
        test.failureMessages.some((message) => typeof message !== "string"),
    )
  ) {
    return "Aserciones incompletas o no ejecutadas";
  }
  const failed = assertions.filter((test) => test.status === "failed").length;
  if (
    report.numTotalTests !== assertions.length ||
    report.numFailedTests !== failed ||
    report.numPassedTests !== assertions.length - failed ||
    report.numPendingTests !== 0 ||
    report.numTodoTests !== 0 ||
    report.success !== (failed === 0) ||
    report.testResults.some(
      (suite) =>
        (suite.status === "failed") !==
        suite.assertionResults.some((test) => test.status === "failed"),
    )
  ) {
    return "Contadores o estados inconsistentes";
  }
  return null;
}

export function validateBaseline(report, execResult) {
  if (
    execResult.timedOut ||
    execResult.signal ||
    execResult.spawnError ||
    execResult.exitCode !== 0
  ) {
    return `Proceso fallido: exit=${execResult.exitCode}, timeout=${execResult.timedOut}, signal=${execResult.signal}`;
  }
  return (
    validateVitestReport(report) ||
    (report.success === true ? null : "La línea base contiene aserciones fallidas")
  );
}

/**
 * Clasifica de forma rigurosa el resultado de una mutación utilizando el reporte estructurado de Vitest.
 *
 * @param {object} params
 * @param {object | null} params.report - Objeto JSON retornado por el reporter de Vitest.
 * @param {object} params.execResult - Resultado de la ejecución del proceso.
 * @param {string} params.expectedTest - Título exacto o nombre completo del test esperado.
 * @param {RegExp | string} params.expectedFailurePattern - Patrón de aserción que debe coincidir en el mensaje de error.
 * @param {string[]} [params.allowedRelatedTests] - Tests adicionales directamente relacionados con el contrato que pueden fallar conjuntamente.
 * @returns {{ status: "MUTATION_DETECTED" | "MUTATION_SURVIVED" | "INFRASTRUCTURE_ERROR", reason: string, details: string }}
 */
export function classifyMutationResult({
  report,
  execResult,
  expectedTest,
  expectedFailurePattern,
  allowedRelatedTests = [],
}) {
  if (execResult.timedOut) {
    return {
      status: "INFRASTRUCTURE_ERROR",
      reason: "TIMEOUT",
      details: `Tiempo límite excedido (${execResult.durationMs.toFixed(0)}ms)`,
    };
  }

  if (execResult.spawnError) {
    return {
      status: "INFRASTRUCTURE_ERROR",
      reason: "SPAWN_ERROR",
      details: `Error al iniciar el proceso: ${execResult.spawnError.message}`,
    };
  }

  if (execResult.signal) {
    return {
      status: "INFRASTRUCTURE_ERROR",
      reason: "PROCESS_SIGNAL",
      details: `Proceso terminado por señal: ${execResult.signal}`,
    };
  }

  // Comprobar reporte válido de Vitest
  if (!report || !Array.isArray(report.testResults)) {
    return {
      status: "INFRASTRUCTURE_ERROR",
      reason: "UNPARSEABLE_REPORT",
      details:
        "Reporte estructurado de Vitest no disponible o no analizable (posible error de compilación o importación).",
    };
  }

  // Detectar suites que fallaron a nivel de compilación o carga de módulo
  const suiteCrashes = report.testResults.filter(
    (tr) =>
      tr && tr.status === "failed" && (!tr.assertionResults || tr.assertionResults.length === 0),
  );
  if (suiteCrashes.length > 0) {
    const msg = suiteCrashes.map((s) => s.message || "Suite crash").join("\n");
    return {
      status: "INFRASTRUCTURE_ERROR",
      reason: "SUITE_CRASH",
      details: `Error de carga/transformación en suite de pruebas: ${msg}`,
    };
  }

  const reportError = validateVitestReport(report);
  if (reportError || ![0, 1].includes(execResult.exitCode) || (execResult.stderr || "").trim()) {
    return {
      status: "INFRASTRUCTURE_ERROR",
      reason: "INVALID_RUN",
      details:
        reportError ||
        `Salida inesperada: exit=${execResult.exitCode}, stderr=${execResult.stderr}`,
    };
  }
  if ((execResult.exitCode === 0) !== report.success) {
    return {
      status: "INFRASTRUCTURE_ERROR",
      reason: "EXIT_REPORT_MISMATCH",
      details: "El código de salida no coincide con el reporte",
    };
  }

  // Recopilar todos los assertions ejecutados
  const allAssertions = report.testResults.flatMap((tr) => tr.assertionResults || []);

  // 1. Localizar el test esperado
  const matchingAssertions = allAssertions.filter(
    (t) => t.title === expectedTest || t.fullName === expectedTest,
  );

  const expectedAssertion = matchingAssertions.length === 1 ? matchingAssertions[0] : null;
  if (!expectedAssertion) {
    return {
      status: "INFRASTRUCTURE_ERROR",
      reason: "EXPECTED_TEST_NOT_RUN",
      details: `El test esperado "${expectedTest}" no se ejecutó en la suite evaluada.`,
    };
  }

  // 2. Si el test esperado pasó, la mutación sobrevivió
  if (expectedAssertion.status === "passed") {
    // Si la suite entera pasó sin error (exit code 0)
    if (execResult.exitCode === 0) {
      return {
        status: "MUTATION_SURVIVED",
        reason: "TEST_PASSED",
        details: `El test esperado "${expectedTest}" pasó a pesar de la mutación. La protección eliminada no fue detectada.`,
      };
    }
  }

  // 3. Si el test esperado falló, comprobar la causa y los tests no relacionados
  if (expectedAssertion.status === "failed") {
    const failureText = (expectedAssertion.failureMessages || []).join("\n");

    const hasOnlyExpectedFailures = (test) =>
      test.failureMessages.length > 0 &&
      test.failureMessages.every((message) => {
        if (expectedFailurePattern instanceof RegExp) {
          expectedFailurePattern.lastIndex = 0;
          return expectedFailurePattern.test(message);
        }
        return message.includes(String(expectedFailurePattern));
      });
    const patternMatched = hasOnlyExpectedFailures(expectedAssertion);

    if (!patternMatched) {
      return {
        status: "INFRASTRUCTURE_ERROR",
        reason: "UNEXPECTED_FAILURE_CAUSE",
        details: `El test esperado falló, pero no coincide con la aserción de seguridad requerida. Detalle: ${failureText}`,
      };
    }

    // Comprobar si fallaron tests ajenos no autorizados
    const otherFailed = allAssertions.filter((t) => {
      if (t.status !== "failed") return false;
      if (t === expectedAssertion) return false;
      const isAllowed = allowedRelatedTests.some(
        (allowed) => t.title === allowed || t.fullName === allowed,
      );
      return !isAllowed;
    });

    if (otherFailed.length > 0) {
      const titles = otherFailed.map((t) => t.title || t.fullName).join(", ");
      return {
        status: "INFRASTRUCTURE_ERROR",
        reason: "UNRELATED_TEST_FAILURES",
        details: `Fallaron tests no relacionados con la mutación: ${titles}`,
      };
    }

    const wrongRelatedCause = allAssertions.some(
      (test) => test.status === "failed" && !hasOnlyExpectedFailures(test),
    );
    if (wrongRelatedCause) {
      return {
        status: "INFRASTRUCTURE_ERROR",
        reason: "UNEXPECTED_FAILURE_CAUSE",
        details: "Un test relacionado falló por una causa diferente",
      };
    }

    // Cumple todas las condiciones para mutación detectada
    return {
      status: "MUTATION_DETECTED",
      reason: "EXPECTED_ASSERTION_FAILED",
      details: `Mutación detectada con éxito: el test esperado "${expectedTest}" falló por la aserción de seguridad correspondiente.`,
    };
  }

  return {
    status: "INFRASTRUCTURE_ERROR",
    reason: "UNKNOWN_TEST_STATE",
    details: `El test esperado "${expectedTest}" terminó en estado desconocido: ${expectedAssertion.status}`,
  };
}

/**
 * Ejecuta una mutación sobre un proyecto temporal, verifica y restaura el archivo.
 *
 * @param {object} params
 * @param {string} params.projectDir - Directorio del proyecto/backend donde se ejecuta la verificación.
 * @param {string} params.targetRelPath - Ruta relativa del archivo a mutar dentro de projectDir.
 * @param {string} params.searchPattern - Patrón a mutar.
 * @param {string} params.replacement - Reemplazo del patrón.
 * @param {string} params.testFile - Archivo de test específico a ejecutar con Vitest.
 * @param {string} params.expectedTest - Test que debe fallar.
 * @param {RegExp | string} params.expectedFailurePattern - Aserción de seguridad requerida.
 * @param {string[]} [params.allowedRelatedTests] - Tests relacionados que pueden fallar también.
 * @param {number} [params.timeoutMs]
 * @returns {Promise<{ status: string, reason: string, details: string, durationMs: number }>}
 */
export async function runMutationCheck({
  projectDir,
  targetRelPath,
  searchPattern,
  replacement,
  testFile,
  expectedTest,
  expectedFailurePattern,
  allowedRelatedTests = [],
  timeoutMs = 60_000,
}) {
  const targetFullPath = path.join(projectDir, targetRelPath);
  let originalBuffer = null;
  let result;
  const reportPath = path.join(projectDir, `.vitest-security-report-${Date.now()}.json`);

  try {
    // El respaldo debe existir incluso si applyMutation falla durante la escritura.
    if (fs.existsSync(targetFullPath)) originalBuffer = fs.readFileSync(targetFullPath);
    applyMutation(targetFullPath, searchPattern, replacement);

    const args = ["run", "test", "--", testFile, "--reporter=json", `--outputFile=${reportPath}`];
    const execResult = await executeCommand("npm", args, projectDir, { timeoutMs });

    const report = parseVitestReport(reportPath);
    const classification = classifyMutationResult({
      report,
      execResult,
      expectedTest,
      expectedFailurePattern,
      allowedRelatedTests,
    });

    result = {
      ...classification,
      durationMs: execResult.durationMs,
    };
  } catch (err) {
    result = {
      status: "INFRASTRUCTURE_ERROR",
      reason: ["FILE_NOT_FOUND", "PATTERN_NOT_FOUND", "DUPLICATE_PATTERN"].includes(err.code)
        ? err.code
        : "MUTATION_IO_ERROR",
      details: err.message,
      durationMs: 0,
    };
  } finally {
    if (originalBuffer !== null) {
      try {
        restoreFile(targetFullPath, originalBuffer);
      } catch (error) {
        result = {
          status: "INFRASTRUCTURE_ERROR",
          reason: "RESTORE_ERROR",
          details: `${error.message}; resultado anterior: ${result.reason}: ${result.details}`,
          durationMs: 0,
        };
      }
    }
    try {
      if (fs.existsSync(reportPath)) {
        fs.unlinkSync(reportPath);
      }
    } catch (error) {
      result = {
        status: "INFRASTRUCTURE_ERROR",
        reason: "CLEANUP_ERROR",
        details: `${error.message}; resultado anterior: ${result.reason}: ${result.details}`,
        durationMs: 0,
      };
    }
  }
  return result;
}
