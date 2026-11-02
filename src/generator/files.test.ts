import { describe, it, expect } from "vitest";
import os from "node:os";
import path from "node:path";
import fs from "node:fs/promises";
import {
  resolveTargetPath,
  validateTargetDir,
  formatTargetDirError,
  type FsAccess,
  type TargetDirError,
} from "./files.js";

// ---------------------------------------------------------------------------
// resolveTargetPath — sin I/O, pura
// ---------------------------------------------------------------------------

describe("resolveTargetPath", () => {
  it("rechaza cadena vacía", () => {
    const result = resolveTargetPath("");
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.kind).toBe("empty_path");
  });

  it("rechaza cadena solo con espacios", () => {
    const result = resolveTargetPath("   ");
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.kind).toBe("empty_path");
  });

  it("resuelve ruta relativa a absoluta", () => {
    const cwd = "/home/user/projects";
    const result = resolveTargetPath("my-app", cwd);
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value).toBe(path.resolve("/home/user/projects/my-app"));
  });

  it("resuelve ruta con '..' a absoluta", () => {
    const cwd = "/home/user/projects/sub";
    const result = resolveTargetPath("../other", cwd);
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value).toBe(path.resolve("/home/user/projects/other"));
  });

  it("devuelve ruta absoluta tal cual", () => {
    const result = resolveTargetPath("/tmp/my-project", "/anything");
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value).toBe(path.resolve("/tmp/my-project"));
  });

  it("elimina espacios en el extremo antes de resolver", () => {
    const cwd = "/home/user";
    const result = resolveTargetPath("  app  ", cwd);
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value).toBe(path.resolve("/home/user/app"));
  });
});

// ---------------------------------------------------------------------------
// validateTargetDir — con FsAccess inyectado (sin I/O real en la mayoría)
// ---------------------------------------------------------------------------

/** Construye un FsAccess que simula un directorio no existente (ENOENT). */
function makeMissing(): FsAccess {
  return {
    stat: () => {
      const err = Object.assign(new Error("ENOENT"), { code: "ENOENT" });
      return Promise.reject(err);
    },
    readdir: () => Promise.resolve([]),
  };
}

/** Construye un FsAccess que simula un directorio vacío existente. */
function makeEmptyDir(): FsAccess {
  return {
    stat: () => Promise.resolve({ isDirectory: () => true, isFile: () => false }),
    readdir: () => Promise.resolve([]),
  };
}

/** Construye un FsAccess que simula un directorio no vacío. */
function makeNonEmptyDir(): FsAccess {
  return {
    stat: () => Promise.resolve({ isDirectory: () => true, isFile: () => false }),
    readdir: () => Promise.resolve(["file.txt", "README.md"]),
  };
}

/** Construye un FsAccess que simula que la ruta es un archivo. */
function makeFile(): FsAccess {
  return {
    stat: () => Promise.resolve({ isDirectory: () => false, isFile: () => true }),
    readdir: () => Promise.resolve([]),
  };
}

/** Construye un FsAccess que simula error de permisos (EACCES). */
function makePermissionDenied(): FsAccess {
  return {
    stat: () => {
      const err = Object.assign(new Error("EACCES"), { code: "EACCES" });
      return Promise.reject(err);
    },
    readdir: () => Promise.resolve([]),
  };
}

/** Construye un FsAccess que simula error de permisos en readdir. */
function makeReaddirPermissionDenied(): FsAccess {
  return {
    stat: () => Promise.resolve({ isDirectory: () => true, isFile: () => false }),
    readdir: () => {
      const err = Object.assign(new Error("EACCES"), { code: "EACCES" });
      return Promise.reject(err);
    },
  };
}

/** Construye un FsAccess que simula error de permisos EPERM. */
function makeEperm(): FsAccess {
  return {
    stat: () => {
      const err = Object.assign(new Error("EPERM"), { code: "EPERM" });
      return Promise.reject(err);
    },
    readdir: () => Promise.resolve([]),
  };
}

/** Construye un FsAccess que simula un error de stat genérico. */
function makeStatError(): FsAccess {
  return {
    stat: () => {
      const err = Object.assign(new Error("EIO: disco dañado"), {
        code: "EIO",
      });
      return Promise.reject(err);
    },
    readdir: () => Promise.resolve([]),
  };
}

