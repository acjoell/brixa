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
import { DatabaseSync } from "node:sqlite";
import { createHash, randomBytes, randomUUID } from "node:crypto";
import path from "node:path";
import fs from "node:fs/promises";
import { inspect } from "node:util";
import { performance } from "node:perf_hooks";
import { fileURLToPath, pathToFileURL } from "node:url";
import { Worker } from "node:worker_threads";
import {
  generate,
  formatGenerateError,
  mergePackageJson,
  nextStepsMessage,
  appendComposeApiDocsEnv,
  parseEnvAssignments,
  mergeEnvExample,
} from "./generate.js";
import { redact as redactTs } from "../templates/backend-express-ts/src/redact.js";
// @ts-expect-error La plantilla JavaScript no incluye archivo de declaraciones .d.ts
import { redact as redactJs } from "../templates/backend-express-js/src/redact.js";
import { connectionUrl } from "../templates/auth-postgres/ts/src/db/connection-url.js";
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

interface NginxBlock {
  name: string;
  directives: string[];
  children: NginxBlock[];
}

describe("persistencia de Auth", () => {
  it.each([
    ["backend", "js", "sqlite"],
    ["backend", "ts", "postgres"],
    ["fullstack", "js", "postgres"],
    ["fullstack", "ts", "sqlite"],
  ] as const)(
    "compone auth:bootstrap y auth:recover-admin en %s %s %s solo con Auth",
    async (modality, language, database) => {
      const root = await mkTmp("bootstrap");
      for (const auth of [false, true]) {
        const outputDir = path.join(root, String(auth));
        expect(
          await generate({ outputDir, modality, language, database, auth, docker: true }),
        ).toEqual({ ok: true });
        const backend = modality === "fullstack" ? path.join(outputDir, "backend") : outputDir;
        const pkg = JSON.parse(await fs.readFile(path.join(backend, "package.json"), "utf8"));
        const source = "src/auth/bootstrap-cli." + language;
        const entry = language === "ts" ? "node --import tsx " + source : "node " + source;
        expect(pkg.scripts["auth:bootstrap"]).toBe(auth ? entry : undefined);
        const recoverySource = "src/auth/recover-admin-cli." + language;
        expect(pkg.scripts["auth:recover-admin"]).toBe(
          auth ? (language === "ts" ? "node --import tsx " : "node ") + recoverySource : undefined,
        );
        const readme = await fs.readFile(path.join(outputDir, "README.md"), "utf8");
        if (auth) {
          await expect(fs.access(path.join(backend, recoverySource))).resolves.toBeUndefined();
          await expect(fs.access(path.join(backend, source))).resolves.toBeUndefined();
          const env = database === "postgres" ? "-e MIGRATION_DATABASE_URL " : "";
          const command =
            language === "ts" ? "node dist/auth/bootstrap-cli.js" : "npm run auth:bootstrap";
          expect(readme).toContain("docker compose run --rm " + env + "backend " + command);
          const recovery =
            language === "ts"
              ? "node dist/auth/recover-admin-cli.js"
              : "npm run auth:recover-admin";
          expect(readme).toContain("docker compose run --rm " + env + "backend " + recovery);
          const compose = await fs.readFile(path.join(outputDir, "compose.yaml"), "utf8");
          expect(compose).not.toContain("MIGRATION_DATABASE_URL");
        } else {
          await expect(fs.access(path.join(backend, source))).rejects.toMatchObject({
            code: "ENOENT",
          });
          expect(readme).not.toContain("bootstrap-cli");
          expect(readme).not.toContain("auth:bootstrap");
          expect(readme).not.toContain("auth:recover-admin");
          await expect(fs.access(path.join(backend, recoverySource))).rejects.toMatchObject({
            code: "ENOENT",
          });
        }
      }
    },
  );

  for (const database of ["postgres", "sqlite"] as const) {
    for (const language of ["js", "ts"] as const) {
      it(`compone el esquema y la migración de ${database} en ${language} solo con Auth`, async () => {
        const root = await mkTmp("persistencia");
        for (const auth of [false, true]) {
          const outputDir = path.join(root, auth ? "con" : "sin");
          expect(
            await generate({ outputDir, modality: "backend", database, language, auth }),
          ).toEqual({ ok: true });
          const schema = await fs.readFile(
            path.join(outputDir, "src/db/schema." + language),
            "utf8",
          );
          expect(schema.includes("export const users")).toBe(auth);
          expect(schema.includes("export const sessions")).toBe(auth);
          expect(schema.includes("export const activationTokens")).toBe(auth);
          expect(schema.includes("export const auditLogSystem")).toBe(auth);
          expect(
            await fs.stat(path.join(outputDir, "ops/provision.sql")).then(
              () => true,
              () => false,
            ),
          ).toBe(auth && database === "postgres");
          expect(schema.includes("export const initialAdministrator")).toBe(auth);
          if (auth) {
            const journal = JSON.parse(
              await fs.readFile(path.join(outputDir, "drizzle/meta/_journal.json"), "utf8"),
            );
            const migration = await fs.readFile(
              path.join(outputDir, "drizzle", journal.entries[0].tag + ".sql"),
              "utf8",
            );
            expect(journal.entries.map((entry: { tag: string }) => entry.tag)).toEqual([
              "0000_auth",
              "0001_system_audit",
              database === "postgres" ? "0002_audit_privileges" : "0002_audit_append_only",
              "0003_initial_administrator",
              "0004_activation_tokens",
              "0005_platform_admin_audit",
              "0006_initial_admin_recovery_audit",
            ]);
            await fs.access(path.join(outputDir, "drizzle/meta/0006_snapshot.json"));
            await fs.access(path.join(outputDir, "drizzle/meta/0005_snapshot.json"));
            await fs.access(path.join(outputDir, "drizzle/meta/0004_snapshot.json"));
            await fs.access(path.join(outputDir, "drizzle/meta/0001_snapshot.json"));
            expect(migration).toContain("session_token_hash");
            await fs.access(path.join(outputDir, "drizzle/meta/0000_snapshot.json"));
          } else {
            await expect(
              fs.access(path.join(outputDir, "drizzle/0004_activation_tokens.sql")),
            ).rejects.toMatchObject({ code: "ENOENT" });
            await expect(
              fs.access(path.join(outputDir, "drizzle/0002_audit_append_only.sql")),
            ).rejects.toMatchObject({ code: "ENOENT" });
            await expect(
              fs.access(path.join(outputDir, "drizzle/0001_system_audit.sql")),
            ).rejects.toMatchObject({ code: "ENOENT" });
            await expect(
              fs.access(path.join(outputDir, "drizzle/0000_auth.sql")),
            ).rejects.toMatchObject({ code: "ENOENT" });
          }
        }
      });
    }
  }

  it.each([
    "0000_auth.sql",
    "meta/_journal.json",
    "meta/0000_snapshot.json",
    "0001_ajena.sql",
    "0001_system_audit.sql",
    "meta/0001_snapshot.json",
  ])("rechaza un historial Auth incompatible en %s sin modificar drizzle/", async (relative) => {
    const outputDir = await mkTmp("colision-auth");
    const drizzle = path.join(outputDir, "drizzle");
    const target = path.join(drizzle, relative);
    await fs.mkdir(path.dirname(target), { recursive: true });
    const original = Buffer.from("historial preexistente\n");
    await fs.writeFile(target, original);
    const entries = await fs.readdir(drizzle, { recursive: true });

    expect(
      await generate({
        outputDir,
        modality: "backend",
        database: "sqlite",
        language: "ts",
        auth: true,
      }),
    ).toMatchObject({
      ok: false,
      error: {
        kind: "copy_error",
        message: expect.stringContaining("Conflicto de migraciones Auth"),
      },
    });
    expect(await fs.readFile(target)).toEqual(original);
    expect((await fs.readdir(drizzle, { recursive: true })).sort()).toEqual(entries.sort());
  });

  it("persiste identidades y sesiones en archivo SQLite y aplica sus restricciones", async () => {
    const outputDir = await mkTmp("sqlite-auth");
    expect(
      await generate({
        outputDir,
        modality: "backend",
        database: "sqlite",
        language: "ts",
        auth: true,
      }),
    ).toEqual({ ok: true });
    const filename = path.join(outputDir, "auth.db");
    const db = new DatabaseSync(filename);
    const id = randomUUID();
    const digest = createHash("sha256").update(randomBytes(32)).digest("hex");
    try {
      db.exec(await fs.readFile(path.join(outputDir, "drizzle/0000_auth.sql"), "utf8"));
      const user = db.prepare(
        "INSERT INTO users (id,canonical_identifier,created_at,updated_at) VALUES (?, ?, 1, 1)",
      );
      user.run(id, "persona");
      db.exec(await fs.readFile(path.join(outputDir, "drizzle/0001_system_audit.sql"), "utf8"));
      expect(db.prepare("SELECT canonical_identifier FROM users WHERE id=?").get(id)).toEqual({
        canonical_identifier: "persona",
      });
      expect(db.prepare("SELECT COUNT(*) AS total FROM audit_log_system").get()).toEqual({
        total: 0,
      });
      expect(() => user.run(randomUUID(), "persona")).toThrow(/UNIQUE/);
      for (const identifier of [Buffer.from("persona"), Buffer.from("otra")]) {
        expect(() => user.run(randomUUID(), identifier)).toThrow(
          /CHECK.*users_identifier_nonempty/,
        );
      }
      expect(() => user.run("invalid", "otra")).toThrow(/CHECK/);
      expect(() => db.prepare("UPDATE users SET status = 'otro'").run()).toThrow(/CHECK/);
      const session = db.prepare(
        "INSERT INTO sessions (session_token_hash,user_id,created_at,last_activity_at,idle_expires_at) VALUES (?, ?, 1, 2, 3)",
      );
      expect(() => session.run(digest, randomUUID())).toThrow(/FOREIGN KEY/);
      expect(() => session.run("credencial", id)).toThrow(/CHECK/);
      session.run(digest, id);
      expect(() => session.run(digest, id)).toThrow(/UNIQUE/);
      for (const hash of [Buffer.from(digest), Buffer.from("0".repeat(64))]) {
        expect(() => session.run(hash, id)).toThrow(/CHECK.*sessions_digest/);
      }
    } finally {
      db.close();
    }
    const reopened = new DatabaseSync(filename);
    try {
      expect(reopened.prepare("SELECT * FROM sessions").get()).toEqual({
        session_token_hash: digest,
        user_id: id,
        created_at: 1,
        last_activity_at: 2,
        idle_expires_at: 3,
        revoked_at: null,
      });
      expect(reopened.prepare("SELECT * FROM users").get()).toEqual({
        id,
        canonical_identifier: "persona",
        status: "pending_activation",
        created_at: 1,
        updated_at: 1,
        password_hash: null,
      });
    } finally {
      reopened.close();
    }
  });
});

