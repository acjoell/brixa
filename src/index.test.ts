import { describe, it, expect, vi } from "vitest";
import type { Mock } from "vitest";

vi.mock("./prompts/questions.js", () => ({
  runPrompts: vi.fn(),
}));

const { runPrompts } = await import("./prompts/questions.js");
const runPromptsMock = runPrompts as Mock;

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
    runPromptsMock.mockResolvedValue({ modality: "frontend", language: "ts" });
    await expect(main()).resolves.toBe(0);
  });
});
