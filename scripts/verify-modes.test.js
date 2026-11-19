import { afterEach, describe, expect, it, vi } from "vitest";
import { execFileSync } from "node:child_process";
import { getVerificationMode, prepareDependencies } from "./verify-generated.js";

vi.mock("node:child_process", async (original) => ({
  ...(await original()),
  execFileSync: vi.fn(),
}));

afterEach(() => vi.resetAllMocks());

describe("Separación funcional y auditoría de proyectos generados", () => {
  it("mantiene el modo integral por defecto y rechaza modos combinados", () => {
    expect(getVerificationMode(["backend+js+postgres"])).toBe("all");
    expect(getVerificationMode(["--functional-only", "backend+js+postgres"])).toBe("functional");
    expect(getVerificationMode(["--audit-only"])).toBe("audit");
    expect(() => getVerificationMode(["--functional-only", "--audit-only"])).toThrow();
  });

  it("el modo funcional instala sin ejecutar ni declarar aprobada la auditoría", () => {
    const log = vi.spyOn(console, "log").mockImplementation(() => {});
    prepareDependencies("/project", "functional");
    expect(execFileSync).toHaveBeenCalledTimes(1);
    expect(execFileSync.mock.calls[0][1]).toEqual(["install", "--no-audit"]);
    expect(log).toHaveBeenCalledWith(expect.stringContaining("auditoría no evaluada"));
    log.mockRestore();
  });

  it.each(["all", "audit"])("%s propaga cualquier fallo de auditoría sin excepciones", (mode) => {
    vi.mocked(execFileSync).mockImplementation((_command, args) => {
      if (args[0] === "audit") throw new Error("audit failed");
    });
    expect(() => prepareDependencies("/project", mode)).toThrow("audit failed");
    expect(execFileSync.mock.calls[1][1]).toEqual(["audit", "--audit-level=moderate"]);
  });

  it("un fallo de instalación también bloquea la verificación funcional", () => {
    vi.mocked(execFileSync).mockImplementation(() => {
      throw new Error("install failed");
    });
    expect(() => prepareDependencies("/project", "functional")).toThrow("install failed");
  });
});
