import { describe, it, expect } from "vitest";
import { validateOptions, validateOptionsWithDir, formatValidationError } from "./options.js";
import type { FsAccess } from "../generator/files.js";

// ---------------------------------------------------------------------------
// Helpers de FsAccess para tests de validateOptionsWithDir
// ---------------------------------------------------------------------------

function makeMissing(): FsAccess {
  return {
    stat: () => {
      const err = Object.assign(new Error("ENOENT"), { code: "ENOENT" });
      return Promise.reject(err);
    },
    readdir: () => Promise.resolve([]),
  };
}

function makeEmptyDir(): FsAccess {
  return {
    stat: () => Promise.resolve({ isDirectory: () => true, isFile: () => false }),
    readdir: () => Promise.resolve([]),
  };
}

function makeNonEmptyDir(): FsAccess {
  return {
    stat: () => Promise.resolve({ isDirectory: () => true, isFile: () => false }),
    readdir: () => Promise.resolve(["file.txt"]),
  };
}

function makePermissionDenied(): FsAccess {
  return {
    stat: () => {
      const err = Object.assign(new Error("EACCES"), { code: "EACCES" });
      return Promise.reject(err);
    },
    readdir: () => Promise.resolve([]),
  };
}

// ---------------------------------------------------------------------------
// validateOptions — síncrona, sin I/O
// ---------------------------------------------------------------------------

describe("validateOptions", () => {
  it("acepta combinación válida frontend+ts", () => {
    const result = validateOptions({
      modality: "frontend",
      language: "ts",
      outputDir: "./app",
    });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.modality).toBe("frontend");
      expect(result.value.language).toBe("ts");
    }
  });

  it("acepta combinación válida backend+js", () => {
    const result = validateOptions({
      modality: "backend",
      language: "js",
      outputDir: "./app",
    });
    expect(result.ok).toBe(true);
  });

  it("acepta combinación válida fullstack+ts", () => {
    const result = validateOptions({
      modality: "fullstack",
      language: "ts",
      outputDir: "./app",
    });
    expect(result.ok).toBe(true);
  });

  it("rechaza modalidad inválida", () => {
    // @ts-expect-error — prueba deliberada con valor inválido.
    const result = validateOptions({ modality: "invalid", language: "ts", outputDir: "./app" });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.kind).toBe("invalid_modality");
    }
  });

  it("rechaza lenguaje inválido", () => {
    // @ts-expect-error — prueba deliberada con valor inválido.
    const result = validateOptions({
      modality: "frontend",
      language: "python",
      outputDir: "./app",
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.kind).toBe("invalid_language");
    }
  });
});

// ---------------------------------------------------------------------------
// validateOptionsWithDir — async, con FsAccess inyectado
// ---------------------------------------------------------------------------

describe("validateOptionsWithDir", () => {
  const cwd = "/home/user/projects";

  it("acepta opciones válidas con directorio inexistente", async () => {
    const result = await validateOptionsWithDir(
      { modality: "frontend", language: "ts", outputDir: "./my-app" },
      cwd,
      makeMissing(),
    );
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.outputDir).toBe("/home/user/projects/my-app");
      expect(result.value.modality).toBe("frontend");
      expect(result.value.language).toBe("ts");
    }
  });

  it("acepta directorio vacío existente", async () => {
    const result = await validateOptionsWithDir(
      { modality: "backend", language: "js", outputDir: "/abs/dir" },
      cwd,
      makeEmptyDir(),
    );
    expect(result.ok).toBe(true);
  });

  it("resuelve ruta relativa con '..' correctamente", async () => {
    const result = await validateOptionsWithDir(
      { modality: "frontend", language: "ts", outputDir: "../sibling" },
      "/home/user/projects/sub",
      makeMissing(),
    );
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.outputDir).toBe("/home/user/projects/sibling");
    }
  });

  it("rechaza directorio no vacío con error invalid_target_dir", async () => {
    const result = await validateOptionsWithDir(
      { modality: "frontend", language: "ts", outputDir: "/non-empty" },
      cwd,
      makeNonEmptyDir(),
    );
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.kind).toBe("invalid_target_dir");
      if (result.error.kind === "invalid_target_dir") {
        expect(result.error.inner.kind).toBe("not_empty");
      }
    }
  });

  it("rechaza ruta vacía", async () => {
    const result = await validateOptionsWithDir(
      { modality: "frontend", language: "ts", outputDir: "" },
      cwd,
      makeMissing(),
    );
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.kind).toBe("invalid_target_dir");
    }
  });

  it("rechaza con permiso denegado", async () => {
    const result = await validateOptionsWithDir(
      { modality: "frontend", language: "ts", outputDir: "/forbidden" },
      cwd,
      makePermissionDenied(),
    );
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.kind).toBe("invalid_target_dir");
      if (result.error.kind === "invalid_target_dir") {
        expect(result.error.inner.kind).toBe("permission_denied");
      }
    }
  });

  it("valida modalidad antes de resolver el directorio", async () => {
    const result = await validateOptionsWithDir(
      // @ts-expect-error — valor inválido deliberado.
      { modality: "bad", language: "ts", outputDir: "./app" },
      cwd,
      makeMissing(),
    );
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.kind).toBe("invalid_modality");
  });
});

// ---------------------------------------------------------------------------
// formatValidationError
// ---------------------------------------------------------------------------

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

  it("formatea error de directorio inválido (not_empty)", () => {
    const msg = formatValidationError({
      kind: "invalid_target_dir",
      inner: { kind: "not_empty", resolved: "/some/dir" },
    });
    expect(msg).toContain("/some/dir");
    expect(msg.toLowerCase()).toContain("sobrescribe");
  });

  it("formatea error de directorio inválido (permission_denied)", () => {
    const msg = formatValidationError({
      kind: "invalid_target_dir",
      inner: { kind: "permission_denied", resolved: "/secret" },
    });
    expect(msg).toContain("/secret");
  });

  it("formatea error de directorio inválido (empty_path)", () => {
    const msg = formatValidationError({
      kind: "invalid_target_dir",
      inner: { kind: "empty_path" },
    });
    expect(msg.toLowerCase()).toContain("vacía");
  });
});
