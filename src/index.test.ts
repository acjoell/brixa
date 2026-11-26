import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { generate, nextStepsMessage } from "./generator/generate.js";
import { main } from "./index.js";
import { runPrompts } from "./prompts/questions.js";

vi.mock("./prompts/questions.js", () => ({ runPrompts: vi.fn() }));
vi.mock("./generator/generate.js", { spy: true });

const runPromptsMock = vi.mocked(runPrompts);
const generateMock = vi.mocked(generate);

beforeEach(() => vi.clearAllMocks());

describe("main", () => {
  it("devuelve 0 cuando el usuario cancela sin generar archivos", async () => {
    runPromptsMock.mockResolvedValue(null);
    await expect(main()).resolves.toBe(0);
    expect(generateMock).not.toHaveBeenCalled();
  });

  it.each([
    ["backend", "js", "postgres", true, "bearer", undefined],
    ["backend", "ts", "sqlite", true, "cookie", undefined],
    ["fullstack", "ts", "sqlite", true, undefined, undefined],
    ["fullstack", "ts", "sqlite", true, undefined, "public"],
    ["backend", "ts", "sqlite", false, undefined, undefined],
  ] as const)(
    "genera %s %s con %s, Auth=%s, transporte %s y entrada %s",
    async (modality, language, database, auth, authTransport, authAppMode) => {
      const directory = await mkdtemp(path.join(tmpdir(), "brixa-cli-auth-"));
      try {
        const outputDir = path.join(directory, "project");
        const raw = { modality, language, database, auth, authTransport, authAppMode, outputDir };
        runPromptsMock.mockResolvedValue(raw);
        await expect(main()).resolves.toBe(0);
        expect(generateMock).toHaveBeenCalledExactlyOnceWith({
          ...raw,
          docker: false,
          apiDocs: false,
          i18n: false,
          authAppMode: modality === "fullstack" ? (authAppMode ?? "private") : undefined,
        });

        const backend = modality === "fullstack" ? path.join(outputDir, "backend") : outputDir;
        const startup = await readFile(path.join(backend, "src", "index." + language), "utf8");
        if (auth) {
          expect(startup).toContain(`initializeAuthHttp("${authTransport ?? "cookie"}"`);
          expect(vi.mocked(nextStepsMessage).mock.results[0]?.value).toContain(
            "Combinación experimental",
          );
          expect(vi.mocked(nextStepsMessage).mock.results[0]?.value).toContain(
            "README.md generado",
          );
        } else {
          expect(startup).not.toContain("initializeAuthHttp");
        }
      } finally {
        await rm(directory, { recursive: true, force: true });
      }
    },
  );

  it.each(["public", "private"] as const)(
    "aplica la acreditación de Auth UI %s a ambos avisos",
    async (authAppMode) => {
      const directory = await mkdtemp(path.join(tmpdir(), "brixa-cli-auth-ui-"));
      const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
      try {
        runPromptsMock.mockResolvedValue({
          modality: "fullstack",
          language: "js",
          database: "sqlite",
          auth: true,
          authAppMode,
          outputDir: path.join(directory, "project"),
        });
        await expect(main()).resolves.toBe(0);
        const label = `fullstack+js+sqlite+auth+cookie+${authAppMode}`;
        const finalMessage = vi.mocked(nextStepsMessage).mock.results[0]?.value;
        if (authAppMode === "public") {
          expect(warn).not.toHaveBeenCalled();
          expect(finalMessage).not.toContain("experimental");
        } else {
          expect(warn).toHaveBeenCalledWith(expect.stringContaining(`experimental (${label})`));
          expect(finalMessage).toContain(`experimental (${label})`);
        }
      } finally {
        warn.mockRestore();
        await rm(directory, { recursive: true, force: true });
      }
    },
  );

  it("devuelve 1 cuando el directorio no es válido", async () => {
    runPromptsMock.mockResolvedValue({ modality: "frontend", language: "ts", outputDir: "" });
    await expect(main()).resolves.toBe(1);
    expect(generateMock).not.toHaveBeenCalled();
  });

  it("devuelve 1 si fullstack recibe Bearer y no llama al generador", async () => {
    runPromptsMock.mockResolvedValue({
      modality: "fullstack",
      language: "ts",
      database: "sqlite",
      auth: true,
      authTransport: "bearer",
      outputDir: "./my-app",
    });
    await expect(main()).resolves.toBe(1);
    expect(generateMock).not.toHaveBeenCalled();
  });
});