it("separa identidades PostgreSQL y rechaza credenciales incompletas o privilegiadas", () => {
  const runtime = "postgresql://app_exec:fixture@postgres/app";
  const migration = "postgresql://table_owner:fixture@postgres/app";
  expect(connectionUrl("DATABASE_URL", { DATABASE_URL: runtime })).toBe(runtime);
  expect(connectionUrl("MIGRATION_DATABASE_URL", { MIGRATION_DATABASE_URL: migration })).toBe(
    migration,
  );
  for (const env of [
    {},
    { DATABASE_URL: migration },
    { DATABASE_URL: runtime + "?user=postgres" },
    { DATABASE_URL: runtime, MIGRATION_DATABASE_URL: migration },
    { DATABASE_URL: runtime, POSTGRES_PASSWORD: "fixture" },
    { DATABASE_URL: "postgresql://app_exec@postgres/app" },
  ]) {
    expect(() => connectionUrl("DATABASE_URL", env)).toThrow();
  }
  for (const env of [{ DATABASE_URL: runtime }, { MIGRATION_DATABASE_URL: runtime }]) {
    expect(() => connectionUrl("MIGRATION_DATABASE_URL", env)).toThrow();
  }
});

describe("overlay criptográfico de Auth", () => {
  it.each([
    ["backend", "js", "sqlite", true, false],
    ["backend", "ts", "postgres", true, true],
    ["fullstack", "ts", "sqlite", true, true],
    ["fullstack", "js", "postgres", true, false],
    ["backend", "ts", "sqlite", false, false],
    ["fullstack", "js", "postgres", false, true],
  ] as const)(
    "compone entorno Docker en %s %s %s con auth=%s y docs=%s",
    async (modality, language, database, auth, apiDocs) => {
      const outputDir = await mkTmp("proyecto");
      expect(
        await generate({ outputDir, modality, language, database, auth, apiDocs, docker: true }),
      ).toEqual({ ok: true });
      const compose = await fs.readFile(path.join(outputDir, "compose.yaml"), "utf8");
      const environment =
        /\n {2}backend:\n(?: {4}[^\n]+\n)*? {4}environment:\n((?: {6}[^\n]+\n)+)/.exec(
          compose,
        )?.[1];
      const separate = auth && database === "postgres";
      const backend = modality === "fullstack" ? path.join(outputDir, "backend") : outputDir;
      const read = (name: string) => fs.readFile(path.join(backend, name), "utf8");
      expect((await read("src/index." + language)).includes("await checkRuntimeIdentity()")).toBe(
        separate,
      );
      expect((await read("src/db/migrate." + language)).includes("MIGRATION_DATABASE_URL")).toBe(
        separate,
      );
      expect((await read("drizzle.config." + language)).includes("MIGRATION_DATABASE_URL")).toBe(
        separate,
      );
      const instructions = await fs.readFile(path.join(outputDir, "README.md"), "utf8");
      expect(instructions.includes("run --rm -e MIGRATION_DATABASE_URL backend")).toBe(separate);
      if (separate) {
        expect(environment).toContain('DATABASE_URL: "${DATABASE_URL:?');
        expect(compose.split(/\n {2}(?:frontend|postgres):/)[0]).not.toMatch(
          /MIGRATION_DATABASE_URL|POSTGRES_PASSWORD|env_file|table_owner/,
        );
      }
      expect(environment).toBeDefined();
      expect(compose).not.toContain("@@INSERT:");
      expect(environment?.includes("ENABLE_API_DOCS:")).toBe(apiDocs);
      const example = await fs
        .readFile(path.join(outputDir, ".env.example"), "utf8")
        .catch((error: unknown) => {
          if ((error as NodeJS.ErrnoException).code === "ENOENT") return "";
          throw error;
        });
      expect(
        environment?.includes('SESSION_IDLE_TIMEOUT_MINUTES: "${SESSION_IDLE_TIMEOUT_MINUTES-30}"'),
      ).toBe(auth);
      expect(
        environment?.includes('SESSION_MAX_LIFETIME_HOURS: "${SESSION_MAX_LIFETIME_HOURS-12}"'),
      ).toBe(auth);
      expect(
        example.includes("SESSION_IDLE_TIMEOUT_MINUTES=30\nSESSION_MAX_LIFETIME_HOURS=12\n"),
      ).toBe(auth);
      expect(
        environment?.includes(
          'ACTIVATION_TOKEN_EXPIRY_HOURS: "${ACTIVATION_TOKEN_EXPIRY_HOURS-24}"',
        ),
      ).toBe(auth);
      expect(example.includes("ACTIVATION_TOKEN_EXPIRY_HOURS=24\n")).toBe(auth);
      const readme = await fs.readFile(path.join(outputDir, "README.md"), "utf8");
      expect(readme.includes("ACTIVATION_TOKEN_EXPIRY_HOURS")).toBe(auth);
      if (auth) {
        expect(environment).toContain('ARGON2_MAX_CONCURRENT: "${ARGON2_MAX_CONCURRENT-2}"');
        expect(environment).toContain('ARGON2_MAX_QUEUE: "${ARGON2_MAX_QUEUE-8}"');
        expect(example).toContain("ARGON2_MAX_CONCURRENT=2\nARGON2_MAX_QUEUE=8\n");
      } else {
        expect(compose).not.toContain("ARGON2_");
        expect(example).not.toContain("ARGON2_");
      }
    },
  );

  it.each([
    ["backend", "js", true],
    ["fullstack", "ts", true],
    ["backend", "ts", false],
  ] as const)("compone %s %s con auth=%s", async (modality, language, auth) => {
    const outputDir = await mkTmp("proyecto");
    const apiDocs = modality === "fullstack";
    const result = await generate({
      outputDir,
      modality,
      language,
      database: "sqlite",
      auth,
      apiDocs,
    });
    expect(result.ok).toBe(true);
    const backend = modality === "fullstack" ? path.join(outputDir, "backend") : outputDir;
    const pkg = JSON.parse(await fs.readFile(path.join(backend, "package.json"), "utf8")) as {
      dependencies: Record<string, string>;
    };
    expect(pkg.dependencies["@node-rs/argon2"]).toBe(auth ? "2.2.2" : undefined);
    expect(pkg.dependencies.express).toBeDefined();
    expect(pkg.dependencies["drizzle-orm"]).toBeDefined();
    const moduleFile = path.join(backend, "src", "auth", "password-crypto." + language);
    const index = await fs.readFile(path.join(backend, "src", "index." + language), "utf8");
    expect(index.includes("getArgon2Limiter();")).toBe(auth);
    expect(index.includes("parseSessionConfig(process.env);")).toBe(auth);
    expect(index.includes("validateApiDocsEnv(process.env.ENABLE_API_DOCS)")).toBe(apiDocs);
    if (auth) {
      const init = index.indexOf("getArgon2Limiter();");
      expect(init).toBeGreaterThan(index.indexOf("process.loadEnvFile()"));
      expect(init).toBeLessThan(index.indexOf("app.listen("));
    }
    if (auth) await expect(fs.access(moduleFile)).resolves.toBeUndefined();
    else await expect(fs.access(moduleFile)).rejects.toMatchObject({ code: "ENOENT" });
    if (modality === "fullstack") {
      const frontend = await fs.readFile(path.join(outputDir, "frontend", "package.json"), "utf8");
      expect(frontend).not.toContain("@node-rs/argon2");
    }
  });

  it.each(["frontend", "backend"] as const)("rechaza Auth en %s sin BD", async (modality) => {
    const outputDir = await mkTmp("proyecto");
    expect(await generate({ outputDir, modality, language: "ts", auth: true })).toEqual({
      ok: false,
      error: { kind: "auth_requires_backend_database" },
    });
    await expect(fs.access(outputDir)).rejects.toMatchObject({ code: "ENOENT" });
  });
});

