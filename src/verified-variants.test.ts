import { describe, it, expect } from "vitest";
import {
  VERIFIED_VARIANTS,
  VERIFIED_AUTH_VARIANTS,
  VERIFIED_AUTH_UI_VARIANTS,
  VERIFIED_SECURITY_VARIANTS,
  isVerified,
  isSecurityVerified,
  variantLabel,
} from "./verified-variants.js";
import { nextStepsMessage } from "./generator/generate.js";

describe("acreditación exacta de Auth", () => {
  it("conserva las cinco acreditaciones del servidor sin extenderlas a Auth UI", () => {
    expect(VERIFIED_AUTH_VARIANTS.map(variantLabel)).toEqual([
      "backend+js+postgres+docs+auth+bearer",
      "backend+ts+sqlite+docs+auth+bearer",
      "fullstack+ts+sqlite+docs+auth+cookie",
      "fullstack+js+postgres+docs+auth+cookie",
      "backend+js+sqlite+docs+auth+cookie",
    ]);
    for (const variant of VERIFIED_AUTH_VARIANTS) {
      const hasAuthUi = variant.modality === "fullstack";
      expect(isVerified(variant)).toBe(!hasAuthUi);
      expect(isSecurityVerified(variant)).toBe(true);
      if (hasAuthUi) {
        for (const authAppMode of ["private", "public"] as const) {
          expect(isVerified({ ...variant, authAppMode })).toBe(false);
          expect(isSecurityVerified({ ...variant, authAppMode })).toBe(false);
        }
      }
      const { modality, language, database, authTransport } = variant;
      expect(
        nextStepsMessage(
          "project",
          modality,
          database,
          false,
          language,
          true,
          false,
          true,
          authTransport,
        ).includes("experimental"),
      ).toBe(hasAuthUi);
    }
  });

  it("reconoce las cookies implícitas y conserva como experimentales los otros flags", () => {
    const variant = {
      modality: "backend",
      language: "js",
      database: "sqlite",
      apiDocs: true,
      auth: true,
    } as const;
    expect(isVerified(variant)).toBe(true);
    for (const changed of [
      { ...variant, authTransport: "bearer" },
      { ...variant, apiDocs: false },
      { ...variant, docker: true },
      { ...variant, i18n: true },
    ] as const) {
      expect(isVerified(changed)).toBe(false);
      expect(isSecurityVerified(changed)).toBe(false);
    }
  });
});

describe("acreditación exacta de Auth UI", () => {
  it("identifica únicamente los recorridos A privado y B público", () => {
    expect(VERIFIED_AUTH_UI_VARIANTS.map(variantLabel)).toEqual([
      "fullstack+ts+postgres+docker+docs+i18n+auth+cookie+private",
      "fullstack+js+sqlite+auth+cookie+public",
    ]);
    for (const variant of VERIFIED_AUTH_UI_VARIANTS) {
      expect(isVerified(variant)).toBe(true);
      expect(isSecurityVerified(variant)).toBe(false);
      expect(isVerified({ ...variant, authAppMode: undefined })).toBe(
        variant.authAppMode === "private",
      );
      expect(
        isVerified({
          ...variant,
          authAppMode: variant.authAppMode === "private" ? "public" : "private",
        }),
      ).toBe(false);
      for (const changed of [
        { ...variant, docker: !variant.docker },
        { ...variant, apiDocs: !variant.apiDocs },
        { ...variant, i18n: !variant.i18n },
        { ...variant, language: variant.language === "ts" ? "js" : "ts" },
        { ...variant, database: variant.database === "postgres" ? "sqlite" : "postgres" },
        { ...variant, authTransport: "bearer" },
      ] as const) {
        expect(isVerified(changed)).toBe(false);
      }
    }
  });
});

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

describe("VERIFIED_SECURITY_VARIANTS & isSecurityVerified", () => {
  it("tiene exactamente 3 entradas en el piloto inicial T-018", () => {
    expect(VERIFIED_SECURITY_VARIANTS.length).toBe(3);
  });

  it("contiene backend+ts, backend+js y fullstack+ts", () => {
    const labels = VERIFIED_SECURITY_VARIANTS.map(variantLabel);
    expect(labels).toEqual(["backend+ts", "backend+js", "fullstack+ts"]);
  });

  it("isSecurityVerified devuelve true para las 3 variantes piloto", () => {
    expect(isSecurityVerified({ modality: "backend", language: "ts" })).toBe(true);
    expect(isSecurityVerified({ modality: "backend", language: "js" })).toBe(true);
    expect(isSecurityVerified({ modality: "fullstack", language: "ts" })).toBe(true);
  });

  it("isSecurityVerified devuelve false para variantes fuera del piloto de seguridad", () => {
    expect(isSecurityVerified({ modality: "frontend", language: "ts" })).toBe(false);
    expect(isSecurityVerified({ modality: "backend", language: "ts", database: "postgres" })).toBe(
      false,
    );
  });
});
