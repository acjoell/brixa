import { describe, it, expect, vi, beforeEach } from "vitest";
import type { Mock } from "vitest";

// Mock de @inquirer/prompts antes de importar el módulo bajo prueba.
vi.mock("@inquirer/prompts", () => ({
  select: vi.fn(),
}));

// Mock de ../types.js no necesario; importamos el módulo real.
const { select } = await import("@inquirer/prompts");
const selectMock = select as Mock;

// Importamos después del mock para que el módulo recoja el stub.
const { runPrompts } = await import("./questions.js");

describe("runPrompts", () => {
  beforeEach(() => {
    selectMock.mockReset();
  });

  it("devuelve las opciones cuando el usuario completa los prompts", async () => {
    selectMock.mockResolvedValueOnce("frontend").mockResolvedValueOnce("ts");

    const result = await runPrompts();

    expect(result).toEqual({ modality: "frontend", language: "ts" });
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

  it("devuelve la combinación backend+js correctamente", async () => {
    selectMock.mockResolvedValueOnce("backend").mockResolvedValueOnce("js");

    const result = await runPrompts();

    expect(result).toEqual({ modality: "backend", language: "js" });
  });
});
