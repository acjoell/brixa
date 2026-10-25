import { describe, it, expect, vi } from "vitest";
import type { Mock } from "vitest";

vi.mock("./prompts/questions.js", () => ({
  runPrompts: vi.fn(),
}));

vi.mock("./validation/options.js", () => ({
  validateOptionsWithDir: vi.fn(),
  formatValidationError: vi.fn((e: { kind: string }) => `Error: ${e.kind}`),
}));

const { runPrompts } = await import("./prompts/questions.js");
const { validateOptionsWithDir } = await import("./validation/options.js");
const runPromptsMock = runPrompts as Mock;
const validateMock = validateOptionsWithDir as Mock;

const { main } = await import("./index.js");

describe("main", () => {
  it("es una función", () => {
    expect(typeof main).toBe("function");
  });

  it("devuelve 0 cuando el usuario cancela", async () => {
    runPromptsMock.mockResolvedValue(null);
    await expect(main()).resolves.toBe(0);
  });

  it("devuelve 0 con opciones válidas", async () => {
    runPromptsMock.mockResolvedValue({
      modality: "frontend",
      language: "ts",
      outputDir: "./my-app",
    });
    validateMock.mockResolvedValue({
      ok: true,
      value: { modality: "frontend", language: "ts", outputDir: "/abs/my-app" },
    });
    await expect(main()).resolves.toBe(0);
  });

  it("devuelve 1 cuando la validación falla", async () => {
    runPromptsMock.mockResolvedValue({
      modality: "frontend",
      language: "ts",
      outputDir: "/non-empty",
    });
    validateMock.mockResolvedValue({
      ok: false,
      error: { kind: "invalid_target_dir", inner: { kind: "not_empty", resolved: "/non-empty" } },
    });
    await expect(main()).resolves.toBe(1);
  });
});
