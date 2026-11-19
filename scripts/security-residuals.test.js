import { afterEach, expect, it, vi } from "vitest";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { generate } from "../src/generator/generate.ts";
import { VERIFIED_VARIANTS } from "../src/verified-variants.ts";
import { VARIANTS } from "./verify-generated.js";
import {
  SECURITY_PROJECTIONS,
  SECURITY_VARIANTS,
  securityVariantsForScope,
} from "./verify-security.js";
import { verificationReport, runReportedVerification } from "./verification-report.js";

afterEach(() => vi.restoreAllMocks());

it("calcula los 76 pares válidos y los tres huecos documentados en D-053", () => {
  const report = verificationReport(VERIFIED_VARIANTS, VARIANTS, []);
  expect(report.success).toBe(false);
  expect(report.coverage).toMatchObject({
    validCombinations: 76,
    validPairs: 76,
    declaredPairs: 73,
    executedVariants: 0,
  });
  expect(new Set(report.coverage.missingDeclaredPairs.map(JSON.stringify))).toEqual(
    new Set(
      [
        [
          ["database", "postgres"],
          ["i18n", true],
        ],
        [
          ["docker", true],
          ["i18n", true],
        ],
        [
          ["apiDocs", true],
          ["i18n", true],
        ],
      ].map(JSON.stringify),
    ),
  );
});

it("distingue ejecución, diferencias JS/TS y parejas incompletas en una partición", () => {
  const ts = { modality: "backend", language: "ts" };
  const js = { modality: "backend", language: "js" };
  const report = verificationReport(
    [ts, js],
    [ts],
    [{ variant: ts, status: "PASSED" }],
    "functional",
  );
  expect(report.success).toBe(true);
  expect(report.mode).toBe("functional");
  expect(report.languagePairs[0]).toMatchObject({
    ts: "PASSED",
    js: "NOT_RUN",
    complete: false,
    different: true,
    failed: false,
  });
  expect(
    verificationReport(
      [ts, js],
      [ts, js],
      [
        { variant: ts, status: "PASSED" },
        { variant: js, status: "FAILED" },
      ],
    ).languagePairs[0].failed,
  ).toBe(true);
  expect(
    verificationReport([ts], [ts], [{ variant: ts, status: "PASSED" }]).languagePairs[0].js,
  ).toBe("UNDECLARED");
});

it.each(["FAILED", "NOT_VERIFIED"])(
  "conserva el fallo global y reporta lo no ejecutado tras %s",
  async (status) => {
    const log = vi.spyOn(console, "log").mockImplementation(() => {});
    vi.spyOn(console, "table").mockImplementation(() => {});
    const variants = VARIANTS.slice(0, 2);
    const verify = vi.fn(async () => {
      if (status === "FAILED") throw new Error("failure");
      return status;
    });
    await expect(runReportedVerification(variants, variants, verify)).rejects.toThrow();
    expect(verify).toHaveBeenCalledTimes(1);
    const report = JSON.parse(log.mock.calls.at(-1)[0]);
    expect(report.success).toBe(false);
    expect(report.variants.map((v) => v.status)).toEqual([status, "NOT_RUN"]);
  },
);

it("proyecta exactamente SV-1 a SV-7 y filtra portable sin añadir capacidades", () => {
  expect(
    SECURITY_PROJECTIONS.map((v) => [v.modality, v.language, v.database, v.docker ?? false]),
  ).toEqual([
    ["backend", "ts", "postgres", true],
    ["backend", "js", "postgres", false],
    ["backend", "ts", "sqlite", false],
    ["backend", "ts", "sqlite", true],
    ["fullstack", "js", "postgres", false],
    ["fullstack", "ts", "postgres", false],
    ["fullstack", "js", "sqlite", false],
  ]);
  expect(securityVariantsForScope("full")).toEqual(SECURITY_VARIANTS);
  expect(securityVariantsForScope("portable")).toHaveLength(5);
  expect(
    securityVariantsForScope("portable").every((v) => !v.docker && v.database !== "postgres"),
  ).toBe(true);
  expect(() => securityVariantsForScope("unknown")).toThrow();
});

it.each(["ts", "js"])(
  "genera scripts separados y conserva npm test integral en %s",
  async (language) => {
    const temporary = fs.mkdtempSync(path.join(os.tmpdir(), "brixa-test-groups-"));
    try {
      for (const database of ["postgres", "sqlite"]) {
        const outputDir = path.join(temporary, database);
        expect((await generate({ modality: "backend", language, database, outputDir })).ok).toBe(
          true,
        );
        const { scripts } = JSON.parse(
          fs.readFileSync(path.join(outputDir, "package.json"), "utf8"),
        );
        expect(scripts.test).toBe("vitest run");
        expect(scripts["test:unit"]).toBe(`vitest run --exclude tests/db.test.${language}`);
        expect(scripts["test:db"]).toBe(`vitest run tests/db.test.${language}`);
      }
      const fixture = path.join(temporary, "fixture");
      fs.mkdirSync(path.join(fixture, "tests"), { recursive: true });
      fs.writeFileSync(
        path.join(fixture, "vitest.config.mjs"),
        "export default { test: { globals: true } };",
      );
      fs.writeFileSync(
        path.join(fixture, `tests/unit.test.${language}`),
        'it("unit", () => expect(true).toBe(true));',
      );
      fs.writeFileSync(
        path.join(fixture, `tests/db.test.${language}`),
        'it("db", () => expect(true).toBe(true));',
      );
      const cli = path.resolve("node_modules/vitest/vitest.mjs");
      for (const [args, expected] of [
        [["--exclude", `tests/db.test.${language}`], ["unit"]],
        [[`tests/db.test.${language}`], ["db"]],
        [[], ["db", "unit"]],
      ]) {
        execFileSync(
          process.execPath,
          [cli, "run", ...args, "--reporter=json", "--outputFile=report.json"],
          { cwd: fixture, stdio: "pipe", timeout: 10000 },
        );
        const report = JSON.parse(fs.readFileSync(path.join(fixture, "report.json"), "utf8"));
        expect(
          report.testResults.flatMap((s) => s.assertionResults.map((a) => a.title)).sort(),
        ).toEqual(expected);
      }
    } finally {
      fs.rmSync(temporary, { recursive: true, force: true });
    }
  },
  15000,
);
