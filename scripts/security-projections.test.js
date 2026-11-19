import { afterEach, expect, it, vi } from "vitest";
import fs from "node:fs";
import path from "node:path";
import * as generated from "./verify-generated.js";
import * as engine from "./mutation-engine.js";
import { runSecurityVerification, SECURITY_VARIANTS } from "./verify-security.js";

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
});

it.each([false, true])(
  "ejecuta proyecciones y limpia recursos con fallo de mutación=%s",
  async (fail) => {
    vi.stubEnv("VERIFY_SCOPE", "full");
    const log = vi.spyOn(console, "log").mockImplementation(() => {});
    vi.spyOn(console, "error").mockImplementation(() => {});
    vi.spyOn(console, "table").mockImplementation(() => {});
    const stop = vi.fn(async () => {});
    const pgContext = { available: true, databaseUrl: "postgresql://localhost/test", stop };
    vi.spyOn(generated, "setupPostgres").mockResolvedValue(pgContext);
    const directories = [];
    const generate = vi
      .spyOn(generated, "generateProject")
      .mockImplementation(async (modality, _lang, directory) => {
        directories.push(path.dirname(directory));
        fs.mkdirSync(directory, { recursive: true });
        if (modality === "fullstack") {
          fs.mkdirSync(path.join(directory, "backend"));
          fs.mkdirSync(path.join(directory, "frontend"));
        }
      });
    const postgres = vi.spyOn(generated, "verifyDatabaseIntegration").mockResolvedValue();
    const sqlite = vi.spyOn(generated, "verifySqliteIntegration").mockResolvedValue();
    const docker = vi.spyOn(generated, "verifyDockerVariant").mockResolvedValue();
    const command = vi.spyOn(engine, "executeCommand").mockResolvedValue({ exitCode: 0 });
    vi.spyOn(engine, "parseVitestReport").mockReturnValue({ numPassedTests: 46 });
    vi.spyOn(engine, "validateBaseline").mockReturnValue(null);
    const mutate = vi.spyOn(engine, "runMutationCheck").mockResolvedValue({
      status: fail ? "MUTATION_SURVIVED" : "MUTATION_DETECTED",
      durationMs: 1,
    });
    if (fail) {
      await expect(runSecurityVerification()).rejects.toThrow("MUTACIÓN SOBREVIVIENTE");
      const json = log.mock.calls
        .map((c) => c[0])
        .find((s) => typeof s === "string" && s.startsWith('{\n  "mode"'));
      expect(JSON.parse(json).success).toBe(false);
    } else {
      await runSecurityVerification();
      expect(
        generate.mock.calls.map(([modality, language, , database, docker]) => ({
          modality,
          language,
          database,
          docker,
        })),
      ).toEqual(SECURITY_VARIANTS.map((v) => ({ database: "none", docker: false, ...v })));
      expect(postgres).toHaveBeenCalledTimes(4);
      expect(sqlite).toHaveBeenCalledTimes(3);
      expect(docker).toHaveBeenCalledTimes(3);
      expect(docker.mock.calls.every((args) => args[6] === true)).toBe(true);
      expect(mutate).toHaveBeenCalledTimes(30);
      expect(command.mock.calls.filter(([, args]) => args[0] === "install")).toHaveLength(10);
    }
    expect(stop).toHaveBeenCalledTimes(1);
    expect(directories.every((dir) => !fs.existsSync(dir))).toBe(true);
  },
);
