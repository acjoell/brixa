/**
 * Brixa — pruebas de insertions.ts
 *
 * Cubre los casos positivos y negativos de cada regla del sistema
 * de puntos de inserción con nombre.
 */
import { describe, it, expect } from "vitest";
import {
  resolveInsertionPoints,
  validateContributions,
  cleanupInsertionPoints,
  compareCodePoints,
  KNOWN_INSERTION_POINTS,
} from "./insertions.js";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function base(markers: string[]): string {
  return [
    'import base from "base.js";',
    ...markers.map((m) => `// @@INSERT:${m}@@`),
    "export const x = 1;",
  ].join("\n");
}

// ---------------------------------------------------------------------------
// Casos positivos
// ---------------------------------------------------------------------------

describe("resolveInsertionPoints — casos positivos", () => {
  it("punto con un contribuyente reemplaza el marcador por sus líneas", () => {
    const content = base(["imports"]);
    const result = resolveInsertionPoints(content, {
      imports: [{ contributor: "api-docs", lines: ['import { foo } from "./foo.js";'] }],
    });

    expect(result).toContain('import { foo } from "./foo.js";');
    expect(result).not.toContain("@@INSERT:");
  });

  it("punto con múltiples contribuyentes los ordena alfabéticamente", () => {
    const content = base(["routes"]);
    const result = resolveInsertionPoints(content, {
      routes: [
        { contributor: "z-overlay", lines: ["z();"] },
        { contributor: "a-overlay", lines: ["a();"] },
        { contributor: "m-overlay", lines: ["m();"] },
      ],
    });

    const lines = result.split("\n").filter((l) => l === "a();" || l === "m();" || l === "z();");
    expect(lines).toEqual(["a();", "m();", "z();"]);
    expect(result).not.toContain("@@INSERT:");
  });

  it("permutación del orden de entrada no cambia la salida (determinismo)", () => {
    const content = base(["routes"]);
    const contribs = [
      { contributor: "z-overlay", lines: ["z();"] },
      { contributor: "a-overlay", lines: ["a();"] },
    ];

    const result1 = resolveInsertionPoints(content, {
      routes: [...contribs],
    });
    const result2 = resolveInsertionPoints(content, {
      routes: [...contribs].reverse(),
    });

    expect(result1).toBe(result2);
  });

  it("punto sin contribuyente elimina el marcador sin dejar línea en blanco extra", () => {
    const content = ["line-before", "// @@INSERT:imports@@", "line-after"].join("\n");
    const result = resolveInsertionPoints(content, {});

    expect(result).not.toContain("@@INSERT:");
    expect(result).not.toContain("imports");
    // La línea en blanco que el marcador ocupaba desaparece: before y after son adyacentes.
    expect(result.split("\n")).toEqual(["line-before", "line-after"]);
  });

  it("múltiples puntos resueltos de forma independiente", () => {
    const content = ["// @@INSERT:imports@@", "const x = 1;", "// @@INSERT:routes@@"].join("\n");

    const result = resolveInsertionPoints(content, {
      imports: [{ contributor: "api-docs", lines: ['import { foo } from "./foo.js";'] }],
      routes: [{ contributor: "api-docs", lines: ["foo();"] }],
    });

    expect(result).toContain('import { foo } from "./foo.js";');
    expect(result).toContain("foo();");
    expect(result).not.toContain("@@INSERT:");
  });

  it("resolveInsertionPoints no altera líneas sin marcador", () => {
    const content = 'import express from "express";\nexport const app = express();\n';
    const result = resolveInsertionPoints(content, {});
    expect(result).toBe(content);
  });

  it("ordena por punto de código (determinista frente a ICU) en guiones vs guiones bajos y mayúsculas vs minúsculas", () => {
    // 1. "api-docs" ('-', 45) vs "api_docs" ('_', 95): en ASCII '-' < '_'
    const content = base(["routes"]);
    const resHyphenVsUnderscore = resolveInsertionPoints(content, {
      routes: [
        { contributor: "api_docs", lines: ["fnUnderscore();"] },
        { contributor: "api-docs", lines: ["fnHyphen();"] },
      ],
    });
    const lines1 = resHyphenVsUnderscore.split("\n").filter((l) => l.startsWith("fn"));
    expect(lines1).toEqual(["fnHyphen();", "fnUnderscore();"]);

    // 2. Mayúscula "B" (66) vs minúscula "a" (97): en ASCII 'B' < 'a'
    const resCase = resolveInsertionPoints(content, {
      routes: [
        { contributor: "a-overlay", lines: ["fnLowerA();"] },
        { contributor: "B-overlay", lines: ["fnUpperB();"] },
      ],
    });
    const lines2 = resCase.split("\n").filter((l) => l.startsWith("fn"));
    expect(lines2).toEqual(["fnUpperB();", "fnLowerA();"]);

    // Función pura compareCodePoints directa
    expect(compareCodePoints("api-docs", "api_docs")).toBe(-1);
    expect(compareCodePoints("api_docs", "api-docs")).toBe(1);
    expect(compareCodePoints("B-overlay", "a-overlay")).toBe(-1);
    expect(compareCodePoints("same", "same")).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// Casos negativos — cada regla de error
// ---------------------------------------------------------------------------

describe("resolveInsertionPoints — reglas de error", () => {
  it("marcador sin resolver en la salida lanza error", () => {
    // Si el contenido tiene un marcador y no se resuelve mediante insertions ni via validación,
    // forzamos el caso: tras la resolución normal, el marcador está vacío pero si inyectamos
    // un marcador directamente en las contribuciones debe detectarlo.
    // Simulamos el caso construyendo contenido con marcador y pasando mapa vacío → marcador debe desaparecer,
    // NO lanzar. Probamos el error forzando el marcador a llegar al final del output via un
    // mock del flujo: usamos un contenido que el regex no detecte (doble arroba en texto libre).
    // El caso real de "marcador sin resolver" ocurriría si el regex de detección falla.
    // Lo probamos a través de validateContributions para el flujo inverso.
    //
    // El error de "marcador sin resolver en salida" se activa por la verificación post-resolución.
    // Para testear esto directamente, inyectamos "@@INSERT:" en las líneas de una contribución.
    const content = "// @@INSERT:imports@@\nconst x = 1;";
    expect(() =>
      resolveInsertionPoints(content, {
        imports: [{ contributor: "bad", lines: ["// @@INSERT:orphan@@"] }],
      }),
    ).toThrow(/marcadores de inserción sin resolver/i);
  });

  it("contribución a punto inexistente lanza error con nombre del punto", () => {
    const content = 'import base from "base.js";\nexport const x = 1;';
    expect(() =>
      resolveInsertionPoints(content, {
        inexistente: [{ contributor: "api-docs", lines: ["foo();"] }],
      }),
    ).toThrow(/punto de inserción desconocido.*inexistente/i);
  });

  it("contribución duplicada lanza error con nombre del contribuyente", () => {
    const content = "// @@INSERT:routes@@\nconst x = 1;";
    expect(() =>
      resolveInsertionPoints(content, {
        routes: [
          { contributor: "api-docs", lines: ["foo();"] },
          { contributor: "api-docs", lines: ["bar();"] },
        ],
      }),
    ).toThrow(/contribución duplicada.*api-docs/i);
  });

  it("validateContributions detecta punto inexistente independientemente", () => {
    const content = "// @@INSERT:routes@@";
    expect(() =>
      validateContributions(content, {
        orphan: [{ contributor: "x", lines: [] }],
      }),
    ).toThrow(/punto de inserción desconocido.*orphan/i);
  });

  it("validateContributions detecta duplicado independientemente", () => {
    const content = "// @@INSERT:routes@@";
    expect(() =>
      validateContributions(content, {
        routes: [
          { contributor: "dup", lines: ["a();"] },
          { contributor: "dup", lines: ["b();"] },
        ],
      }),
    ).toThrow(/duplicada.*dup/i);
  });
});

// ---------------------------------------------------------------------------
// cleanupInsertionPoints — eliminación de declarados y rechazo de typos
// ---------------------------------------------------------------------------

describe("cleanupInsertionPoints", () => {
  it("elimina los puntos declarados (imports, routes, startup) sin dejar líneas en blanco", () => {
    const content = [
      'import { app } from "./app.js";',
      "// @@INSERT:imports@@",
      "",
      "const x = 1;",
      "// @@INSERT:routes@@",
      "function run() {",
      "  // @@INSERT:startup@@",
      "}",
    ].join("\n");

    const cleaned = cleanupInsertionPoints(content);

    expect(cleaned).not.toContain("@@INSERT:");
    expect(cleaned).not.toContain("imports");
    expect(cleaned).not.toContain("routes");
    expect(cleaned).not.toContain("startup");
    expect(cleaned).toBe(
      ['import { app } from "./app.js";', "", "const x = 1;", "function run() {", "}"].join("\n"),
    );
  });

  it("falla si encuentra un marcador con typo (por ejemplo 'impots')", () => {
    const content = [
      'import { app } from "./app.js";',
      "// @@INSERT:impots@@",
      "const x = 1;",
    ].join("\n");

    expect(() => cleanupInsertionPoints(content)).toThrow(
      /marcador de inserción no reconocido.*impots/i,
    );
  });

  it("falla si encuentra un marcador desconocido no perteneciente a los declarados", () => {
    const content = "// @@INSERT:unknown_point@@\nconst x = 1;";

    expect(() => cleanupInsertionPoints(content)).toThrow(
      /marcador de inserción no reconocido.*unknown_point/i,
    );
  });

  it("KNOWN_INSERTION_POINTS contiene exactamente imports, routes y startup", () => {
    expect([...KNOWN_INSERTION_POINTS].sort()).toEqual(["imports", "routes", "startup"]);
  });
});
