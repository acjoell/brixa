import { describe, it, expect, vi, beforeEach } from "vitest";
import type { Mock } from "vitest";

// Mock de @inquirer/prompts antes de importar el módulo bajo prueba.
vi.mock("@inquirer/prompts", () => ({
  select: vi.fn(),
  input: vi.fn(),
  confirm: vi.fn(),
}));

// Mock de ../types.js no necesario; importamos el módulo real.
const { select, input, confirm } = await import("@inquirer/prompts");
const selectMock = select as Mock;
const inputMock = input as Mock;
const confirmMock = confirm as Mock;

// Importamos después del mock para que el módulo recoja el stub.
const { runPrompts } = await import("./questions.js");

describe("runPrompts", () => {
  beforeEach(() => {
    selectMock.mockReset();
    inputMock.mockReset();
    confirmMock.mockReset();
  });

  it("devuelve las opciones cuando el usuario completa los prompts en frontend sin preguntar BD", async () => {
    selectMock.mockResolvedValueOnce("frontend").mockResolvedValueOnce("ts");
    inputMock.mockResolvedValueOnce("./my-app");

    const result = await runPrompts();

    expect(selectMock).toHaveBeenCalledTimes(2);
    expect(confirmMock).not.toHaveBeenCalled();
    expect(result).toEqual({
      modality: "frontend",
      language: "ts",
      database: "none",
      docker: false,
      apiDocs: false,
      outputDir: "./my-app",
    });
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

  it("solicita base de datos en backend y fullstack, devolviendo la opción seleccionada", async () => {
    selectMock
      .mockResolvedValueOnce("backend")
      .mockResolvedValueOnce("js")
      .mockResolvedValueOnce("postgres");
    confirmMock.mockResolvedValueOnce(false).mockResolvedValueOnce(true);
    inputMock.mockResolvedValueOnce("/home/user/projects/api");

    const result = await runPrompts();

    expect(selectMock).toHaveBeenCalledTimes(3);
    expect(confirmMock).toHaveBeenCalledTimes(2);
    expect(result).toEqual({
      modality: "backend",
      language: "js",
      database: "postgres",
      docker: false,
      apiDocs: true,
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
