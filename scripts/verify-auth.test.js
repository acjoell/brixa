import { execFileSync } from "node:child_process";
import { existsSync } from "node:fs";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { generate } from "../src/generator/generate.ts";
import { executeCommand } from "./mutation-engine.js";
import { AUTH_VARIANTS, runAuthVerification } from "./verify-auth.js";
import {
  startBackendServer,
  startPostgresContainer,
  startViteServer,
  stopProcess,
} from "./verify-generated.js";

vi.mock("node:child_process", () => ({ execFileSync: vi.fn() }));
vi.mock("../src/generator/generate.ts", () => ({ generate: vi.fn() }));
vi.mock("./mutation-engine.js", () => ({ executeCommand: vi.fn() }));
vi.mock("./verify-generated.js", () => ({
  getVariantLabel: (v) => [v.modality, v.language, v.database].join("+"),
  startBackendServer: vi.fn(),
  startPostgresContainer: vi.fn(),
  startViteServer: vi.fn(),
  stopProcess: vi.fn(),
}));

const installed = { exitCode: 0, durationMs: 1 };
let workspaces;
let containers;
let fetchMock;

beforeEach(() => {
  vi.resetAllMocks();
  vi.spyOn(console, "log").mockImplementation(() => {});
  vi.spyOn(console, "error").mockImplementation(() => {});
  vi.spyOn(console, "table").mockImplementation(() => {});
  workspaces = [];
  containers = [];
  vi.mocked(generate).mockImplementation(async ({ outputDir, modality, database }) => {
    if (workspaces.length) expect(existsSync(workspaces.at(-1))).toBe(false);
    workspaces.push(path.dirname(outputDir));
    if (database === "postgres") {
      const backend = modality === "backend" ? outputDir : path.join(outputDir, "backend");
      await mkdir(path.join(backend, "ops"), { recursive: true });
      await writeFile(path.join(backend, "ops", "provision.sql"), "-- fixture");
    }
    return { ok: true };
  });
  vi.mocked(executeCommand).mockResolvedValue(installed);
  vi.mocked(startBackendServer).mockResolvedValue({ child: "backend", port: 4000 });
  vi.mocked(startViteServer).mockResolvedValue({ child: "vite", port: 4001 });
  vi.mocked(startPostgresContainer).mockImplementation(async () => {
    const container = {
      database: "brixa_db",
      containerName: "pg-" + containers.length,
      user: "brixa_test",
      port: 5000 + containers.length,
      stop: vi.fn(),
    };
    containers.push(container);
    return container;
  });
  vi.mocked(execFileSync).mockReturnValue("170004\n");
  fetchMock = vi.fn((url, options) => {
    if (url.endsWith("/health")) return Promise.resolve(globalThis.Response.json({ status: "ok" }));
    if (url.endsWith("/")) return Promise.resolve(new globalThis.Response('<div id="root"></div>'));
    if (url.endsWith("/auth/login")) {
      expect(options).toMatchObject({ method: "POST", body: "{}" });
      return Promise.resolve(
        new globalThis.Response(null, { status: url.includes("/api/") ? 403 : 400 }),
      );
    }
    return Promise.resolve(new globalThis.Response(null, { status: 401 }));
  });
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

it("verifica las cuatro combinaciones, sin solapar recursos ni entregar el propietario al backend", async () => {
  vi.stubEnv("MIGRATION_DATABASE_URL", "owner-from-host");
  vi.stubEnv("POSTGRES_PASSWORD", "password-from-host");
  vi.stubEnv("PGOPTIONS", "options-from-host");
  await runAuthVerification();

  expect(
    generate.mock.calls.map(([options]) =>
      Object.fromEntries(Object.entries(options).filter(([key]) => key !== "outputDir")),
    ),
  ).toEqual(AUTH_VARIANTS);
  expect(AUTH_VARIANTS.map((v) => [v.modality, v.language, v.database, v.authTransport])).toEqual([
    ["backend", "js", "postgres", "bearer"],
    ["backend", "ts", "sqlite", "bearer"],
    ["fullstack", "ts", "sqlite", "cookie"],
    ["fullstack", "js", "postgres", "cookie"],
  ]);
  expect(new Set(workspaces).size).toBe(4);
  expect(workspaces.every((dir) => !existsSync(dir))).toBe(true);
  expect(startPostgresContainer).toHaveBeenCalledTimes(2);
  for (const container of containers) expect(container.stop).toHaveBeenCalledOnce();
  const commands = executeCommand.mock.calls;
  expect(commands.filter(([, args]) => args[0] === "install")).toHaveLength(6);
  expect(commands.filter(([, args]) => args[1] === "build")).toHaveLength(4);
  const migrations = commands.filter(([, args]) => args[1] === "db:migrate");
  expect(migrations).toHaveLength(4);
  expect(migrations[0][3].env.MIGRATION_DATABASE_URL).toMatch(/^postgresql:\/\/table_owner:/);
  expect(migrations[1][3].env.DATABASE_URL).toMatch(/^file:/);
  expect(migrations[1][3].env.MIGRATION_DATABASE_URL).toBeUndefined();
  for (const [, , env] of startBackendServer.mock.calls) {
    expect(env.MIGRATION_DATABASE_URL).toBeUndefined();
    expect(env.POSTGRES_PASSWORD).toBeUndefined();
    expect(env.PGOPTIONS).toBeUndefined();
  }
  const cycles = commands.filter(([cmd]) => cmd === process.execPath);
  expect(cycles.map(([, , , { env }]) => env.AUTH_TEST_TRANSPORT)).toEqual([
    "bearer",
    "bearer",
    "cookie",
    "cookie",
  ]);
  expect(cycles[1][1].slice(0, 2)).toEqual(["--import", "tsx"]);
  expect(fetchMock.mock.calls.filter(([url]) => url.includes("/api/auth/session"))).toHaveLength(2);
  expect(console.table.mock.calls[0][0].map((row) => row.status)).toEqual(Array(4).fill("PASSED"));
});

it("detiene la matriz, limpia los recursos e informa un fallo del contrato sin mostrar su salida", async () => {
  vi.mocked(executeCommand).mockImplementation(async (cmd) =>
    cmd === process.execPath
      ? { exitCode: null, timedOut: true, durationMs: 60_000, stderr: "sensitive-failure" }
      : installed,
  );

  await expect(runAuthVerification()).rejects.toThrow("Ciclo Auth: timeout");
  expect(generate).toHaveBeenCalledOnce();
  expect(stopProcess).toHaveBeenCalledWith("backend");
  expect(containers[0].stop).toHaveBeenCalledOnce();
  expect(existsSync(workspaces[0])).toBe(false);
  expect(console.error).not.toHaveBeenCalled();
  expect(console.table.mock.calls[0][0].map((row) => row.status)).toEqual([
    "FAILED",
    "NOT_RUN",
    "NOT_RUN",
    "NOT_RUN",
  ]);
});

it("falla explícitamente cuando PostgreSQL no está disponible", async () => {
  vi.mocked(startPostgresContainer).mockRejectedValue(new Error("Docker no disponible"));
  await expect(runAuthVerification()).rejects.toThrow("Docker no disponible");
  expect(generate).toHaveBeenCalledOnce();
  expect(startBackendServer).not.toHaveBeenCalled();
  expect(existsSync(workspaces[0])).toBe(false);
});

it("limpia la variante activa si se interrumpe la ejecución", async () => {
  const controller = new globalThis.AbortController();
  vi.mocked(executeCommand).mockImplementation(async (cmd, _args, _cwd, { signal }) => {
    if (cmd === process.execPath) {
      expect(signal).toBe(controller.signal);
      controller.abort(new Error("Verificación interrumpida."));
    }
    return installed;
  });

  await expect(runAuthVerification(controller.signal)).rejects.toThrow(
    "Verificación interrumpida.",
  );
  expect(generate).toHaveBeenCalledOnce();
  expect(containers[0].stop).toHaveBeenCalledOnce();
  expect(existsSync(workspaces[0])).toBe(false);
});
