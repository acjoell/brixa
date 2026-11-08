/**
 * Brixa — pruebas de generate.ts
 *
 * Máximo 4 tests según criterio de T-006:
 * 1. Archivos clave presentes tras la generación.
 * 2. _gitignore renombrado a .gitignore.
 * 3. Nombre del proyecto sustituido en package.json e index.html.
 * 4. Combinación no soportada devuelve error con código de salida 1.
 */
import { describe, it, expect, afterEach, vi } from "vitest";
import os from "node:os";
import path from "node:path";
import fs from "node:fs/promises";
import { inspect } from "node:util";
import { fileURLToPath } from "node:url";
import { generate, formatGenerateError, mergePackageJson, nextStepsMessage } from "./generate.js";
import { redact as redactTs } from "../templates/backend-express-ts/src/redact.js";
// @ts-expect-error La plantilla JavaScript no incluye archivo de declaraciones .d.ts
import { redact as redactJs } from "../templates/backend-express-js/src/redact.js";
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
  const base = await fs.mkdtemp(path.join(os.tmpdir(), "brixa-gen-"));
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
    expect(pkg).not.toContain("brixa-tpl");

    const html = await fs.readFile(path.join(dest, "index.html"), "utf-8");
    expect(html).toContain(`<title>${projectName}</title>`);
    expect(html).not.toContain("brixa-tpl");
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
    expect(pkg).not.toContain("brixa-tpl");
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
    expect(pkg).not.toContain("brixa-tpl");
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
      expect(pkgContent).not.toContain("brixa-tpl");

      if (modality === "frontend") {
        const html = await fs.readFile(path.join(dest, "index.html"), "utf-8");
        expect(html).toContain(`<title>${projectName}</title>`);
        expect(html).not.toContain("brixa-tpl");
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
  it("fusión de package.json: claves nuevas del overlay se añaden", () => {
    const base = {
      name: "app",
      scripts: { test: "vitest run" },
      dependencies: { express: "5.3.0" },
      allowScripts: { esbuild: false },
    };

    const overlay = {
      scripts: { "db:generate": "drizzle-kit generate" },
      dependencies: { "drizzle-orm": "0.45.4" },
      devDependencies: { "drizzle-kit": "0.31.11" },
      allowScripts: { other: false },
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

  it("fusión de package.json: clave con el MISMO valor no es conflicto", () => {
    const base = {
      name: "app",
      scripts: { test: "vitest run" },
      allowScripts: { esbuild: false },
    };
    const overlay = {
      scripts: { test: "vitest run" }, // mismo valor → ok
      allowScripts: { esbuild: false }, // mismo valor → ok
    };
    // No debe lanzar
    const result = mergePackageJson(base, overlay, "test-overlay");
    expect(result.scripts?.test).toBe("vitest run");
    expect(result.allowScripts?.esbuild).toBe(false);
  });

  it("fusión de package.json: valor distinto lanza error nombrando al contribuyente", () => {
    const base = {
      name: "app",
      scripts: { test: "vitest run" },
      dependencies: { express: "5.3.0" },
    };
    const overlay = {
      dependencies: { express: "99.0.0" }, // distinto → conflicto
    };
    expect(() => mergePackageJson(base, overlay, "my-overlay")).toThrow(
      /conflicto.*express.*my-overlay/i,
    );
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

  it("enmascara credenciales y tokens mediante las implementaciones reales de redact (ts y js)", () => {
    const testCases = [
      {
        name: "URL PostgreSQL con usuario y contraseña",
        input: "postgresql://u:password123@127.0.0.1:5432/db",
        expected: "postgresql://***:***@127.0.0.1:5432/db",
      },
      {
        name: "URL PostgreSQL con contraseña con '@'",
        input: "postgresql://u:SECR@ETO@127.0.0.1:5432/db",
        expected: "postgresql://***:***@127.0.0.1:5432/db",
      },
      {
        name: "URL PostgreSQL con contraseña con ':'",
        input: "postgresql://u:SEC:RET:O@127.0.0.1:5432/db",
        expected: "postgresql://***:***@127.0.0.1:5432/db",
      },
      {
        name: "URL PostgreSQL con contraseña con caracteres especiales codificados",
        input: "postgresql://admin:p%40ss%3Aw0rd@127.0.0.1:5432/mydb",
        expected: "postgresql://***:***@127.0.0.1:5432/mydb",
      },
      {
        name: "URL HTTP con credenciales",
        input: "http://dummy_user:dummy_pass@127.0.0.1:3000/api",
        expected: "http://***:***@127.0.0.1:3000/api",
      },
      {
        name: "URL libSQL con credenciales",
        input: "libsql://dummy_user:dummy_pass@127.0.0.1:8080/data",
        expected: "libsql://***:***@127.0.0.1:8080/data",
      },
      {
        name: "Parámetro authToken",
        input: "libsql://host/database?authToken=SECRET_TOKEN",
        expected: "libsql://host/database?authToken=***",
      },
      {
        name: "Parámetro token",
        input: "https://host/database?token=SECRET_TOKEN",
        expected: "https://host/database?token=***",
      },
      {
        name: "Varias URLs en una misma cadena",
        input:
          "Error al conectar con postgresql://u:p@127.0.0.1/db y http://admin:pass@127.0.0.1/status",
        expected:
          "Error al conectar con postgresql://***:***@127.0.0.1/db y http://***:***@127.0.0.1/status",
      },
      {
        name: "Texto sin credenciales ni tokens",
        input: "Error: connect ECONNREFUSED 127.0.0.1:5432",
        expected: "Error: connect ECONNREFUSED 127.0.0.1:5432",
      },
      {
        name: "No alteración de los valores no sensibles",
        input: "https://host/database?safe=true&token=SECRET_TOKEN&page=2#section",
        expected: "https://host/database?safe=true&token=***&page=2#section",
      },
    ];

    for (const tc of testCases) {
      const resTs = redactTs(tc.input);
      const resJs = redactJs(tc.input);
      expect(resTs, `Caso TS: ${tc.name}`).toBe(tc.expected);
      expect(resJs, `Caso JS: ${tc.name}`).toBe(tc.expected);
      expect(resTs).toBe(resJs);
    }
  });

  it("oculta secretos en errores inspeccionados incluyendo Error.cause y propiedades adicionales", () => {
    const cause = new Error("Causa interna con postgresql://inner_user:inner_pass@127.0.0.1/db");
    const err = new Error("Error principal con http://main_user:main_pass@127.0.0.1/api", {
      cause,
    });
    (err as unknown as { extraProp: string }).extraProp =
      "libsql://host/db?authToken=SECRET_EXTRA&other=safe";

    for (const [, redactFn] of [
      ["ts", redactTs],
      ["js", redactJs],
    ] as const) {
      const formatted = redactFn(inspect(err, { depth: 5 }));
      expect(formatted).not.toContain("inner_pass");
      expect(formatted).not.toContain("main_pass");
      expect(formatted).not.toContain("SECRET_EXTRA");
      expect(formatted).toContain("postgresql://***:***@127.0.0.1/db");
      expect(formatted).toContain("http://***:***@127.0.0.1/api");
      expect(formatted).toContain("authToken=***&other=safe");
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

describe("generate — docker opcional en backend", () => {
  it("(a) sin Docker no se generan Dockerfile, .dockerignore ni compose.yaml", async () => {
    const dest = await mkTmp("backend-no-docker");
    const result = await generate({
      modality: "backend",
      language: "ts",
      database: "postgres",
      docker: false,
      outputDir: dest,
    });

    expect(result.ok).toBe(true);
    await expect(fs.access(path.join(dest, "Dockerfile"))).rejects.toThrow();
    await expect(fs.access(path.join(dest, ".dockerignore"))).rejects.toThrow();
    await expect(fs.access(path.join(dest, "compose.yaml"))).rejects.toThrow();
  });

  it("(b) con Docker se generan y no contienen valores de contraseña literales", async () => {
    const dest = await mkTmp("backend-with-docker");
    const result = await generate({
      modality: "backend",
      language: "ts",
      database: "postgres",
      docker: true,
      outputDir: dest,
    });

    expect(result.ok).toBe(true);
    await expect(fs.access(path.join(dest, "Dockerfile"))).resolves.toBeUndefined();
    await expect(fs.access(path.join(dest, ".dockerignore"))).resolves.toBeUndefined();
    await expect(fs.access(path.join(dest, "compose.yaml"))).resolves.toBeUndefined();

    const composeContent = await fs.readFile(path.join(dest, "compose.yaml"), "utf-8");
    expect(composeContent).toContain("${POSTGRES_PASSWORD:?");
    expect(composeContent).not.toMatch(/POSTGRES_PASSWORD:\s*["']?[a-zA-Z0-9_-]+["']?\s*$/m);

    const dockerfileWithDb = await fs.readFile(path.join(dest, "Dockerfile"), "utf-8");
    expect(dockerfileWithDb).toContain("COPY --chown=node:node drizzle/ ./drizzle/");

    // Variante backend con Docker pero sin base de datos
    const nodbDest = await mkTmp("backend-docker-nodb");
    const nodbResult = await generate({
      modality: "backend",
      language: "ts",
      database: "none",
      docker: true,
      outputDir: nodbDest,
    });
    expect(nodbResult.ok).toBe(true);
    const nodbDockerfile = await fs.readFile(path.join(nodbDest, "Dockerfile"), "utf-8");
    expect(nodbDockerfile).not.toContain("drizzle");
  });
});

describe("generate — docker opcional en fullstack", () => {
  it("(a) fullstack sin Docker no genera compose.yaml, Dockerfiles ni .gitignore raíz, y frontend solo no genera archivos Docker aunque se pida", async () => {
    // 1. Fullstack sin Docker
    const fullstackDest = await mkTmp("fullstack-no-docker");
    const fullstackRes = await generate({
      modality: "fullstack",
      language: "ts",
      database: "postgres",
      docker: false,
      outputDir: fullstackDest,
    });
    expect(fullstackRes.ok).toBe(true);
    await expect(fs.access(path.join(fullstackDest, "compose.yaml"))).rejects.toThrow();
    await expect(fs.access(path.join(fullstackDest, ".gitignore"))).rejects.toThrow();
    await expect(fs.access(path.join(fullstackDest, "frontend", "Dockerfile"))).rejects.toThrow();
    await expect(fs.access(path.join(fullstackDest, "backend", "Dockerfile"))).rejects.toThrow();

    // 2. Frontend solo con docker: true (debe ignorarse)
    const frontendDest = await mkTmp("frontend-with-docker");
    const frontendRes = await generate({
      modality: "frontend",
      language: "ts",
      docker: true,
      outputDir: frontendDest,
    });
    expect(frontendRes.ok).toBe(true);
    await expect(fs.access(path.join(frontendDest, "Dockerfile"))).rejects.toThrow();
    await expect(fs.access(path.join(frontendDest, ".dockerignore"))).rejects.toThrow();
    await expect(fs.access(path.join(frontendDest, "compose.yaml"))).rejects.toThrow();
  });

  it("(b) fullstack con Docker genera los archivos, el .gitignore raíz contiene .env, y compose.yaml no contiene contraseñas literales", async () => {
    // Comprobar que la plantilla del repositorio se llama _gitignore
    const templateGitignorePath = path.resolve(
      fileURLToPath(import.meta.url),
      "../../templates/docker/fullstack/_gitignore",
    );
    await expect(fs.access(templateGitignorePath)).resolves.toBeUndefined();

    const dest = await mkTmp("fullstack-with-docker");
    const result = await generate({
      modality: "fullstack",
      language: "ts",
      database: "postgres",
      docker: true,
      outputDir: dest,
    });
    expect(result.ok).toBe(true);

    // Archivos generados
    await expect(fs.access(path.join(dest, "compose.yaml"))).resolves.toBeUndefined();
    await expect(fs.access(path.join(dest, ".gitignore"))).resolves.toBeUndefined();
    await expect(fs.access(path.join(dest, "_gitignore"))).rejects.toThrow();
    await expect(fs.access(path.join(dest, "frontend", "Dockerfile"))).resolves.toBeUndefined();
    await expect(fs.access(path.join(dest, "frontend", "nginx.conf"))).resolves.toBeUndefined();
    await expect(fs.access(path.join(dest, "frontend", ".dockerignore"))).resolves.toBeUndefined();
    await expect(fs.access(path.join(dest, "backend", "Dockerfile"))).resolves.toBeUndefined();
    await expect(fs.access(path.join(dest, "backend", ".dockerignore"))).resolves.toBeUndefined();
    await expect(fs.access(path.join(dest, "backend", "compose.yaml"))).rejects.toThrow();

    // .gitignore raíz contiene .env
    const gitignoreContent = await fs.readFile(path.join(dest, ".gitignore"), "utf-8");
    expect(gitignoreContent.trim()).toBe(".env");

    // compose.yaml no contiene contraseñas literales
    const composeContent = await fs.readFile(path.join(dest, "compose.yaml"), "utf-8");
    expect(composeContent).toContain("${POSTGRES_PASSWORD:?");
    expect(composeContent).not.toMatch(/POSTGRES_PASSWORD:\s*["']?[a-zA-Z0-9_-]+["']?\s*$/m);
  });
});

describe("generate — apiDocs opcional", () => {
  it("(a) sin documentación no se generan la especificación, la dependencia ni cambios en .env.example", async () => {
    const dest = await mkTmp("backend-no-docs");
    const result = await generate({
      modality: "backend",
      language: "ts",
      apiDocs: false,
      outputDir: dest,
    });
    expect(result.ok).toBe(true);

    await expect(fs.access(path.join(dest, "src", "docs", "openapi.json"))).rejects.toThrow();
    await expect(fs.access(path.join(dest, "tests", "docs.test.ts"))).rejects.toThrow();

    const pkg = JSON.parse(await fs.readFile(path.join(dest, "package.json"), "utf-8")) as {
      dependencies?: Record<string, string>;
      allowScripts?: Record<string, boolean>;
    };
    expect(pkg.dependencies?.["swagger-ui-express"]).toBeUndefined();
    expect(pkg.allowScripts?.["@scarf/scarf"]).toBeUndefined();

    const envContent = await fs.readFile(path.join(dest, ".env.example"), "utf-8");
    expect(envContent).not.toContain("ENABLE_API_DOCS");
  });

  it("(b) con documentación se generan la especificación, la dependencia swagger-ui-express con versión exacta, @scarf/scarf false en allowScripts y ENABLE_API_DOCS=false en .env.example", async () => {
    const dest = await mkTmp("backend-with-docs");
    const result = await generate({
      modality: "backend",
      language: "ts",
      apiDocs: true,
      outputDir: dest,
    });
    expect(result.ok).toBe(true);

    await expect(
      fs.access(path.join(dest, "src", "docs", "openapi.json")),
    ).resolves.toBeUndefined();
    await expect(fs.access(path.join(dest, "tests", "docs.test.ts"))).resolves.toBeUndefined();

    const pkg = JSON.parse(await fs.readFile(path.join(dest, "package.json"), "utf-8")) as {
      dependencies?: Record<string, string>;
      devDependencies?: Record<string, string>;
      allowScripts?: Record<string, boolean>;
    };
    expect(pkg.dependencies?.["swagger-ui-express"]).toBe("5.0.1");
    expect(pkg.devDependencies?.["@types/swagger-ui-express"]).toBe("4.1.8");
    expect(pkg.allowScripts?.["@scarf/scarf"]).toBe(false);

    const envContent = await fs.readFile(path.join(dest, ".env.example"), "utf-8");
    expect(envContent).toContain("ENABLE_API_DOCS=false");
  });
});

describe("generate — i18n opcional (T-013c)", () => {
  it("(a) sin i18n, frontend ts no genera archivos i18n ni dependencias", async () => {
    const dest = await mkTmp("frontend-ts-no-i18n");
    const result = await generate({
      modality: "frontend",
      language: "ts",
      i18n: false,
      outputDir: dest,
    });
    expect(result.ok).toBe(true);
    await expect(fs.access(path.join(dest, "src", "i18n.ts"))).rejects.toThrow();
    await expect(fs.access(path.join(dest, "src", "locales"))).rejects.toThrow();
    await expect(fs.access(path.join(dest, "scripts", "check-i18n.mjs"))).rejects.toThrow();
    const pkg = JSON.parse(await fs.readFile(path.join(dest, "package.json"), "utf-8")) as {
      dependencies?: Record<string, string>;
      scripts?: Record<string, string>;
    };
    expect(pkg.dependencies?.["i18next"]).toBeUndefined();
    expect(pkg.dependencies?.["react-i18next"]).toBeUndefined();
    expect(pkg.dependencies?.["i18next-browser-languagedetector"]).toBeUndefined();
    expect(pkg.scripts?.["check:i18n"]).toBeUndefined();
  });

  it("(b) con i18n, frontend ts añade exactamente las tres dependencias y el script check:i18n", async () => {
    const dest = await mkTmp("frontend-ts-with-i18n");
    const result = await generate({
      modality: "frontend",
      language: "ts",
      i18n: true,
      outputDir: dest,
    });
    expect(result.ok).toBe(true);

    await expect(fs.access(path.join(dest, "src", "i18n.ts"))).resolves.toBeUndefined();
    await expect(fs.access(path.join(dest, "src", "locales", "en.json"))).resolves.toBeUndefined();
    await expect(fs.access(path.join(dest, "src", "locales", "es.json"))).resolves.toBeUndefined();
    await expect(
      fs.access(path.join(dest, "src", "components", "LanguageSelector.tsx")),
    ).resolves.toBeUndefined();
    await expect(fs.access(path.join(dest, "scripts", "check-i18n.mjs"))).resolves.toBeUndefined();

    const pkg = JSON.parse(await fs.readFile(path.join(dest, "package.json"), "utf-8")) as {
      dependencies?: Record<string, string>;
      scripts?: Record<string, string>;
    };
    expect(pkg.dependencies?.["i18next"]).toBe("26.5.12");
    expect(pkg.dependencies?.["react-i18next"]).toBe("17.1.9");
    expect(pkg.dependencies?.["i18next-browser-languagedetector"]).toBe("8.2.4");
    expect(pkg.scripts?.["check:i18n"]).toBe("node scripts/check-i18n.mjs");
  });

  it("(c) i18n no se aplica en backend aunque se solicite", async () => {
    const dest = await mkTmp("backend-no-i18n");
    const result = await generate({
      modality: "backend",
      language: "ts",
      i18n: true,
      outputDir: dest,
    });
    expect(result.ok).toBe(true);
    await expect(fs.access(path.join(dest, "src", "i18n.ts"))).rejects.toThrow();
    const pkg = JSON.parse(await fs.readFile(path.join(dest, "package.json"), "utf-8")) as {
      dependencies?: Record<string, string>;
    };
    expect(pkg.dependencies?.["i18next"]).toBeUndefined();
  });

  it("(d) fullstack ts sqlite con i18n: overlay de proxy y de i18n se componen sin conflicto", async () => {
    const dest = await mkTmp("fullstack-ts-sqlite-i18n");
    const result = await generate({
      modality: "fullstack",
      language: "ts",
      database: "sqlite",
      i18n: true,
      outputDir: dest,
    });
    expect(result.ok).toBe(true);

    // Proxy overlay presente
    const viteContent = await fs.readFile(path.join(dest, "frontend", "vite.config.ts"), "utf-8");
    expect(viteContent).toContain("proxy");
    expect(viteContent).toContain("BACKEND_URL");

    // i18n overlay presente en frontend
    await expect(fs.access(path.join(dest, "frontend", "src", "i18n.ts"))).resolves.toBeUndefined();
    await expect(
      fs.access(path.join(dest, "frontend", "src", "locales", "en.json")),
    ).resolves.toBeUndefined();

    // Backend sin i18n
    await expect(fs.access(path.join(dest, "backend", "src", "i18n.ts"))).rejects.toThrow();

    const frontPkg = JSON.parse(
      await fs.readFile(path.join(dest, "frontend", "package.json"), "utf-8"),
    ) as {
      dependencies?: Record<string, string>;
    };
    expect(frontPkg.dependencies?.["i18next"]).toBe("26.5.12");
  });

  it("(e) nextStepsMessage muestra check:i18n cuando i18n está activo", () => {
    const frontendMsg = nextStepsMessage(
      "/tmp/my-app",
      "frontend",
      "none",
      false,
      "ts",
      false,
      true,
    );
    expect(frontendMsg).toContain("npm run check:i18n");

    const fullstackMsg = nextStepsMessage(
      "/tmp/my-app",
      "fullstack",
      "sqlite",
      false,
      "ts",
      false,
      true,
    );
    expect(fullstackMsg).toContain("cd frontend && npm run check:i18n");
  });

  it("nextStepsMessage y generate avisan cuando la combinación no está verificada (experimental)", async () => {
    // Combinación no verificada: frontend+js+i18n
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    const dest = await mkTmp("exp-fe-js-i18n");
    const res = await generate({
      modality: "frontend",
      language: "js",
      database: "none",
      docker: false,
      apiDocs: false,
      i18n: true,
      outputDir: dest,
    });
    expect(res.ok).toBe(true);
    expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining("experimental"));
    expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining("frontend+js+i18n"));
    warnSpy.mockRestore();

    const msg = nextStepsMessage(dest, "frontend", "none", false, "js", false, true);
    expect(msg).toContain("Combinación experimental (frontend+js+i18n)");
    expect(msg).toContain("abre un issue");
  });

  it("nextStepsMessage y generate no muestran aviso para una combinación verificada", async () => {
    // Combinación verificada: frontend+ts+i18n
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    const dest = await mkTmp("ver-fe-ts-i18n");
    const res = await generate({
      modality: "frontend",
      language: "ts",
      database: "none",
      docker: false,
      apiDocs: false,
      i18n: true,
      outputDir: dest,
    });
    expect(res.ok).toBe(true);
    expect(warnSpy).not.toHaveBeenCalled();
    warnSpy.mockRestore();

    const msg = nextStepsMessage(dest, "frontend", "none", false, "ts", false, true);
    expect(msg).not.toContain("experimental");
  });

  it("generate falla con copy_error si un archivo contiene un marcador con typo no reconocido", async () => {
    // Si la plantilla backend contuviera un marcador con typo (simulamos modificando un archivo generado antes de cleanup o mediante mock)
    // Para probar directamente el camino de fallo en generate(), usamos spy en fs.readFile para inyectar un typo en app.ts
    const originalReadFile = fs.readFile;
    const readSpy = vi.spyOn(fs, "readFile").mockImplementation(async (filepath, ...args) => {
      const pathStr = String(filepath);
      if (pathStr.endsWith("app.ts") && !pathStr.includes("_fragments")) {
        const raw = await originalReadFile(filepath, ...args);
        return String(raw) + "\n// @@INSERT:impots@@\n";
      }
      return originalReadFile(filepath, ...args);
    });

    const dest = await mkTmp("backend-typo-test");
    const res = await generate({
      modality: "backend",
      language: "ts",
      outputDir: dest,
    });

    readSpy.mockRestore();

    expect(res.ok).toBe(false);
    if (!res.ok) {
      expect(res.error.kind).toBe("copy_error");
      if (res.error.kind === "copy_error") {
        expect(res.error.message).toMatch(/marcador de inserción no reconocido.*impots/i);
      }
    }
  });
});
