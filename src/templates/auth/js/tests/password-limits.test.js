import { describe, expect, expectTypeOf, it } from "vitest";
import { isPasswordWithinLimits } from "../src/auth/password-limits.js";

describe("límites de contraseña", () => {
  it("permite que una cadena falle la validación sin excluir su tipo", () => {
    expectTypeOf(isPasswordWithinLimits).not.toExtend();
  });

  it("acepta hasta 128 puntos de código y 512 bytes UTF-8", () => {
    expect(isPasswordWithinLimits("a".repeat(128))).toBe(true);
    expect(isPasswordWithinLimits("🔑".repeat(128))).toBe(true);
  });

  it("rechaza el exceso sin truncar ni normalizar la entrada", () => {
    expect(isPasswordWithinLimits("a".repeat(129))).toBe(false);
    expect(isPasswordWithinLimits("🔑".repeat(128) + "a")).toBe(false);
    expect(isPasswordWithinLimits("e\u0301".repeat(65))).toBe(false);
  });

  it.each(["\uD800", "\uDC00", "\uDC00\uD800", "\uD800x\uDC00", "\uD800\uD800\uDC00"])(
    "rechaza sustitutos UTF-16 aislados o mal emparejados (%#)",
    (value) => {
      expect(isPasswordWithinLimits(value)).toBe(false);
    },
  );

  it("conserva los pares válidos y el carácter de reemplazo literal", () => {
    expect(isPasswordWithinLimits("\uD800\uDC00\uDBFF\uDFFF")).toBe(true);
    expect(isPasswordWithinLimits("\uFFFD")).toBe(true);
  });

  it.each([null, undefined, 123, { password: "texto" }])(
    "rechaza entradas ajenas al tipo string (%j)",
    (value) => {
      expect(isPasswordWithinLimits(value)).toBe(false);
    },
  );
});
