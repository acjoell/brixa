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
    ["backend", "js", "postgres", true, "bearer"],
    ["backend", "ts", "sqlite", true, "cookie"],
    ["fullstack", "ts", "sqlite", true, undefined],
    ["backend", "ts", "sqlite", false, undefined],
  ] as const)(
    "genera %s %s con %s, Auth=%s y transporte %s",
    async (modality, language, database, auth, authTransport) => {
      const directory = await mkdtemp(path.join(tmpdir(), "brixa-cli-auth-"));
      try {
        const outputDir = path.join(directory, "project");
        const raw = { modality, language, database, auth, authTransport, outputDir };
        runPromptsMock.mockResolvedValue(raw);
        await expect(main()).resolves.toBe(0);
        expect(generateMock).toHaveBeenCalledExactlyOnceWith({
          ...raw,
          docker: false,
          apiDocs: false,
          i18n: false,
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
