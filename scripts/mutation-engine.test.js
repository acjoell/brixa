import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { Buffer } from "node:buffer";
import {
  applyMutation,
  restoreFile,
  classifyMutationResult,
  runMutationCheck,
  validateBaseline,
  executeCommand,
} from "./mutation-engine.js";
import { PILOT_VARIANTS } from "./verify-security.js";
import { VERIFIED_SECURITY_VARIANTS } from "../src/verified-variants.ts";
import { PILOT_SECURITY_MUTATIONS } from "./security-mutations.js";

function completeReport(report) {
  const tests = report.testResults.flatMap((suite) => suite.assertionResults);
  const failed = tests.filter((test) => test.status === "failed").length;
  return {
    numTotalTests: tests.length,
    numFailedTests: failed,
    numPassedTests: tests.length - failed,
    numPendingTests: 0,
    numTodoTests: 0,
    success: failed === 0,
    ...report,
  };
}

describe("Motor de Mutaciones (mutation-engine)", () => {
  let tmpDir;
  let testFile;
  const initialContent = `// Archivo de prueba
export function testMe() {
  const status = 500;
  return status;
}
`;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "mutation-engine-test-"));
    testFile = path.join(tmpDir, "sample.js");
    fs.writeFileSync(testFile, initialContent, "utf8");
  });

  afterEach(() => {
    vi.restoreAllMocks();
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it("conserva CRLF y restaura los bytes originales", () => {
    const original = Buffer.from(initialContent.replaceAll("\n", "\r\n"));
    fs.writeFileSync(testFile, original);
    const mutation = applyMutation(testFile, "const status = 500;\n", "const status = 200;\n");
    expect(mutation.mutatedText).toContain("const status = 200;\r\n");
    restoreFile(testFile, mutation.originalBuffer);
    expect(fs.readFileSync(testFile).equals(original)).toBe(true);
  });

  it("mantiene el piloto sincronizado con las variantes declaradas", () => {
    expect(PILOT_VARIANTS).toEqual(VERIFIED_SECURITY_VARIANTS);
  });

  it("un fallo de restauración bloquea el resultado", async () => {
    const write = fs.writeFileSync.bind(fs);
    vi.spyOn(fs, "writeFileSync").mockImplementation((file, ...args) => {
      if (file === testFile) throw new Error("restore denied");
      return write(file, ...args);
    });
    const result = await runMutationCheck({
      projectDir: tmpDir,
      targetRelPath: "sample.js",
      searchPattern: "const status = 500;",
      replacement: "const status = 200;",
      testFile: "sample.test.js",
      expectedTest: "security",
      expectedFailurePattern: /500/,
    });
    expect(result.status).toBe("INFRASTRUCTURE_ERROR");
    expect(result.reason).toBe("RESTORE_ERROR");
  });

  it("los patrones del catálogo exigen las aserciones concretas", () => {
    const failures = [
      "AssertionError: expected 200 to be 500",
      "AssertionError: expected 'null' to be null",
      "AssertionError: expected null to be 'default-src \\'none\\';base-uri \\'none\\'",
    ];
    PILOT_SECURITY_MUTATIONS.forEach((mutation, index) => {
      expect(mutation.expectedFailurePattern.test(failures[index])).toBe(true);
      expect(
        mutation.expectedFailurePattern.test("TypeError: 500 null content-security-policy"),
      ).toBe(false);
    });
  });

  const failedReport = () =>
    completeReport({
      testResults: [
        {
          status: "failed",
          assertionResults: [
            {
              title: "security",
              status: "failed",
              failureMessages: ["AssertionError: expected 200 to be 500"],
            },
          ],
        },
      ],
    });
  const classify = (report, execResult = { exitCode: 1, stderr: "" }) =>
    classifyMutationResult({
      report,
      execResult,
      expectedTest: "security",
      expectedFailurePattern: /AssertionError: expected 200 to be 500/,
    });

  it.each([false, true])("rechaza errores adicionales en test relacionado=%s", (related) => {
    const report = failedReport();
    const assertion = report.testResults[0].assertionResults[0];
    if (related) {
      report.testResults[0].assertionResults.push({
        ...assertion,
        title: "related",
        failureMessages: [...assertion.failureMessages, "TypeError: cleanup failed"],
      });
      report.numTotalTests++;
      report.numFailedTests++;
    } else {
      assertion.failureMessages.push("TypeError: cleanup failed");
    }
    const result = classifyMutationResult({
      report,
      execResult: { exitCode: 1 },
      expectedTest: "security",
      expectedFailurePattern: /AssertionError: expected 200 to be 500/,
      allowedRelatedTests: ["related"],
    });
    expect(result.status).toBe("INFRASTRUCTURE_ERROR");
    expect(result.reason).toBe("UNEXPECTED_FAILURE_CAUSE");
  });

  it("exige mensajes de fallo y permite varias aserciones de la causa esperada", () => {
    const report = failedReport();
    const messages = report.testResults[0].assertionResults[0].failureMessages;
    messages.push(messages[0]);
    expect(classify(report).status).toBe("MUTATION_DETECTED");
    messages.length = 0;
    expect(classify(report).status).toBe("INFRASTRUCTURE_ERROR");
  });

  it.each(["SIGKILL", "SIGTERM"])("rechaza %s aunque el reporte parezca válido", (signal) => {
    const execution = { exitCode: null, signal, timedOut: false, stderr: "" };
    expect(classify(failedReport(), execution).reason).toBe("PROCESS_SIGNAL");
    expect(validateBaseline(failedReport(), execution)).toBeTruthy();
  });

  it.skipIf(process.platform === "win32")(
    "conserva SIGKILL y el código null del proceso real",
    async () => {
      const result = await executeCommand(
        process.execPath,
        ["-e", 'process.kill(process.pid, "SIGKILL")'],
        tmpDir,
      );
      expect(result.exitCode).toBeNull();
      expect(result.signal).toBe("SIGKILL");
      expect(result.timedOut).toBe(false);
      expect(result.spawnError).toBeUndefined();
      expect(classify(failedReport(), result).reason).toBe("PROCESS_SIGNAL");
    },
  );

  it.each([false, true])("escritura parcial con restauración bloqueada=%s", async (denyRestore) => {
    const write = fs.writeFileSync.bind(fs);
    vi.spyOn(fs, "writeFileSync").mockImplementation((file, ...args) => {
      if (String(file).endsWith(`${path.sep}replacement`)) {
        write(file, "contenido parcial");
        // Incluso ante un objetivo dañado, el respaldo del llamador debe existir.
        write(testFile, "objetivo truncado");
        throw new Error("ENOSPC: partial write");
      }
      if (file === testFile && denyRestore) throw new Error("restore denied");
      return write(file, ...args);
    });
    const result = await runMutationCheck({
      projectDir: tmpDir,
      targetRelPath: "sample.js",
      searchPattern: "const status = 500;",
      replacement: "const status = 200;",
      testFile: "sample.test.js",
      expectedTest: "security",
      expectedFailurePattern: /500/,
    });
    expect(result.status).toBe("INFRASTRUCTURE_ERROR");
    expect(result.reason).toBe(denyRestore ? "RESTORE_ERROR" : "MUTATION_IO_ERROR");
    if (denyRestore) {
      expect(result.details).toContain("restore denied");
      expect(result.details).toContain("ENOSPC");
    } else {
      expect(fs.readFileSync(testFile, "utf8")).toBe(initialContent);
    }
    expect(fs.readdirSync(tmpDir)).toEqual(["sample.js"]);
  });

  it("un fallo de reemplazo atómico conserva el archivo y limpia el temporal", () => {
    vi.spyOn(fs, "renameSync").mockImplementation(() => {
      throw new Error("rename denied");
    });
    expect(() => applyMutation(testFile, "500", "200")).toThrow("rename denied");
    expect(fs.readFileSync(testFile, "utf8")).toBe(initialContent);
    expect(fs.readdirSync(tmpDir)).toEqual(["sample.js"]);
  });

  it.each([
    [
      "contador ausente",
      (r) => {
        delete r.numTotalTests;
      },
    ],
    [
      "contador inconsistente",
      (r) => {
        r.numFailedTests = 0;
      },
    ],
    [
      "success inconsistente",
      (r) => {
        r.success = true;
      },
    ],
    [
      "test omitido",
      (r) => {
        r.testResults[0].assertionResults[0].status = "skipped";
      },
    ],
    [
      "hook fallido",
      (r) => {
        r.testResults[0].message = "beforeAll failed";
      },
    ],
    [
      "suite malformada",
      (r) => {
        r.testResults[0] = null;
      },
    ],
  ])("rechaza reporte inválido: %s", (_name, alter) => {
    const report = failedReport();
    alter(report);
    expect(classify(report).status).toBe("INFRASTRUCTURE_ERROR");
    expect(validateBaseline(report, { exitCode: 0 })).toBeTruthy();
  });

  it.each([0, 2, null])("rechaza fallo esperado con exit inesperado %s", (exitCode) => {
    expect(classify(failedReport(), { exitCode }).status).toBe("INFRASTRUCTURE_ERROR");
  });

  it("rechaza stderr adicional y títulos ambiguos", () => {
    expect(classify(failedReport(), { exitCode: 1, stderr: "Unhandled error" }).status).toBe(
      "INFRASTRUCTURE_ERROR",
    );
    const report = failedReport();
    report.testResults[0].assertionResults.push(report.testResults[0].assertionResults[0]);
    expect(classify(completeReport(report)).status).toBe("INFRASTRUCTURE_ERROR");
  });

  it("clasifica errores reales al iniciar procesos y timeouts", async () => {
    // En Windows, un comando inexistente falla dentro del shell que sí arrancó.
    // Un cwd inexistente impide crear el proceso, incluso cuando se usa shell.
    const missing = await executeCommand(
      process.execPath,
      ["--version"],
      path.join(tmpDir, "missing-cwd"),
    );
    expect(missing.spawnError?.code).toBe("ENOENT");
    expect(missing.timedOut).toBe(false);
    expect(classify(null, missing).reason).toBe("SPAWN_ERROR");
    const readyFile = path.join(tmpDir, "child-ready");
    try {
      const running = executeCommand(
        process.execPath,
        [
          "-e",
          `require('node:fs').writeFileSync(${JSON.stringify(readyFile)}, 'ready'); setInterval(() => {}, 1000)`,
        ],
        tmpDir,
        { timeoutMs: 1000 },
      );
      while (!fs.existsSync(readyFile)) {
        await new Promise((resolve) => setTimeout(resolve, 10));
      }
      const timeout = await running;
      expect(fs.readFileSync(readyFile, "utf8")).toBe("ready");
      expect(timeout.timedOut).toBe(true);
      expect(classify(null, timeout).reason).toBe("TIMEOUT");
    } finally {
      fs.rmSync(readyFile, { force: true });
    }
  }, 10_000);

  it.each(["passed", "failed"])("restaura y limpia tras resultado real %s", async (status) => {
    // Proceso local sin red: entrega un reporte estructurado como el de Vitest.
    const report = completeReport({
      testResults: [
        {
          status,
          assertionResults: [
            {
              title: "security",
              status,
              failureMessages:
                status === "failed" ? ["AssertionError: expected 200 to be 500"] : [],
            },
          ],
        },
      ],
    });
    fs.writeFileSync(
      path.join(tmpDir, "package.json"),
      JSON.stringify({
        scripts: { test: "node runner.cjs" },
      }),
    );
    fs.writeFileSync(
      path.join(tmpDir, "runner.cjs"),
      `
      const fs = require('node:fs');
      const reportPath = process.argv.find(arg => arg.startsWith('--outputFile=')).slice(13);
      if (!fs.readFileSync('sample.js', 'utf8').includes('const status = 200;')) process.exit(2);
      fs.writeFileSync(reportPath, JSON.stringify(${JSON.stringify(report)}));
      process.exit(${status === "failed" ? 1 : 0});
    `,
    );
    const result = await runMutationCheck({
      projectDir: tmpDir,
      targetRelPath: "sample.js",
      searchPattern: "const status = 500;",
      replacement: "const status = 200;",
      testFile: "sample.test.js",
      expectedTest: "security",
      expectedFailurePattern: /AssertionError: expected 200 to be 500/,
    });
    expect(result.status).toBe(status === "failed" ? "MUTATION_DETECTED" : "MUTATION_SURVIVED");
    expect(fs.readFileSync(testFile, "utf8")).toBe(initialContent);
    expect(fs.readdirSync(tmpDir).some((name) => name.startsWith(".vitest-security-report-"))).toBe(
      false,
    );
  });

  // 1. Sustitución correcta, exactamente una coincidencia
  it("1. Sustitución correcta: aplica modificación con exactamente una coincidencia", () => {
    const { originalBuffer, mutatedText } = applyMutation(
      testFile,
      "const status = 500;",
      "const status = 200;",
    );

    expect(originalBuffer.toString("utf8")).toBe(initialContent);
    expect(mutatedText).toContain("const status = 200;");
    expect(mutatedText).not.toContain("const status = 500;");

    const onDisk = fs.readFileSync(testFile, "utf8");
    expect(onDisk).toBe(mutatedText);
  });

  // 2. Patrón inexistente (0 coincidencias)
  it("2. Patrón inexistente: arroja error PATTERN_NOT_FOUND", () => {
    expect(() => {
      applyMutation(testFile, "const inexistente = 404;", "const modificado = 200;");
    }).toThrowError(/Patrón no encontrado/);

    try {
      applyMutation(testFile, "const inexistente = 404;", "const modificado = 200;");
    } catch (err) {
      expect(err.code).toBe("PATTERN_NOT_FOUND");
    }
  });

  // 3. Patrón duplicado (>1 coincidencias)
  it("3. Patrón duplicado: arroja error DUPLICATE_PATTERN", () => {
    const duplicateContent = `const status = 500;\nconst status = 500;\n`;
    fs.writeFileSync(testFile, duplicateContent, "utf8");

    expect(() => {
      applyMutation(testFile, "const status = 500;", "const status = 200;");
    }).toThrowError(/Patrón ambiguo/);

    try {
      applyMutation(testFile, "const status = 500;", "const status = 200;");
    } catch (err) {
      expect(err.code).toBe("DUPLICATE_PATTERN");
    }
  });

  // 4. Archivo inexistente
  it("4. Archivo inexistente: arroja error FILE_NOT_FOUND", () => {
    const nonExistent = path.join(tmpDir, "no-such-file.js");
    expect(() => {
      applyMutation(nonExistent, "a", "b");
    }).toThrowError(/Archivo objetivo no encontrado/);

    try {
      applyMutation(nonExistent, "a", "b");
    } catch (err) {
      expect(err.code).toBe("FILE_NOT_FOUND");
    }
  });

  // 5. Mutación sobreviviente (el test pasó a pesar de la mutación)
  it("5. Mutación sobreviviente: clasifica como MUTATION_SURVIVED cuando el test esperado pasa con exit 0", () => {
    const fakeReport = {
      testResults: [
        {
          status: "passed",
          assertionResults: [
            {
              title: "error genérico → 500 sin detalles",
              status: "passed",
              failureMessages: [],
            },
          ],
        },
      ],
    };

    const res = classifyMutationResult({
      report: completeReport(fakeReport),
      execResult: { exitCode: 0, durationMs: 120, timedOut: false },
      expectedTest: "error genérico → 500 sin detalles",
      expectedFailurePattern: /expected 200 to be 500/,
    });

    expect(res.status).toBe("MUTATION_SURVIVED");
    expect(res.reason).toBe("TEST_PASSED");
  });

  // 6. Mutación detectada por la aserción correcta
  it("6. Mutación detectada: clasifica como MUTATION_DETECTED cuando el test esperado falla por la aserción correcta", () => {
    const fakeReport = {
      testResults: [
        {
          status: "failed",
          assertionResults: [
            {
              title: "error genérico → 500 sin detalles",
              status: "failed",
              failureMessages: ["AssertionError: expected 200 to be 500"],
            },
            {
              title: "ZodError interno → 500, no 400",
              status: "failed",
              failureMessages: ["AssertionError: expected 200 to be 500"],
            },
            {
              title: "JSON válido dentro del límite → 200 con el body procesado",
              status: "passed",
              failureMessages: [],
            },
          ],
        },
      ],
    };

    const res = classifyMutationResult({
      report: completeReport(fakeReport),
      execResult: { exitCode: 1, durationMs: 250, timedOut: false },
      expectedTest: "error genérico → 500 sin detalles",
      expectedFailurePattern: /expected 200 to be 500/,
      allowedRelatedTests: ["ZodError interno → 500, no 400"],
    });

    expect(res.status).toBe("MUTATION_DETECTED");
    expect(res.reason).toBe("EXPECTED_ASSERTION_FAILED");
  });

  // 7. Error de sintaxis o importación clasificado como infraestructura
  it("7. Error de sintaxis o importación: clasifica como INFRASTRUCTURE_ERROR (SUITE_CRASH)", () => {
    const fakeReport = {
      testResults: [
        {
          status: "failed",
          message: "TransformError: SyntaxError: Unexpected token",
          assertionResults: [],
        },
      ],
    };

    const res = classifyMutationResult({
      report: completeReport(fakeReport),
      execResult: { exitCode: 1, durationMs: 100, timedOut: false },
      expectedTest: "error genérico → 500 sin detalles",
      expectedFailurePattern: /expected 200 to be 500/,
    });

    expect(res.status).toBe("INFRASTRUCTURE_ERROR");
    expect(res.reason).toBe("SUITE_CRASH");
  });

  // 8. Timeout clasificado como infraestructura
  it("8. Timeout: clasifica como INFRASTRUCTURE_ERROR (TIMEOUT)", () => {
    const res = classifyMutationResult({
      report: null,
      execResult: { exitCode: 124, durationMs: 60000, timedOut: true },
      expectedTest: "error genérico → 500 sin detalles",
      expectedFailurePattern: /expected 200 to be 500/,
    });

    expect(res.status).toBe("INFRASTRUCTURE_ERROR");
    expect(res.reason).toBe("TIMEOUT");
  });

  // 9. Limpieza y restauración tras éxito y tras fallo
  it("9. Limpieza y restauración: restaura byte a byte el archivo original tanto en éxito como en fallo", () => {
    const origBuf = fs.readFileSync(testFile);

    // Mutar
    applyMutation(testFile, "const status = 500;", "const status = 200;");
    expect(fs.readFileSync(testFile, "utf8")).toContain("const status = 200;");

    // Restaurar
    restoreFile(testFile, origBuf);
    const restoredBuf = fs.readFileSync(testFile);
    expect(origBuf.equals(restoredBuf)).toBe(true);
  });

  // 10. Rechazo de variantes desconocidas
  it("10. Rechazo de variantes desconocidas: las variantes piloto admitidas son exactamente 3", () => {
    expect(PILOT_VARIANTS.length).toBe(3);
    const labels = PILOT_VARIANTS.map((v) => `${v.modality}+${v.language}`);
    expect(labels).toEqual(["backend+ts", "backend+js", "fullstack+ts"]);

    const isPilot = (modality, language) =>
      PILOT_VARIANTS.some((v) => v.modality === modality && v.language === language);

    expect(isPilot("backend", "ts")).toBe(true);
    expect(isPilot("backend", "js")).toBe(true);
    expect(isPilot("fullstack", "ts")).toBe(true);
    expect(isPilot("frontend", "ts")).toBe(false);
    expect(isPilot("backend", "ruby")).toBe(false);
  });

  // 11. Ausencia de modificaciones persistentes
  it("11. Ausencia de modificaciones persistentes: runMutationCheck restaura el archivo incluso ante error", async () => {
    const targetRelPath = "sample.js";
    const res = await runMutationCheck({
      projectDir: tmpDir,
      targetRelPath,
      searchPattern: "const status = 500;",
      replacement: "const status = 200;",
      testFile: "sample.test.js",
      expectedTest: "no-tal-test",
      expectedFailurePattern: /nada/,
      timeoutMs: 500,
    });

    // Aunque la prueba falle o reporte error de infraestructura
    expect(res.status).toBe("INFRASTRUCTURE_ERROR");

    // El archivo en disco debe estar idéntico al initialContent original
    const currentOnDisk = fs.readFileSync(testFile, "utf8");
    expect(currentOnDisk).toBe(initialContent);
  });

  // Controles adicionales anti-falsos positivos:
  it("Anti-falso-positivo: test esperado que no se ejecuta → EXPECTED_TEST_NOT_RUN", () => {
    const fakeReport = {
      testResults: [
        {
          status: "passed",
          assertionResults: [
            {
              title: "otro test cualquiera",
              status: "passed",
              failureMessages: [],
            },
          ],
        },
      ],
    };

    const res = classifyMutationResult({
      report: completeReport(fakeReport),
      execResult: { exitCode: 0, durationMs: 100, timedOut: false },
      expectedTest: "test inexistente que debió ejecutarse",
      expectedFailurePattern: /500/,
    });

    expect(res.status).toBe("INFRASTRUCTURE_ERROR");
    expect(res.reason).toBe("EXPECTED_TEST_NOT_RUN");
  });

  it("Anti-falso-positivo: fallos de tests no relacionados → UNRELATED_TEST_FAILURES", () => {
    const fakeReport = {
      testResults: [
        {
          status: "failed",
          assertionResults: [
            {
              title: "error genérico → 500 sin detalles",
              status: "failed",
              failureMessages: ["AssertionError: expected 200 to be 500"],
            },
            {
              title: "test completamente ajeno e inesperado",
              status: "failed",
              failureMessages: ["Error: fallo de conexión a base de datos"],
            },
          ],
        },
      ],
    };

    const res = classifyMutationResult({
      report: completeReport(fakeReport),
      execResult: { exitCode: 1, durationMs: 150, timedOut: false },
      expectedTest: "error genérico → 500 sin detalles",
      expectedFailurePattern: /expected 200 to be 500/,
      allowedRelatedTests: [],
    });

    expect(res.status).toBe("INFRASTRUCTURE_ERROR");
    expect(res.reason).toBe("UNRELATED_TEST_FAILURES");
  });

  it("Anti-falso-positivo: test falla por causa distinta a la esperada → UNEXPECTED_FAILURE_CAUSE", () => {
    const fakeReport = {
      testResults: [
        {
          status: "failed",
          assertionResults: [
            {
              title: "error genérico → 500 sin detalles",
              status: "failed",
              failureMessages: ["TypeError: Cannot read properties of undefined"],
            },
          ],
        },
      ],
    };

    const res = classifyMutationResult({
      report: completeReport(fakeReport),
      execResult: { exitCode: 1, durationMs: 150, timedOut: false },
      expectedTest: "error genérico → 500 sin detalles",
      expectedFailurePattern: /expected 200 to be 500/,
      allowedRelatedTests: [],
    });

    expect(res.status).toBe("INFRASTRUCTURE_ERROR");
    expect(res.reason).toBe("UNEXPECTED_FAILURE_CAUSE");
  });

  it("Anti-falso-positivo: reporte incompleto o nulo → UNPARSEABLE_REPORT", () => {
    const res = classifyMutationResult({
      report: null,
      execResult: { exitCode: 1, durationMs: 100, timedOut: false },
      expectedTest: "error genérico → 500 sin detalles",
      expectedFailurePattern: /500/,
    });

    expect(res.status).toBe("INFRASTRUCTURE_ERROR");
    expect(res.reason).toBe("UNPARSEABLE_REPORT");
  });
});
