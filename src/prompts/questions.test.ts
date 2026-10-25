import { describe, it, expect, vi, beforeEach } from "vitest";
import type { Mock } from "vitest";

// Mock de @inquirer/prompts antes de importar el módulo bajo prueba.
vi.mock("@inquirer/prompts", () => ({
  select: vi.fn(),
  input: vi.fn(),
}));

// Mock de ../types.js no necesario; importamos el módulo real.
const { select, input } = await import("@inquirer/prompts");
const selectMock = select as Mock;
const inputMock = input as Mock;

// Importamos después del mock para que el módulo recoja el stub.
const { runPrompts } = await import("./questions.js");

describe("runPrompts", () => {
  beforeEach(() => {
    selectMock.mockReset();
    inputMock.mockReset();
  });

  it("devuelve las opciones cuando el usuario completa los prompts", async () => {
    selectMock.mockResolvedValueOnce("frontend").mockResolvedValueOnce("ts");
    inputMock.mockResolvedValueOnce("./my-app");

    const result = await runPrompts();

    expect(result).toEqual({ modality: "frontend", language: "ts", outputDir: "./my-app" });
  });

  it("devuelve null cuando el usuario cancela con Ctrl+C (ExitPromptError)", async () => {
    const exitError = Object.assign(new Error("cancelado"), { name: "ExitPromptError" });
    selectMock.mockRejectedValueOnce(exitError);

    const result = await runPrompts();

    expect(result).toBeNull();
  });

  it("propaga errores inesperados", async () => {
    const unexpectedError = new Error("fallo inesperado");
    selectMock.mockRejectedValueOnce(unexpectedError);

    await expect(runPrompts()).rejects.toThrow("fallo inesperado");
  });

  it("devuelve la combinación backend+js con ruta absoluta", async () => {
    selectMock.mockResolvedValueOnce("backend").mockResolvedValueOnce("js");
    inputMock.mockResolvedValueOnce("/home/user/projects/api");

    const result = await runPrompts();

    expect(result).toEqual({
      modality: "backend",
      language: "js",
      outputDir: "/home/user/projects/api",
    });
  });

  it("cancela limpio si Ctrl+C ocurre en el tercer prompt (directorio)", async () => {
    const exitError = Object.assign(new Error("cancelado"), { name: "ExitPromptError" });
    selectMock.mockResolvedValueOnce("frontend").mockResolvedValueOnce("ts");
    inputMock.mockRejectedValueOnce(exitError);

    const result = await runPrompts();

    expect(result).toBeNull();
  });
});