describe("validateTargetDir", () => {
  it("acepta directorio inexistente (willBeCreated: true)", async () => {
    const result = await validateTargetDir("/no/existe", makeMissing());
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.willBeCreated).toBe(true);
      expect(result.value.resolved).toBe("/no/existe");
    }
  });

  it("acepta directorio vacío existente (willBeCreated: false)", async () => {
    const result = await validateTargetDir("/empty", makeEmptyDir());
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.willBeCreated).toBe(false);
    }
  });

  it("rechaza directorio no vacío", async () => {
    const result = await validateTargetDir("/non-empty", makeNonEmptyDir());
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.kind).toBe("not_empty");
  });

  it("rechaza ruta que es un archivo", async () => {
    const result = await validateTargetDir("/file.txt", makeFile());
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.kind).toBe("not_a_directory");
  });

  it("rechaza con permiso denegado en stat (EACCES)", async () => {
    const result = await validateTargetDir("/forbidden", makePermissionDenied());
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.kind).toBe("permission_denied");
  });

  it("rechaza con permiso denegado en stat (EPERM)", async () => {
    const result = await validateTargetDir("/forbidden-eperm", makeEperm());
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.kind).toBe("permission_denied");
  });

  it("rechaza con permiso denegado en readdir", async () => {
    const result = await validateTargetDir("/no-readdir", makeReaddirPermissionDenied());
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.kind).toBe("permission_denied");
  });

  it("propaga error de stat genérico como stat_error", async () => {
    const result = await validateTargetDir("/broken", makeStatError());
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.kind).toBe("stat_error");
      expect((result.error as Extract<TargetDirError, { kind: "stat_error" }>).message).toContain(
        "disco dañado",
      );
    }
  });
});

// ---------------------------------------------------------------------------
// validateTargetDir — casos reales con os.tmpdir()
// ---------------------------------------------------------------------------

describe("validateTargetDir (I/O real con tmpdir)", () => {
  it("acepta directorio temporal vacío", async () => {
    const tmp = await fs.mkdtemp(path.join(os.tmpdir(), "brixa-test-"));
    try {
      const result = await validateTargetDir(tmp);
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.willBeCreated).toBe(false);
        expect(result.value.resolved).toBe(tmp);
      }
    } finally {
      await fs.rmdir(tmp);
    }
  });

  it("acepta ruta inexistente dentro de tmpdir", async () => {
    const target = path.join(os.tmpdir(), `brixa-new-${Date.now()}`);
    const result = await validateTargetDir(target);
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value.willBeCreated).toBe(true);
    // No se crea el directorio.
    await expect(fs.access(target)).rejects.toThrow();
  });

  it("rechaza directorio temporal no vacío", async () => {
    const tmp = await fs.mkdtemp(path.join(os.tmpdir(), "brixa-test-"));
    try {
      await fs.writeFile(path.join(tmp, "file.txt"), "data");
      const result = await validateTargetDir(tmp);
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.error.kind).toBe("not_empty");
    } finally {
      await fs.rm(tmp, { recursive: true });
    }
  });

  it("rechaza archivo en lugar de directorio", async () => {
    const tmp = await fs.mkdtemp(path.join(os.tmpdir(), "brixa-test-"));
    const file = path.join(tmp, "project");
    try {
      await fs.writeFile(file, "not a dir");
      const result = await validateTargetDir(file);
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.error.kind).toBe("not_a_directory");
    } finally {
      await fs.rm(tmp, { recursive: true });
    }
  });
});

// ---------------------------------------------------------------------------
// formatTargetDirError
// ---------------------------------------------------------------------------

describe("formatTargetDirError", () => {
  it("formatea empty_path", () => {
    const msg = formatTargetDirError({ kind: "empty_path" });
    expect(msg).toContain("vacía");
  });

  it("formatea not_a_directory", () => {
    const msg = formatTargetDirError({
      kind: "not_a_directory",
      resolved: "/foo/bar",
    });
    expect(msg).toContain("/foo/bar");
    expect(msg.toLowerCase()).toContain("directorio");
  });

  it("formatea not_empty con ruta y aviso de no sobrescritura", () => {
    const msg = formatTargetDirError({
      kind: "not_empty",
      resolved: "/some/dir",
    });
    expect(msg).toContain("/some/dir");
    expect(msg.toLowerCase()).toContain("sobrescribe");
  });

  it("formatea permission_denied", () => {
    const msg = formatTargetDirError({
      kind: "permission_denied",
      resolved: "/root/secret",
    });
    expect(msg).toContain("/root/secret");
    expect(msg.toLowerCase()).toContain("permiso");
  });

  it("formatea stat_error con el mensaje original", () => {
    const msg = formatTargetDirError({
      kind: "stat_error",
      resolved: "/bad",
      message: "I/O error",
    });
    expect(msg).toContain("/bad");
    expect(msg).toContain("I/O error");
  });
});
