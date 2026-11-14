import { describe, it, expect, vi } from "vitest";
import {
  parseConfig,
  strictBooleanSchema,
  formatConfigError,
  corsAllowedOriginsSchema,
} from "../src/config.js";
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
    let thrownError;

    try {
      parseConfig({ PORT: secretValue });
    } catch (err) {
      thrownError = err;
    }

    expect(thrownError).toBeDefined();
    expect(thrownError?.message).toContain("PORT");
    expect(thrownError?.message).not.toContain(secretValue);
  });

  it("parseConfig es pura y no llama a process.exit cuando falla la validación", () => {
    const exitSpy = vi.spyOn(process, "exit").mockImplementation(() => {});

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

  describe("CORS_ALLOWED_ORIGINS", () => {
    it("corsAllowedOriginsSchema valida orígenes directamente", () => {
      expect(corsAllowedOriginsSchema.parse("http://localhost:5173")).toEqual([
        "http://localhost:5173",
      ]);
      expect(corsAllowedOriginsSchema.parse(undefined)).toEqual([]);
    });

    it("ausente o vacía desactiva CORS (devuelve lista vacía)", () => {
      expect(parseConfig({}).corsAllowedOrigins).toEqual([]);
      expect(parseConfig({ CORS_ALLOWED_ORIGINS: "" }).corsAllowedOrigins).toEqual([]);
      expect(parseConfig({ CORS_ALLOWED_ORIGINS: "   " }).corsAllowedOrigins).toEqual([]);
    });

    it("un solo origen válido se valida y se conserva", () => {
      const config = parseConfig({ CORS_ALLOWED_ORIGINS: "http://localhost:5173" });
      expect(config.corsAllowedOrigins).toEqual(["http://localhost:5173"]);
    });

    it("múltiples orígenes separados por coma se normalizan eliminando espacios", () => {
      const config = parseConfig({
        CORS_ALLOWED_ORIGINS: "http://localhost:5173, https://app.example.com ",
      });
      expect(config.corsAllowedOrigins).toEqual([
        "http://localhost:5173",
        "https://app.example.com",
      ]);
    });

    it("rechaza comodín * y comodines en host sin exponer secretos", () => {
      expect(() => parseConfig({ CORS_ALLOWED_ORIGINS: "*" })).toThrow();
      expect(() => parseConfig({ CORS_ALLOWED_ORIGINS: "http://*" })).toThrow();
      expect(() => parseConfig({ CORS_ALLOWED_ORIGINS: "https://*.example.com" })).toThrow();
    });

    it("rechaza origen null", () => {
      expect(() => parseConfig({ CORS_ALLOWED_ORIGINS: "null" })).toThrow();
    });

    it("rechaza orígenes con rutas, barras finales o query params", () => {
      expect(() => parseConfig({ CORS_ALLOWED_ORIGINS: "http://localhost:5173/" })).toThrow();
      expect(() => parseConfig({ CORS_ALLOWED_ORIGINS: "http://localhost:5173/api" })).toThrow();
      expect(() =>
        parseConfig({ CORS_ALLOWED_ORIGINS: "http://localhost:5173?debug=true" }),
      ).toThrow();
      expect(() => parseConfig({ CORS_ALLOWED_ORIGINS: "http://localhost:5173#hash" })).toThrow();
    });

    it("rechaza protocolos no permitidos", () => {
      expect(() => parseConfig({ CORS_ALLOWED_ORIGINS: "ftp://example.com" })).toThrow();
      expect(() => parseConfig({ CORS_ALLOWED_ORIGINS: "javascript:void(0)" })).toThrow();
    });

    it("variable inválida falla sin exponer valores sensibles en el mensaje de error", () => {
      const secret = "secreto_cors_12345";
      let error;
      try {
        parseConfig({ CORS_ALLOWED_ORIGINS: secret });
      } catch (err) {
        error = err;
      }
      expect(error).toBeDefined();
      expect(error?.message).toContain("CORS_ALLOWED_ORIGINS");
      expect(error?.message).not.toContain(secret);
    });
  });
});