function parseNginxConfig(raw: string): NginxBlock {
  const root: NginxBlock = { name: "root", directives: [], children: [] };
  const stack: NginxBlock[] = [root];
  const clean = raw.replace(/#[^\r\n]*/g, "");
  let token = "";
  let inQuote = false;
  let quoteChar = "";

  for (let i = 0; i < clean.length; i++) {
    const ch = clean[i];
    if (inQuote) {
      token += ch;
      if (ch === quoteChar) {
        inQuote = false;
      }
    } else if (ch === '"' || ch === "'") {
      inQuote = true;
      quoteChar = ch;
      token += ch;
    } else if (ch === "{") {
      const blockName = token.trim();
      token = "";
      const newBlock: NginxBlock = { name: blockName, directives: [], children: [] };
      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
      stack[stack.length - 1]!.children.push(newBlock);
      stack.push(newBlock);
    } else if (ch === "}") {
      if (token.trim()) {
        // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
        stack[stack.length - 1]!.directives.push(token.trim());
        token = "";
      }
      stack.pop();
    } else if (ch === ";") {
      const directive = token.trim();
      token = "";
      if (directive) {
        // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
        stack[stack.length - 1]!.directives.push(directive);
      }
    } else {
      token += ch;
    }
  }
  return root;
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

    const tsconfig = JSON.parse(await fs.readFile(path.join(dest, "tsconfig.json"), "utf-8")) as {
      compilerOptions?: { resolveJsonModule?: boolean };
    };
    expect(tsconfig.compilerOptions?.resolveJsonModule).toBe(true);
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
      // Cabeceras de autorización
      {
        name: "Authorization Bearer sin comillas",
        input: "Authorization: Bearer abc123",
        expected: "Authorization: Bearer ***",
      },
      {
        name: "Authorization Basic con comillas simples",
        input: "Authorization: 'Basic YWRtaW46c2VjcmV0'",
        expected: "Authorization: 'Basic ***'",
      },
      {
        name: "Proxy-Authorization Bearer",
        input: "Proxy-Authorization: Bearer abc123",
        expected: "Proxy-Authorization: Bearer ***",
      },
      {
        name: "Proxy-Authorization Basic",
        input: "Proxy-Authorization: Basic YWRtaW46c2VjcmV0",
        expected: "Proxy-Authorization: Basic ***",
      },
      {
        name: "Token Bearer independiente",
        input: "Bearer standaloneToken123",
        expected: "Bearer ***",
      },
      // Credenciales y secretos
      {
        name: "password con delimitador =",
        input: "password=secreto",
        expected: "password=***",
      },
      {
        name: "password con delimitador : y comillas simples",
        input: "password: 'secreto'",
        expected: "password: '***'",
      },
      {
        name: "password con delimitador : y comillas dobles",
        input: 'password: "secreto"',
        expected: 'password: "***"',
      },
      {
        name: "access_token con comillas simples",
        input: "access_token: 'abc123'",
        expected: "access_token: '***'",
      },
      {
        name: "access_token con delimitador =",
        input: "access_token=abc123",
        expected: "access_token=***",
      },
      {
        name: "accessToken camelCase",
        input: "accessToken: 'abc123'",
        expected: "accessToken: '***'",
      },
      {
        name: "refresh_token con delimitador =",
        input: "refresh_token=abc123",
        expected: "refresh_token=***",
      },
      {
        name: "refresh_token con delimitador :",
        input: "refresh_token: 'abc123'",
        expected: "refresh_token: '***'",
      },
      {
        name: "refreshToken camelCase",
        input: "refreshToken: 'abc123'",
        expected: "refreshToken: '***'",
      },
      {
        name: "authToken con delimitador :",
        input: "authToken: 'mySecretAuthToken'",
        expected: "authToken: '***'",
      },
      {
        name: "secret con delimitador =",
        input: "secret=mySecret",
        expected: "secret=***",
      },
      {
        name: "secret con delimitador :",
        input: "secret: 'mySecret'",
        expected: "secret: '***'",
      },
      {
        name: "client_secret",
        input: "client_secret: 'myClientSecret'",
        expected: "client_secret: '***'",
      },
      // Cookies
      {
        name: "Cookie sin comillas",
        input: "Cookie: sid=xyz",
        expected: "Cookie: ***",
      },
      {
        name: "Cookie con comillas simples",
        input: "cookie: 'sid=xyz'",
        expected: "cookie: '***'",
      },
      {
        name: "Set-Cookie sin comillas",
        input: "Set-Cookie: session=xyz; HttpOnly; Secure",
        expected: "Set-Cookie: ***",
      },
      {
        name: "Set-Cookie con comillas simples",
        input: "set-cookie: 'session=xyz; HttpOnly; Secure'",
        expected: "set-cookie: '***'",
      },
      {
        name: "Set-Cookie en formato array de inspect",
        input: "'set-cookie': [ 'session=xyz; HttpOnly; Secure' ]",
        expected: "'set-cookie': [ '***' ]",
      },
      // Mayúsculas y minúsculas
      {
        name: "PASSWORD en mayúsculas",
        input: 'PASSWORD="secreto"',
        expected: 'PASSWORD="***"',
      },
      {
        name: "AUTHORIZATION en mayúsculas",
        input: "AUTHORIZATION: Bearer abc123",
        expected: "AUTHORIZATION: Bearer ***",
      },
      {
        name: "COOKIE en mayúsculas",
        input: "COOKIE: sid=xyz",
        expected: "COOKIE: ***",
      },
      {
        name: "ACCESS_TOKEN en mayúsculas",
        input: 'ACCESS_TOKEN="abc123"',
        expected: 'ACCESS_TOKEN="***"',
      },
      {
        name: "REFRESH_TOKEN en mayúsculas",
        input: 'REFRESH_TOKEN="abc123"',
        expected: 'REFRESH_TOKEN="***"',
      },
      // Casos negativos (no altera texto no sensible)
      {
        name: "Propiedad no sensible username",
        input: "username: 'admin'",
        expected: "username: 'admin'",
      },
      {
        name: "Uso de Basic como texto ordinario",
        input: "Basic configuration loaded",
        expected: "Basic configuration loaded",
      },
      {
        name: "Palabra tokenization no es token",
        input: "tokenization is useful",
        expected: "tokenization is useful",
      },
      {
        name: "Palabra secretariat no es secret",
        input: "the secretariat met today",
        expected: "the secretariat met today",
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
    const cause = new Error("Causa interna con Authorization: 'Basic cause_secret'");
    const err = new Error("Error principal con https://main_user:main_pass@127.0.0.1/api", {
      cause,
    });
    (
      err as unknown as { extraProp: string; headers: Record<string, string>; password: string }
    ).extraProp = "libsql://host/db?authToken=SECRET_EXTRA&other=safe";
    (err as unknown as { headers: Record<string, string> }).headers = {
      authorization: "Bearer deep_bearer_token",
      cookie: "sid=deep_cookie_val",
      "set-cookie": "session=deep_session_val; Secure",
    };
    (err as unknown as { password: string }).password = "deep_password_val";

    for (const [, redactFn] of [
      ["ts", redactTs],
      ["js", redactJs],
    ] as const) {
      const formatted = redactFn(inspect(err, { depth: 5 }));
      expect(formatted).not.toContain("cause_secret");
      expect(formatted).not.toContain("main_pass");
      expect(formatted).not.toContain("SECRET_EXTRA");
      expect(formatted).not.toContain("deep_bearer_token");
      expect(formatted).not.toContain("deep_cookie_val");
      expect(formatted).not.toContain("deep_session_val");
      expect(formatted).not.toContain("deep_password_val");
      expect(formatted).toContain("https://***:***@127.0.0.1/api");
      expect(formatted).toContain("authToken=***&other=safe");
      expect(formatted).toContain("Bearer ***");
      expect(formatted).toContain("cookie: '***'");
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

    // nginx.conf contiene server_tokens off en el bloque server
    const nginxContent = await fs.readFile(path.join(dest, "frontend", "nginx.conf"), "utf-8");
    expect(nginxContent).toMatch(/server\s*\{[^}]*server_tokens\s+off;/s);
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

    const tsconfig = JSON.parse(await fs.readFile(path.join(dest, "tsconfig.json"), "utf-8")) as {
      compilerOptions?: { resolveJsonModule?: boolean };
    };
    expect(tsconfig.compilerOptions?.resolveJsonModule).toBe(true);
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

    const tsconfig = JSON.parse(await fs.readFile(path.join(dest, "tsconfig.json"), "utf-8")) as {
      compilerOptions?: { resolveJsonModule?: boolean };
    };
    expect(tsconfig.compilerOptions?.resolveJsonModule).toBe(true);
  });

  it("(c) Docker + apiDocs: falla con ruido si compose.yaml no contiene el punto de inserción", async () => {
    const dest = await mkTmp("compose-missing-marker");
    await fs.mkdir(dest, { recursive: true });
    const composePath = path.join(dest, "compose.yaml");
    await fs.writeFile(
      composePath,
      "services:\n  backend:\n    build: .\n    environment:\n      PORT: 3000\n",
      "utf-8",
    );

    await expect(appendComposeApiDocsEnv(composePath)).rejects.toThrow(
      /No se encontró el punto de inserción/,
    );
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

describe("generate — nginx.conf cabeceras de seguridad (Incremento C)", () => {
  it("las cabeceras de seguridad SPA están en location / con always, no en server ni en location /api/", async () => {
    const dest = await mkTmp("nginx-headers-test");
    const result = await generate({
      modality: "fullstack",
      language: "ts",
      database: "none",
      docker: true,
      outputDir: dest,
    });
    expect(result.ok).toBe(true);

    const raw = await fs.readFile(path.join(dest, "frontend", "nginx.conf"), "utf-8");
    const tree = parseNginxConfig(raw);

    // El árbol tiene un único bloque server dentro de root
    const serverBlock = tree.children.find((b) => b.name === "server");
    expect(serverBlock, "debe existir un bloque server").toBeDefined();
    if (!serverBlock) return;

    // server_tokens off debe estar en el bloque server
    expect(
      serverBlock.directives.some((d) => /server_tokens\s+off/.test(d)),
      "server_tokens off debe estar en server",
    ).toBe(true);

    // Las cabeceras de seguridad NO deben estar en las directivas directas de server
    const CSP_PATTERN = /Content-Security-Policy/i;
    const serverLevelCsp = serverBlock.directives.some((d) => CSP_PATTERN.test(d));
    expect(serverLevelCsp, "CSP NO debe estar directamente en el bloque server").toBe(false);

    // Localizar location /
    const locationRoot = serverBlock.children.find((b) => b.name === "location /");
    expect(locationRoot, "debe existir location /").toBeDefined();
    if (!locationRoot) return;

    // La CSP debe estar dentro de location / con always
    const cspDirective = locationRoot.directives.find((d) => CSP_PATTERN.test(d));
    expect(cspDirective, "CSP debe estar en location /").toBeDefined();
    expect(cspDirective, "CSP debe usar always").toMatch(/always/);

    // Verificar que todas las cabeceras requeridas están en location / con always
    const REQUIRED_HEADERS = [
      { pattern: /Content-Security-Policy/i, name: "Content-Security-Policy" },
      { pattern: /X-Content-Type-Options/i, name: "X-Content-Type-Options" },
      { pattern: /X-Frame-Options/i, name: "X-Frame-Options" },
      { pattern: /Referrer-Policy/i, name: "Referrer-Policy" },
    ];
    for (const { pattern, name } of REQUIRED_HEADERS) {
      const directive = locationRoot.directives.find((d) => pattern.test(d));
      expect(directive, `${name} debe estar en location /`).toBeDefined();
      expect(directive, `${name} debe usar always`).toMatch(/always/);
    }

    // CSP SPA correcta y sin excepciones peligrosas
    expect(cspDirective).toMatch(/default-src 'self'/);
    expect(cspDirective).toMatch(/object-src 'none'/);
    expect(cspDirective).toMatch(/frame-ancestors 'none'/);
    expect(cspDirective).not.toMatch(/unsafe-inline/);
    expect(cspDirective).not.toMatch(/unsafe-eval/);

    // Localizar location /api/
    const locationApi = serverBlock.children.find((b) => /location\s+\/api\//.test(b.name));
    expect(locationApi, "debe existir location /api/").toBeDefined();
    if (!locationApi) return;

    // /api/ NO debe tener CSP ni cabeceras de seguridad SPA
    const apiCsp = locationApi.directives.some((d) => CSP_PATTERN.test(d));
    expect(apiCsp, "CSP NO debe estar en location /api/").toBe(false);

    const apiXFrame = locationApi.directives.some((d) => /X-Frame-Options/i.test(d));
    expect(apiXFrame, "X-Frame-Options NO debe estar en location /api/").toBe(false);
  });
});

describe("generate — redact ReDoS (Incremento C y T-022)", () => {
  function runRedactInWorker(
    variant: "ts" | "js",
    input: string,
    timeoutMs = 4000,
  ): Promise<{ result: string; elapsed: number }> {
    return new Promise((resolve, reject) => {
      const fileRel =
        variant === "ts"
          ? "../templates/backend-express-ts/src/redact.ts"
          : "../templates/backend-express-js/src/redact.js";
      const fileAbs = path.resolve(path.dirname(fileURLToPath(import.meta.url)), fileRel);
      const workerCode = `
        const { parentPort, workerData } = require("node:worker_threads");
        import(workerData.url).then(({ redact }) => {
          const t0 = performance.now();
          const result = redact(workerData.input);
          const elapsed = performance.now() - t0;
          parentPort.postMessage({ result, elapsed });
        }).catch(err => {
          parentPort.postMessage({ error: err.message });
        });
      `;
      const worker = new Worker(workerCode, {
        eval: true,
        workerData: { url: pathToFileURL(fileAbs).href, input },
      });
      const timer = setTimeout(() => {
        worker.terminate().then(() => {
          reject(new Error(`Timeout (${timeoutMs}ms) en Worker ejecutando redact (${variant})`));
        });
      }, timeoutMs);

      worker.on("message", (msg) => {
        clearTimeout(timer);
        if (msg.error) {
          reject(new Error(msg.error));
        } else {
          resolve(msg);
        }
      });
      worker.on("error", (err) => {
        clearTimeout(timer);
        reject(err);
      });
    });
  }

  it("reglas 2-5 (cabeceras, Bearer, cookies, secretos) se ejecutan en tiempo lineal sobre entradas grandes", () => {
    const cases = [
      { name: "password= repeated 10 K", input: "password=".repeat(10000) },
      { name: "Cookie: unclosed brackets 50 KB", input: "Cookie: [" + "x=1; ".repeat(10000) },
      { name: "Set-Cookie: incomplete 50 KB", input: "Set-Cookie: " + "session=".repeat(10000) },
      { name: "Mixed unbalanced quotes 40 KB", input: `'"'"`.repeat(10000) },
    ];

    for (const c of cases) {
      for (const redactFn of [redactTs, redactJs]) {
        const t0 = performance.now();
        redactFn(c.input);
        const elapsed = performance.now() - t0;
        expect(elapsed, `${c.name}: ${elapsed.toFixed(1)}ms`).toBeLessThan(500);
      }
    }
  });

  it("regla 1: entradas near-miss (10 KB, 50 KB, 100 KB) se ejecutan en tiempo lineal y seguro en Worker", async () => {
    const sizes = [10000, 50000, 100000];
    for (const variant of ["ts", "js"] as const) {
      const timesWithoutScheme: number[] = [];
      const timesWithScheme: number[] = [];

      for (const size of sizes) {
        // Near-miss sin esquema :// (puras letras alfanuméricas)
        const pureAlphanumeric = "a".repeat(size);
        const resPure = await runRedactInWorker(variant, pureAlphanumeric, 3000);
        expect(resPure.result).toBe(pureAlphanumeric);
        expect(resPure.elapsed, `Pure near-miss ${variant} ${size}`).toBeLessThan(500);
        timesWithoutScheme.push(resPure.elapsed);

        // Near-miss con esquema válido pero sin '@'
        const nearMissScheme = "https://user:" + "a".repeat(size);
        const resScheme = await runRedactInWorker(variant, nearMissScheme, 3000);
        expect(resScheme.result).toBe(nearMissScheme);
        expect(resScheme.elapsed, `Scheme near-miss ${variant} ${size}`).toBeLessThan(500);
        timesWithScheme.push(resScheme.elapsed);
      }

      // Verificación de linealidad: 100 KB debe ser razonablemente lineal (< 500ms)
      // En vez del comportamiento previo (7384 ms para 100 KB, cuadrático).
      expect(timesWithScheme[2]).toBeLessThan(500);
      expect(timesWithoutScheme[2]).toBeLessThan(500);
    }
  });

  it("regla 1: casos positivos, esquemas largos y terminaciones de coincidencia parcial", () => {
    const cases = [
      // Positivos
      {
        name: "https con credenciales",
        input: "https://user:password@host/path",
        expected: "https://***:***@host/path",
      },
      {
        name: "postgresql con credenciales",
        input: "postgresql://user:secret@localhost:5432/database",
        expected: "postgresql://***:***@localhost:5432/database",
      },
      {
        name: "libsql con credenciales",
        input: "libsql://user:secret@host/database",
        expected: "libsql://***:***@host/database",
      },
      // Negativos
      {
        name: "https sin ://",
        input: "https example.com",
        expected: "https example.com",
      },
      {
        name: "cadena://sin-credenciales",
        input: "cadena://sin-credenciales",
        expected: "cadena://sin-credenciales",
      },
      {
        name: "texto extenso sin esquema",
        input: "texto alfanumerico extenso sin esquema ni nada mas",
        expected: "texto alfanumerico extenso sin esquema ni nada mas",
      },
      // Esquemas largos
      {
        name: "esquema largo de 45 caracteres",
        input: "custom-schema-with-long-identifier-prefix-123://u:p@host/path",
        expected: "custom-schema-with-long-identifier-prefix-123://***:***@host/path",
      },
      {
        name: "esquema muy largo (80 caracteres)",
        input: "a".repeat(80) + "://u:p@host/path",
        expected: "a".repeat(17) + "a".repeat(63) + "://***:***@host/path",
      },
      // Terminaciones de coincidencia parcial
      {
        name: "https://user:password sin arroba",
        input: "https://user:password",
        expected: "https://user:password",
      },
      {
        name: "https://user@",
        input: "https://user@",
        expected: "https://***:***@",
      },
      {
        name: "http://user:pass/path sin arroba",
        input: "http://user:pass/path",
        expected: "http://user:pass/path",
      },
      {
        name: "http:/path esquema mal formado",
        input: "http:/path",
        expected: "http:/path",
      },
      {
        name: "http:example.com sin doble barra",
        input: "http:example.com",
        expected: "http:example.com",
      },
    ];

    for (const c of cases) {
      for (const redactFn of [redactTs, redactJs]) {
        expect(redactFn(c.input), c.name).toBe(c.expected);
      }
    }
  });

  it("regla 5a: comillas y backticks sin cerrar (50 KB y 100 KB) se ejecutan en tiempo acotado en Worker sin retroceso cuadrático", async () => {
    for (const variant of ["ts", "js"] as const) {
      const unclosedSingle = "password: '" + "a".repeat(50000);
      const resSingle = await runRedactInWorker(variant, unclosedSingle, 3000);
      expect(resSingle.result).toBe(unclosedSingle);
      expect(resSingle.elapsed, `Unclosed single quote ${variant}`).toBeLessThan(500);

      const unclosedDouble = 'password: "' + "a".repeat(50000);
      const resDouble = await runRedactInWorker(variant, unclosedDouble, 3000);
      expect(resDouble.result).toBe(unclosedDouble);
      expect(resDouble.elapsed, `Unclosed double quote ${variant}`).toBeLessThan(500);

      const unclosedBacktick = "password: `" + "a".repeat(100000);
      const resBacktick = await runRedactInWorker(variant, unclosedBacktick, 3000);
      expect(resBacktick.result).toBe(unclosedBacktick);
      expect(resBacktick.elapsed, `Unclosed backtick 100 KB ${variant}`).toBeLessThan(500);

      const unclosedEscapes = "password: '" + "\\a".repeat(50000);
      const resEscapes = await runRedactInWorker(variant, unclosedEscapes, 3000);
      expect(resEscapes.result).toBe(unclosedEscapes);
      expect(resEscapes.elapsed, `Unclosed escapes 100 KB ${variant}`).toBeLessThan(500);
    }
  });

  it("regla 5a: inspect() real (TS y JS) con comillas simples, dobles, backticks, barras invertidas y maxStringLength = Infinity", () => {
    const testCases = [
      { name: "solo '", value: "foo'bar" },
      { name: 'solo "', value: 'foo"bar' },
      { name: "ambos ' y \"", value: "foo'bar\"baz" },
      { name: "los tres tipos más backticks", value: "foo'bar\"baz`qux" },
      { name: "barras invertidas consecutivas (\\\\)", value: "foo\\\\bar" },
      { name: "barras invertidas con comilla (\\\\')", value: "foo\\'bar" },
    ];

    const prevMax = inspect.defaultOptions.maxStringLength;

    try {
      for (const maxLen of [prevMax, Infinity]) {
        inspect.defaultOptions.maxStringLength = maxLen;

        for (const tc of testCases) {
          const obj = { password: tc.value };
          const inspected = inspect(obj, { depth: 5 });

          for (const redactFn of [redactTs, redactJs]) {
            const redacted = redactFn(inspected);

            // Ningún fragmento del secreto debe aparecer en la salida
            expect(
              redacted,
              `Leak detectado en ${tc.name} (maxStringLength=${maxLen}): ${redacted}`,
            ).not.toContain(tc.value);
            expect(redacted).not.toContain("foo");
            expect(redacted).not.toContain("bar");
            expect(redacted).not.toContain("baz");
            expect(redacted).not.toContain("qux");
            expect(redacted).toMatch(/password:\s*(`\*\*\*`|'\*\*\*'|"\*\*\*")/);
          }
        }
      }
    } finally {
      inspect.defaultOptions.maxStringLength = prevMax;
    }
  });

  it("regla 5a: cobertura completa de secretos entrecomillados y casos de borde", () => {
    const cases = [
      {
        name: "password comillas simples",
        input: "password: 'secreto'",
        expected: "password: '***'",
      },
      {
        name: "password comillas dobles",
        input: 'password: "secreto"',
        expected: 'password: "***"',
      },
      {
        name: "access_token delimitador =",
        input: "access_token='abc123'",
        expected: "access_token='***'",
      },
      {
        name: "refresh_token delimitador =",
        input: 'refresh_token="xyz789"',
        expected: 'refresh_token="***"',
      },
      {
        name: "cadena vacía comilla simple",
        input: "password: ''",
        expected: "password: '***'",
      },
      {
        name: "cadena vacía comilla doble",
        input: 'password: ""',
        expected: 'password: "***"',
      },
      {
        name: "valor con espacios",
        input: "password: 'clave con espacios'",
        expected: "password: '***'",
      },
      {
        name: "valor entre comillas simples con comillas dobles en el interior",
        input: "password: 'clave con \"comillas dobles\" adentro'",
        expected: "password: '***'",
      },
      {
        name: "valor entre comillas dobles con comillas simples en el interior",
        input: "password: \"clave con 'comillas simples' adentro\"",
        expected: 'password: "***"',
      },
      {
        name: "mezcla de comillas simples y dobles en una misma cadena",
        input: "password: 'uno', token: \"dos\"",
        expected: "password: '***', token: \"***\"",
      },
      {
        name: "múltiples propiedades sensibles extensas",
        input: "password: 'abc', access_token: 'def', refresh_token: 'ghi', secret: 'jkl'",
        expected: "password: '***', access_token: '***', refresh_token: '***', secret: '***'",
      },
      {
        name: "valores normales entrecomillados preservados",
        input: "username: 'admin', role: \"manager\"",
        expected: "username: 'admin', role: \"manager\"",
      },
    ];

    for (const c of cases) {
      for (const redactFn of [redactTs, redactJs]) {
        expect(redactFn(c.input), c.name).toBe(c.expected);
      }
    }
  });
});

describe("mergeEnvExample e idempotencia de .env.example", () => {
  it("parseEnvAssignments ignora comentarios y líneas vacías", () => {
    const raw = `
PORT=3000
# Comentario
# CORS_ALLOWED_ORIGINS=http://localhost:5173

DATABASE_URL=postgresql://user:pass@localhost:5432/db
`;
    const map = parseEnvAssignments(raw);
    expect(map.get("PORT")).toBe("3000");
    expect(map.get("DATABASE_URL")).toBe("postgresql://user:pass@localhost:5432/db");
    expect(map.has("CORS_ALLOWED_ORIGINS")).toBe(false);
    expect(map.size).toBe(2);
  });

  it("mergeEnvExample añade nuevo bloque respetando saltos de línea", () => {
    const base = "PORT=3000\n";
    const block = "# DB\nDATABASE_URL=file:./data/app.db\n";
    const result = mergeEnvExample(base, block, "SQLite");
    expect(result).toBe("PORT=3000\n# DB\nDATABASE_URL=file:./data/app.db\n");
  });

  it("mergeEnvExample es idempotente si las variables ya existen con el mismo valor", () => {
    const base = "PORT=3000\nDATABASE_URL=file:./data/app.db\n";
    const block = "DATABASE_URL=file:./data/app.db\n";
    const result = mergeEnvExample(base, block, "SQLite");
    expect(result).toBe(base);
  });

  it("mergeEnvExample falla con error explícito que nombra al contribuyente ante un conflicto", () => {
    const base = "PORT=3000\nDATABASE_URL=postgresql://localhost:5432/db\n";
    const block = "DATABASE_URL=file:./data/app.db\n";
    expect(() => mergeEnvExample(base, block, "SQLite")).toThrowError(
      /Conflicto en \.env\.example al aplicar 'SQLite': la variable 'DATABASE_URL' ya existe con un valor diferente/,
    );
  });
});

describe("composición limpia de frontend (main, App, vite.config)", () => {
  it("frontend ts sin i18n elimina marcadores en main y vite.config, manteniendo App con texto base", async () => {
    const dest = await mkTmp("frontend-clean-no-i18n");
    const result = await generate({
      modality: "frontend",
      language: "ts",
      outputDir: dest,
    });
    expect(result.ok).toBe(true);

    const mainContent = await fs.readFile(path.join(dest, "src", "main.tsx"), "utf-8");
    expect(mainContent).not.toContain("@@INSERT:");
    expect(mainContent).not.toContain("i18n");

    const viteContent = await fs.readFile(path.join(dest, "vite.config.ts"), "utf-8");
    expect(viteContent).not.toContain("@@INSERT:");
    expect(viteContent).not.toContain("proxy");

    const appContent = await fs.readFile(path.join(dest, "src", "App.tsx"), "utf-8");
    expect(appContent).not.toContain("@@INSERT:");
    expect(appContent).toContain("useAppContent");

    const useAppContent = await fs.readFile(path.join(dest, "src", "useAppContent.tsx"), "utf-8");
    expect(useAppContent).toContain("LanguageSelector: () => null");
    expect(useAppContent).toContain("Get started");
  });

  it("frontend ts con i18n inyecta import en main y no deja marcadores", async () => {
    const dest = await mkTmp("frontend-clean-with-i18n");
    const result = await generate({
      modality: "frontend",
      language: "ts",
      i18n: true,
      outputDir: dest,
    });
    expect(result.ok).toBe(true);

    const mainContent = await fs.readFile(path.join(dest, "src", "main.tsx"), "utf-8");
    expect(mainContent).not.toContain("@@INSERT:");
    expect(mainContent).toContain("import './i18n.ts'");

    const useAppContent = await fs.readFile(path.join(dest, "src", "useAppContent.tsx"), "utf-8");
    expect(useAppContent).toContain("useTranslation");
    expect(useAppContent).toContain("LanguageSelector");
  });

  it("fullstack ts compone vite.config mediante inserción y no deja marcadores", async () => {
    const dest = await mkTmp("fullstack-clean-vite");
    const result = await generate({
      modality: "fullstack",
      language: "ts",
      database: "none",
      outputDir: dest,
    });
    expect(result.ok).toBe(true);

    const viteContent = await fs.readFile(path.join(dest, "frontend", "vite.config.ts"), "utf-8");
    expect(viteContent).not.toContain("@@INSERT:");
    expect(viteContent).toContain("import process from 'node:process'");
    expect(viteContent).toContain("proxy: {");

    const mainContent = await fs.readFile(path.join(dest, "frontend", "src", "main.tsx"), "utf-8");
    expect(mainContent).not.toContain("@@INSERT:");
  });
});

describe("appContent.types.ts — archivo de tipos compartido (TS)", () => {
  it("frontend ts sin i18n incluye appContent.types.ts con MessageKey definido una sola vez", async () => {
    const dest = await mkTmp("types-frontend-no-i18n");
    const result = await generate({
      modality: "frontend",
      language: "ts",
      outputDir: dest,
    });
    expect(result.ok).toBe(true);

    const typesPath = path.join(dest, "src", "appContent.types.ts");
    const typesContent = await fs.readFile(typesPath, "utf-8");
    expect(typesContent).toContain("MessageKey");
    expect(typesContent).toContain("AppContent");

    // MessageKey definido exactamente una vez en todo el proyecto
    const hookContent = await fs.readFile(path.join(dest, "src", "useAppContent.tsx"), "utf-8");
    const occurrencesInHook = (hookContent.match(/export type MessageKey/g) ?? []).length;
    expect(occurrencesInHook).toBe(0); // hook no redefine, solo importa
    const occurrencesInTypes = (typesContent.match(/export type MessageKey/g) ?? []).length;
    expect(occurrencesInTypes).toBe(1);
  });

  it("frontend ts con i18n incluye appContent.types.ts y useAppContent i18n importa desde él", async () => {
    const dest = await mkTmp("types-frontend-i18n");
    const result = await generate({
      modality: "frontend",
      language: "ts",
      i18n: true,
      outputDir: dest,
    });
    expect(result.ok).toBe(true);

    const typesPath = path.join(dest, "src", "appContent.types.ts");
    const typesContent = await fs.readFile(typesPath, "utf-8");
    expect(typesContent).toContain("MessageKey");

    const hookContent = await fs.readFile(path.join(dest, "src", "useAppContent.tsx"), "utf-8");
    // i18n hook importa del archivo de tipos, no redefine MessageKey localmente
    expect(hookContent).toContain("from './appContent.types'");
    const localDefs = (hookContent.match(/export type MessageKey/g) ?? []).length;
    expect(localDefs).toBe(0);

    // sin marcadores en main
    const mainContent = await fs.readFile(path.join(dest, "src", "main.tsx"), "utf-8");
    expect(mainContent).not.toContain("@@INSERT:");
  });

  it("fullstack ts con i18n incluye appContent.types.ts en el directorio frontend", async () => {
    const dest = await mkTmp("types-fullstack-i18n");
    const result = await generate({
      modality: "fullstack",
      language: "ts",
      database: "sqlite",
      i18n: true,
      outputDir: dest,
    });
    expect(result.ok).toBe(true);

    const typesPath = path.join(dest, "frontend", "src", "appContent.types.ts");
    const typesContent = await fs.readFile(typesPath, "utf-8");
    expect(typesContent).toContain("MessageKey");
    expect(typesContent).toContain("AppContent");

    const hookContent = await fs.readFile(
      path.join(dest, "frontend", "src", "useAppContent.tsx"),
      "utf-8",
    );
    expect(hookContent).toContain("from './appContent.types'");
    const localDefs = (hookContent.match(/export type MessageKey/g) ?? []).length;
    expect(localDefs).toBe(0);
  });
});
