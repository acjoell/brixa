import { describe, it, expect } from "vitest";
import { validateOptions, formatValidationError } from "./options.js";

describe("validateOptions", () => {
  it("acepta combinación válida frontend+ts", () => {
    const result = validateOptions({ modality: "frontend", language: "ts" });
    expect(result).toEqual({ ok: true, value: { modality: "frontend", language: "ts" } });
  });

  it("acepta combinación válida backend+js", () => {
    const result = validateOptions({ modality: "backend", language: "js" });
    expect(result).toEqual({ ok: true, value: { modality: "backend", language: "js" } });
  });

  it("acepta combinación válida fullstack+ts", () => {
    const result = validateOptions({ modality: "fullstack", language: "ts" });
    expect(result).toEqual({ ok: true, value: { modality: "fullstack", language: "ts" } });
  });

  it("rechaza modalidad inválida", () => {
    // @ts-expect-error — prueba deliberada con valor inválido.
    const result = validateOptions({ modality: "invalid", language: "ts" });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.kind).toBe("invalid_modality");
    }
  });

  it("rechaza lenguaje inválido", () => {
    // @ts-expect-error — prueba deliberada con valor inválido.
    const result = validateOptions({ modality: "frontend", language: "python" });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.kind).toBe("invalid_language");
    }
  });
});

describe("formatValidationError", () => {
  it("formatea error de modalidad inválida", () => {
    const msg = formatValidationError({ kind: "invalid_modality", received: "xyz" });
    expect(msg).toContain("xyz");
    expect(msg).toContain("frontend");
  });

  it("formatea error de lenguaje inválido", () => {
    const msg = formatValidationError({ kind: "invalid_language", received: "ruby" });
    expect(msg).toContain("ruby");
    expect(msg).toContain("js");
  });
});
