/**
 * Foundry — pruebas de generate.ts
 *
 * Máximo 4 tests según criterio de T-006:
 * 1. Archivos clave presentes tras la generación.
 * 2. _gitignore renombrado a .gitignore.
 * 3. Nombre del proyecto sustituido en package.json e index.html.
 * 4. Combinación no soportada devuelve error con código de salida 1.
 */
import { describe, it, expect, afterEach } from "vitest";
import os from "node:os";
import path from "node:path";
import fs from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { generate, formatGenerateError, mergePackageJson } from "./generate.js";
import type { Modality } from "../types.js";

const KEY_FILES = [
  ".gitignore",
  "package.json",
  "index.html",
  "vite.config.ts",
  "tsconfig.json",
  "src/main.tsx",
];

let tmpDir: string | undefined;

async function mkTmp(projectName: string): Promise<string> {
  const base = await fs.mkdtemp(path.join(os.tmpdir(), "foundry-gen-"));
  // generate() crea outputDir si no existe, así que usamos una sub-ruta con nombre real.
  tmpDir = base;
  return path.join(base, projectName);
}

afterEach(async () => {
  if (tmpDir) {
    await fs.rm(tmpDir, { recursive: true, force: true });
    tmpDir = undefined;
  }
});

describe("generate — frontend + ts", () => {
  it("crea los archivos clave en el directorio de destino", async () => {
    const dest = await mkTmp("my-app");
    const result = await generate({ modality: "frontend", language: "ts", outputDir: dest });

    expect(result.ok).toBe(true);

    for (const rel of KEY_FILES) {
      const full = path.join(dest, rel);
      await expect(fs.access(full), `falta: ${rel}`).resolves.toBeUndefined();
    }
  });

  it("renombra _gitignore a .gitignore y no deja _gitignore", async () => {
    const dest = await mkTmp("my-app");
    await generate({ modality: "frontend", language: "ts", outputDir: dest });

    await expect(fs.access(path.join(dest, ".gitignore"))).resolves.toBeUndefined();
    await expect(fs.access(path.join(dest, "_gitignore"))).rejects.toThrow();
  });

  it("sustituye el nombre del proyecto en package.json e index.html", async () => {
    const projectName = "super-project";
    const dest = await mkTmp(projectName);
    await generate({ modality: "frontend", language: "ts", outputDir: dest });

    const pkg = await fs.readFile(path.join(dest, "package.json"), "utf-8");
    expect(pkg).toContain(`"name": "${projectName}"`);
    expect(pkg).not.toContain("foundry-tpl");

    const html = await fs.readFile(path.join(dest, "index.html"), "utf-8");
    expect(html).toContain(`<title>${projectName}</title>`);
    expect(html).not.toContain("foundry-tpl");
  });
});

describe("generate — frontend + js", () => {
  it("crea los archivos clave de la variante JS en el directorio de destino", async () => {
    const dest = await mkTmp("my-js-app");
    const result = await generate({ modality: "frontend", language: "js", outputDir: dest });

    expect(result.ok).toBe(true);

    const jsKeyFiles = [
      ".gitignore",
      "package.json",
      "index.html",
      "vite.config.js",
      "src/main.jsx",
    ];
    for (const rel of jsKeyFiles) {
      const full = path.join(dest, rel);
      await expect(fs.access(full), `falta: ${rel}`).resolves.toBeUndefined();
    }
  });
});

describe("generate — backend + ts", () => {
  it("crea los archivos clave de la variante backend TS en el directorio de destino", async () => {
    const dest = await mkTmp("my-backend-app");
    const result = await generate({ modality: "backend", language: "ts", outputDir: dest });

    expect(result.ok).toBe(true);

    const backendKeyFiles = [
      ".gitignore",
      "package.json",
      "tsconfig.json",
      "eslint.config.js",
      ".env.example",
      "README.md",
      "src/app.ts",
      "src/index.ts",
      "tests/health.test.ts",
    ];
    for (const rel of backendKeyFiles) {
      const full = path.join(dest, rel);
      await expect(fs.access(full), `falta: ${rel}`).resolves.toBeUndefined();
    }
  });

  it("sustituye el nombre del proyecto en package.json", async () => {
    const projectName = "backend-service";
    const dest = await mkTmp(projectName);
    await generate({ modality: "backend", language: "ts", outputDir: dest });

    const pkg = await fs.readFile(path.join(dest, "package.json"), "utf-8");
    expect(pkg).toContain(`"name": "${projectName}"`);
    expect(pkg).not.toContain("foundry-tpl");
  });
});

