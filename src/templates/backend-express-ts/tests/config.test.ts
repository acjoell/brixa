import { describe, it, expect, vi } from "vitest";
import { parseConfig, strictBooleanSchema, formatConfigError } from "../src/config.js";
import { z } from "zod";

describe("Validación de configuración y ayudas compartidas", () => {
  it('PORT="" usa el valor por defecto (3000) y no 0', () => {
    const config = parseConfig({ PORT: "" });
    expect(config.port).toBe(3000);
  });

  it("PORT ausente usa el valor por defecto (3000)", () => {
    const config = parseConfig({});
    expect(config.port).toBe(3000);
  });

  it("PORT válido se convierte correctamente a entero", () => {
    const config = parseConfig({ PORT: "8080" });
    expect(config.port).toBe(8080);
  });

  it("variable malformada falla sin imprimir el valor recibido en el mensaje", () => {
    const secretValue = "super_secret_payload_123";
    let thrownError: Error | undefined;

    try {
      parseConfig({ PORT: secretValue });
    } catch (err) {
      thrownError = err as Error;
    }

    expect(thrownError).toBeDefined();
    expect(thrownError?.message).toContain("PORT");
    expect(thrownError?.message).not.toContain(secretValue);
  });

  it("parseConfig es pura y no llama a process.exit cuando falla la validación", () => {
    const exitSpy = vi.spyOn(process, "exit").mockImplementation((() => {}) as never);

    try {
      expect(() => parseConfig({ PORT: "invalido" })).toThrow();
      expect(exitSpy).not.toHaveBeenCalled();
    } finally {
      exitSpy.mockRestore();
    }
  });

  it('booleano estricto: "false" es false y no true', () => {
    const parsed = strictBooleanSchema.parse("false");
    expect(parsed).toBe(false);
    expect(parsed).not.toBe(true);
  });

  it('booleano estricto: "true" es true', () => {
    const parsed = strictBooleanSchema.parse("true");
    expect(parsed).toBe(true);
  });

  it("booleano malformado falla sin imprimir el valor recibido", () => {
    const secretValue = "secret_bool_text";
    const result = strictBooleanSchema.safeParse(secretValue);

    expect(result.success).toBe(false);
    if (!result.success) {
      const formatted = formatConfigError("ENABLE_FEATURE", result.error);
      expect(formatted.message).not.toContain(secretValue);
    }
  });

  it("variable requerida ausente falla sin imprimir valores", () => {
    const schema = z.object({
      REQUIRED_VAR: z.string({ message: "Es requerida." }),
    });
    const result = schema.safeParse({});
    expect(result.success).toBe(false);
    if (!result.success) {
      const formatted = formatConfigError("REQUIRED_VAR", result.error);
      expect(formatted.message).toContain("REQUIRED_VAR");
      expect(formatted.message).not.toContain("undefined");
    }
  });
});
