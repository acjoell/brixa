import { describe, expect, it } from "vitest";
import { renderBanner, shouldShowBanner, shouldUseColor } from "./banner.js";

describe("banner", () => {
  it("sin color no contiene secuencias ANSI e incluye versión y lema", () => {
    const text = renderBanner("0.1.0", false);
    expect(text).not.toContain("\u001b");
    expect(text).toContain("v0.1.0");
    expect(text).toContain("Genera la base de tu próximo proyecto web");
  });

  it("con color incluye secuencias ANSI", () => {
    expect(renderBanner("0.1.0", true)).toContain("\u001b[");
  });

  it("omite la versión si no está disponible", () => {
    expect(renderBanner("", false)).not.toContain("v0");
  });

  it("no se muestra fuera de una terminal interactiva", () => {
    expect(shouldShowBanner({}, {})).toBe(false);
    expect(shouldShowBanner({ isTTY: false }, {})).toBe(false);
  });

  it("no se muestra con TERM=dumb", () => {
    expect(shouldShowBanner({ isTTY: true }, { TERM: "dumb" })).toBe(false);
  });

  it("NO_COLOR desactiva el color pero no el banner", () => {
    const env = { NO_COLOR: "1" };
    expect(shouldShowBanner({ isTTY: true }, env)).toBe(true);
    expect(shouldUseColor({ isTTY: true }, env)).toBe(false);
  });

  it("con terminal ancha dibuja un recuadro cuyas líneas miden lo mismo", () => {
    const lines = renderBanner("0.1.0", false, 80).split("\n").filter(Boolean);
    expect(lines[0]).toContain("╭");
    expect(new Set(lines.map((line) => line.length)).size).toBe(1);
  });

  it("con terminal estrecha omite el recuadro", () => {
    expect(renderBanner("0.1.0", false, 40)).not.toContain("╭");
  });
});