describe("generate — backend + js", () => {
  it("crea los archivos clave de la variante backend JS en el directorio de destino", async () => {
    const dest = await mkTmp("my-backend-js-app");
    const result = await generate({ modality: "backend", language: "js", outputDir: dest });

    expect(result.ok).toBe(true);

    const backendJsKeyFiles = [
      ".gitignore",
      "package.json",
      "eslint.config.js",
      ".env.example",
      "README.md",
      "src/app.js",
      "src/index.js",
      "tests/health.test.js",
    ];
    for (const rel of backendJsKeyFiles) {
      const full = path.join(dest, rel);
      await expect(fs.access(full), `falta: ${rel}`).resolves.toBeUndefined();
    }
  });

  it("sustituye el nombre del proyecto en package.json", async () => {
    const projectName = "backend-js-service";
    const dest = await mkTmp(projectName);
    await generate({ modality: "backend", language: "js", outputDir: dest });

    const pkg = await fs.readFile(path.join(dest, "package.json"), "utf-8");
    expect(pkg).toContain(`"name": "${projectName}"`);
    expect(pkg).not.toContain("foundry-tpl");
  });
});

describe("generate — interpolación de nombre en las cuatro variantes base", () => {
  it("sustituye el nombre del proyecto en package.json e index.html en las cuatro variantes", async () => {
    const variants = [
      { modality: "frontend" as const, language: "ts" as const },
      { modality: "frontend" as const, language: "js" as const },
      { modality: "backend" as const, language: "ts" as const },
      { modality: "backend" as const, language: "js" as const },
    ];

    for (const { modality, language } of variants) {
      const projectName = `custom-${modality}-${language}`;
      const dest = await mkTmp(projectName);
      const result = await generate({ modality, language, outputDir: dest });
      expect(result.ok).toBe(true);

      const pkgContent = await fs.readFile(path.join(dest, "package.json"), "utf-8");
      const pkg = JSON.parse(pkgContent) as { name: string };
      expect(pkg.name).toBe(projectName);
      expect(pkgContent).not.toContain("foundry-tpl");

      if (modality === "frontend") {
        const html = await fs.readFile(path.join(dest, "index.html"), "utf-8");
        expect(html).toContain(`<title>${projectName}</title>`);
        expect(html).not.toContain("foundry-tpl");
      }
    }
  });
});

describe("generate — fullstack", () => {
  it("crea la estructura con subcarpetas frontend y backend y solo README.md en raíz", async () => {
    const dest = await mkTmp("fullstack-structure-test");
    const result = await generate({ modality: "fullstack", language: "ts", outputDir: dest });
    expect(result.ok).toBe(true);

    const rootEntries = await fs.readdir(dest);
    expect(rootEntries.sort()).toEqual(["README.md", "backend", "frontend"]);

    await expect(fs.access(path.join(dest, "frontend", ".gitignore"))).resolves.toBeUndefined();
    await expect(fs.access(path.join(dest, "frontend", "package.json"))).resolves.toBeUndefined();
    await expect(fs.access(path.join(dest, "backend", ".gitignore"))).resolves.toBeUndefined();
    await expect(fs.access(path.join(dest, "backend", "package.json"))).resolves.toBeUndefined();
  });

  it("aplica el overlay de proxy en vite.config del frontend", async () => {
    for (const language of ["ts", "js"] as const) {
      const dest = await mkTmp(`fullstack-proxy-${language}`);
      const result = await generate({ modality: "fullstack", language, outputDir: dest });
      expect(result.ok).toBe(true);

      const viteFile = language === "ts" ? "vite.config.ts" : "vite.config.js";
      const viteContent = await fs.readFile(path.join(dest, "frontend", viteFile), "utf-8");

      expect(viteContent).toContain("proxy");
      expect(viteContent).toContain("BACKEND_URL");
      expect(viteContent).toContain("http://localhost:3000");
      expect(viteContent).toContain("/^\\/api(?=\\/|$)/");
    }
  });

  it("genera el README raíz con la información requerida", async () => {
    const dest = await mkTmp("fullstack-readme-test");
    const result = await generate({ modality: "fullstack", language: "ts", outputDir: dest });
    expect(result.ok).toBe(true);

    const readme = await fs.readFile(path.join(dest, "README.md"), "utf-8");
    expect(readme).toContain("Estructura");
    expect(readme).toContain("Requisitos");
    expect(readme).toContain("Instalación");
    expect(readme).toContain("Terminal 1");
    expect(readme).toContain("Terminal 2");
    expect(readme).toContain("BACKEND_URL");
    expect(readme).toContain("Despliegue en producción");
  });

  it("asigna los nombres de paquete <nombre>-frontend y <nombre>-backend", async () => {
    const projectName = "portal-app";
    const dest = await mkTmp(projectName);
    const result = await generate({ modality: "fullstack", language: "ts", outputDir: dest });
    expect(result.ok).toBe(true);

    const frontPkg = JSON.parse(
      await fs.readFile(path.join(dest, "frontend", "package.json"), "utf-8"),
    ) as { name: string };
    const backPkg = JSON.parse(
      await fs.readFile(path.join(dest, "backend", "package.json"), "utf-8"),
    ) as { name: string };

    expect(frontPkg.name).toBe(`${projectName}-frontend`);
    expect(backPkg.name).toBe(`${projectName}-backend`);
  });
});

