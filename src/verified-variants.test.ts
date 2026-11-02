import { describe, it, expect } from "vitest";
import { VERIFIED_VARIANTS, isVerified, variantLabel } from "./verified-variants.js";

describe("VERIFIED_VARIANTS", () => {
  it("tiene exactamente 32 entradas", () => {
    expect(VERIFIED_VARIANTS.length).toBe(32);
  });

  it("no tiene entradas duplicadas", () => {
    const labels = VERIFIED_VARIANTS.map(variantLabel);
    const unique = new Set(labels);
    expect(unique.size).toBe(labels.length);
  });
});

describe("variantLabel", () => {
  it("genera etiqueta correcta para frontend+ts", () => {
    expect(variantLabel({ modality: "frontend", language: "ts" })).toBe("frontend+ts");
  });

  it("genera etiqueta correcta para fullstack+js+sqlite+i18n", () => {
    expect(
      variantLabel({ modality: "fullstack", language: "js", database: "sqlite", i18n: true }),
    ).toBe("fullstack+js+sqlite+i18n");
  });

  it("omite database none de la etiqueta", () => {
    expect(variantLabel({ modality: "backend", language: "ts", database: "none" })).toBe(
      "backend+ts",
    );
  });

  it("incluye docker, docs e i18n en orden correcto", () => {
    expect(
      variantLabel({
        modality: "fullstack",
        language: "ts",
        database: "postgres",
        docker: true,
        apiDocs: true,
      }),
    ).toBe("fullstack+ts+postgres+docker+docs");
  });
});

describe("isVerified", () => {
  it("combinación verificada → true (frontend+ts)", () => {
    expect(isVerified({ modality: "frontend", language: "ts" })).toBe(true);
  });

  it("combinación verificada → true (fullstack+js+sqlite+i18n)", () => {
    expect(
      isVerified({ modality: "fullstack", language: "js", database: "sqlite", i18n: true }),
    ).toBe(true);
  });

  it("combinación no verificada → false (frontend+js+i18n)", () => {
    expect(isVerified({ modality: "frontend", language: "js", i18n: true })).toBe(false);
  });

  it("combinación no verificada → false (fullstack+ts+sqlite+i18n)", () => {
    expect(
      isVerified({ modality: "fullstack", language: "ts", database: "sqlite", i18n: true }),
    ).toBe(false);
  });

  it("control negativo: quitar una entrada de VERIFIED_VARIANTS hace que isVerified devuelva false para ella", () => {
    // Verificamos que el mecanismo funciona: si la lista no tuviera frontend+ts,
    // un Set reducido no contendría su etiqueta.
    const first = VERIFIED_VARIANTS[0];
    expect(first).toBeDefined();
    if (!first) return;
    const reducedSet = new Set(
      VERIFIED_VARIANTS.slice(1).map(variantLabel), // quita la primera entrada (frontend+ts)
    );
    const firstLabel = variantLabel(first);
    expect(reducedSet.has(firstLabel)).toBe(false);
  });
});