describe("generate — combinación no soportada", () => {
  it("el mensaje de error lista las combinaciones soportadas actuales", async () => {
    const result = await generate({
      modality: "desktop" as unknown as Modality,
      language: "ts",
      outputDir: "/tmp/irrelevant",
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.kind).toBe("unsupported_combination");
      const msg = formatGenerateError(result.error);
      expect(msg).toContain("no está soportada todavía");
      expect(msg).toContain("frontend + ts");
      expect(msg).toContain("frontend + js");
      expect(msg).toContain("backend + ts");
      expect(msg).toContain("backend + js");
      expect(msg).toContain("fullstack + ts");
      expect(msg).toContain("fullstack + js");
    }
  });

  it("devuelve error unsupported_combination para combinación desconocida", async () => {
    const result = await generate({
      modality: "desktop" as unknown as Modality,
      language: "ts",
      outputDir: "/tmp/irrelevant",
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.kind).toBe("unsupported_combination");
    }
  });

  it("formatGenerateError incluye el mensaje original en copy_error", () => {
    const msg = formatGenerateError({ kind: "copy_error", message: "ENOSPC: disco lleno" });
    expect(msg.toLowerCase()).toContain("plantilla");
    expect(msg).toContain("ENOSPC: disco lleno");
  });
});

describe("generate — persistencia PostgreSQL (T-012)", () => {
  it("fusión de package.json sin pisar nada", () => {
    const base = {
      name: "app",
      scripts: { test: "vitest run" },
      dependencies: { express: "5.3.0" },
      allowScripts: { esbuild: false },
    };

    const overlay = {
      scripts: { test: "should-not-overwrite", "db:generate": "drizzle-kit generate" },
      dependencies: { express: "99.0.0", "drizzle-orm": "0.45.4" },
      devDependencies: { "drizzle-kit": "0.31.11" },
      allowScripts: { esbuild: true, other: false },
    };

    const result = mergePackageJson(base, overlay);

    expect(result.scripts?.test).toBe("vitest run");
    expect(result.scripts?.["db:generate"]).toBe("drizzle-kit generate");
    expect(result.dependencies?.express).toBe("5.3.0");
    expect(result.dependencies?.["drizzle-orm"]).toBe("0.45.4");
    expect(result.devDependencies?.["drizzle-kit"]).toBe("0.31.11");
    expect(result.allowScripts?.esbuild).toBe(false);
    expect(result.allowScripts?.other).toBe(false);
  });

  it("'Ninguna' no altera el resultado y genera el backend sin persistencia", async () => {
    const dest = await mkTmp("backend-none");
    const result = await generate({
      modality: "backend",
      language: "ts",
      database: "none",
      outputDir: dest,
    });

    expect(result.ok).toBe(true);
    await expect(fs.access(path.join(dest, "drizzle.config.ts"))).rejects.toThrow();
    await expect(fs.access(path.join(dest, "src", "db"))).rejects.toThrow();
    await expect(fs.access(path.join(dest, "tests", "db.test.ts"))).rejects.toThrow();

    const pkg = JSON.parse(await fs.readFile(path.join(dest, "package.json"), "utf-8")) as {
      dependencies?: Record<string, string>;
      scripts?: Record<string, string>;
    };
    expect(pkg.dependencies?.["drizzle-orm"]).toBeUndefined();
    expect(pkg.scripts?.["db:generate"]).toBeUndefined();
  });

  it(".env.example en postgres contiene marcadores no sensibles sin credenciales reales", async () => {
    const dest = await mkTmp("backend-postgres-env");
    const result = await generate({
      modality: "backend",
      language: "ts",
      database: "postgres",
      outputDir: dest,
    });

    expect(result.ok).toBe(true);

    const envContent = await fs.readFile(path.join(dest, ".env.example"), "utf-8");
    expect(envContent).toContain("DATABASE_URL=");
    expect(envContent).toContain("postgresql://USUARIO:CLAVE@localhost:5432/NOMBRE_BD");
    expect(envContent).not.toMatch(/postgres:\/\/.*:.*@.*:.*\/.+/);
  });

  it("combinación inválida rechazada (frontend con postgres)", async () => {
    const dest = await mkTmp("frontend-postgres-invalid");
    const result = await generate({
      modality: "frontend",
      language: "ts",
      database: "postgres",
      outputDir: dest,
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.kind).toBe("unsupported_combination");
      const msg = formatGenerateError(result.error);
      expect(msg).toContain("no está soportada todavía");
      expect(msg).toContain("frontend + ts + postgres");
    }
  });

  it("enmascara credenciales en src/db/migrate (ts y js) con contraseña normal, con '@' y con ':'", async () => {
    const templatesRoot = path.resolve(
      path.dirname(fileURLToPath(import.meta.url)),
      "..",
      "templates",
      "database-postgres",
    );

    for (const lang of ["ts", "js"] as const) {
      const filePath = path.join(templatesRoot, lang, "src", "db", `migrate.${lang}`);
      const content = await fs.readFile(filePath, "utf-8");

      const fnMatch = content.match(/function redact\([^)]*\)(?::\s*\w+)?\s*\{([\s\S]*?)\}/);
      expect(fnMatch).not.toBeNull();
      const fnBody = fnMatch?.[1] ?? "";
      const redact = new Function("text", fnBody) as (text: string) => string;

      const normal = "postgresql://u:password123@127.0.0.1:5432/db";
      const withAt = "postgresql://u:SECR@ETO@127.0.0.1:5432/db";
      const withColon = "postgresql://u:SEC:RET:O@127.0.0.1:5432/db";

      expect(redact(normal)).toBe("postgresql://***:***@127.0.0.1:5432/db");
      expect(redact(withAt)).toBe("postgresql://***:***@127.0.0.1:5432/db");
      expect(redact(withColon)).toBe("postgresql://***:***@127.0.0.1:5432/db");

      expect(redact(withAt)).not.toContain("SECR");
      expect(redact(withAt)).not.toContain("ETO");
      expect(redact(withColon)).not.toContain("SEC");
      expect(redact(withColon)).not.toContain("RET");
    }
  });
});

describe("generate — persistencia SQLite (T-012b)", () => {
  it("genera los archivos clave para la variante SQLite y configura data/ en .gitignore", async () => {
    const dest = await mkTmp("backend-sqlite");
    const result = await generate({
      modality: "backend",
      language: "ts",
      database: "sqlite",
      outputDir: dest,
    });

    expect(result.ok).toBe(true);
    await expect(fs.access(path.join(dest, "drizzle.config.ts"))).resolves.toBeUndefined();
    await expect(fs.access(path.join(dest, "src", "db", "client.ts"))).resolves.toBeUndefined();
    await expect(fs.access(path.join(dest, "src", "db", "schema.ts"))).resolves.toBeUndefined();
    await expect(fs.access(path.join(dest, "src", "db", "migrate.ts"))).resolves.toBeUndefined();
    await expect(fs.access(path.join(dest, "tests", "db.test.ts"))).resolves.toBeUndefined();

    const envContent = await fs.readFile(path.join(dest, ".env.example"), "utf-8");
    expect(envContent).toContain("DATABASE_URL=file:./data/app.db");

    const gitignoreContent = await fs.readFile(path.join(dest, ".gitignore"), "utf-8");
    expect(gitignoreContent).toContain("data/");

    const pkg = JSON.parse(await fs.readFile(path.join(dest, "package.json"), "utf-8")) as {
      dependencies?: Record<string, string>;
      scripts?: Record<string, string>;
    };
    expect(pkg.dependencies?.["@libsql/client"]).toBe("0.18.0");
    expect(pkg.dependencies?.["drizzle-orm"]).toBe("0.45.4");
    expect(pkg.scripts?.["db:generate"]).toBe("drizzle-kit generate");
    expect(pkg.scripts?.["db:migrate"]).toBe("tsx src/db/migrate.ts");
  });

  it("acepta combinaciones válidas de SQLite para backend y fullstack", async () => {
    const backendDest = await mkTmp("backend-js-sqlite");
    const backendRes = await generate({
      modality: "backend",
      language: "js",
      database: "sqlite",
      outputDir: backendDest,
    });
    expect(backendRes.ok).toBe(true);

    const fullstackDest = await mkTmp("fullstack-ts-sqlite");
    const fullstackRes = await generate({
      modality: "fullstack",
      language: "ts",
      database: "sqlite",
      outputDir: fullstackDest,
    });
    expect(fullstackRes.ok).toBe(true);
  });

  it("rechaza combinación inválida con SQLite (frontend con sqlite)", async () => {
    const dest = await mkTmp("frontend-sqlite-invalid");
    const result = await generate({
      modality: "frontend",
      language: "ts",
      database: "sqlite",
      outputDir: dest,
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.kind).toBe("unsupported_combination");
      const msg = formatGenerateError(result.error);
      expect(msg).toContain("no está soportada todavía");
      expect(msg).toContain("frontend + ts + sqlite");
    }
  });
});
