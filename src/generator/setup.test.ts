import { spawn, spawnSync } from "node:child_process";
import { randomBytes } from "node:crypto";
import {
  mkdtemp,
  readFile,
  writeFile,
  mkdir,
  rm,
  stat,
  symlink,
  access,
  chmod,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { parseEnv } from "node:util";
import { afterEach, expect, it } from "vitest";
import type { UserOptions } from "../types.js";
import { generate } from "./generate.js";

const roots: string[] = [];
const linux = process.platform === "linux";

async function project(options: Omit<UserOptions, "outputDir">) {
  const root = await mkdtemp(path.join(tmpdir(), "brixa setup "));
  roots.push(root);
  const app = path.join(root, "app");
  expect(await generate({ ...options, outputDir: app })).toEqual({ ok: true });
  if (linux) {
    await chmod(app, 0o755);
    if (options.modality === "fullstack") await chmod(path.join(app, "backend"), 0o755);
  }
  return { root, app };
}

afterEach(async () =>
  Promise.all(roots.splice(0).map((root) => rm(root, { recursive: true, force: true }))),
);

const auth = { modality: "fullstack", language: "ts", auth: true, database: "sqlite" } as const;

async function npmFixture(root: string) {
  const entry = path.join(root, "fake npm.mjs");
  await writeFile(
    entry,
    `
import { appendFileSync, writeFileSync } from "node:fs";
import { spawn } from "node:child_process";
if (process.argv.includes("install")) {
  appendFileSync(process.env.SETUP_TEST_TRACE, process.cwd() + "\\n");
  if (process.env.SETUP_TEST_FAILURE) {
    console.error(process.env.SETUP_TEST_FAILURE);
    process.exit(31);
  }
  if (process.env.SETUP_TEST_WAIT) {
    writeFileSync(process.env.SETUP_TEST_WAIT, "");
    if (process.env.SETUP_TEST_HEARTBEAT) {
      spawn(process.execPath, ["--input-type=module", "-e",
        'import { appendFileSync, writeFileSync } from "node:fs";' +
        'process.on("SIGTERM", () => {});' +
        'writeFileSync(process.env.SETUP_TEST_HEARTBEAT + ".pid", String(process.pid));' +
        'setInterval(() => appendFileSync(process.env.SETUP_TEST_HEARTBEAT, "."), 25);'
      ], { stdio: "ignore" });
    }
    setInterval(() => {}, 100);
  }
} else if (process.argv.includes("db:migrate") || process.argv.includes("auth:bootstrap")) {
  const bootstrap = process.argv.includes("auth:bootstrap");
  if (bootstrap && !process.argv.includes("--if-needed")) process.exit(35);
  if (!process.env.DATABASE_URL || process.env.MIGRATION_DATABASE_URL || process.env.POSTGRES_PASSWORD) process.exit(36);
  appendFileSync(process.env.SETUP_TEST_TRACE + ".db", (bootstrap ? "bootstrap" : "migrate") + "\\n");
  if (!bootstrap && process.env.SETUP_TEST_MIGRATION_FAILURE) {
    console.error(process.env.SETUP_TEST_MIGRATION_FAILURE);
    process.exit(37);
  }
}`,
  );
  const trace = path.join(root, "installations");
  const env: NodeJS.ProcessEnv = { ...process.env, npm_execpath: entry, SETUP_TEST_TRACE: trace };
  delete env.LOGIN_ABUSE_HMAC_KEY;
  delete env.DATABASE_URL;
  delete env.NODE_ENV;
  return { env, trace };
}

function run(app: string, env: NodeJS.ProcessEnv) {
  const { status, stdout, stderr, error } = spawnSync(process.execPath, ["scripts/setup.mjs"], {
    cwd: app,
    env,
    encoding: "utf8",
    timeout: 10_000,
  });
  if (error) throw error;
  return { status, output: stdout + stderr };
}

function stopFixtureProcess(pid: number) {
  if (!pid) return;
  try {
    process.kill(pid, "SIGKILL");
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ESRCH") throw error;
  }
}

it("incluye el mismo asistente en TS y JS y conserva los manifiestos de aplicación", async () => {
  const ts = await project(auth);
  const js = await project({ ...auth, language: "js" });
  expect(await readFile(path.join(ts.app, "scripts/setup.mjs"), "utf8")).toBe(
    await readFile(path.join(js.app, "scripts/setup.mjs"), "utf8"),
  );
  expect(JSON.parse(await readFile(path.join(ts.app, "package.json"), "utf8"))).toEqual({
    private: true,
    engines: { node: "^24.0.0 || >=26.0.0" },
    scripts: { setup: "node scripts/setup.mjs" },
  });
  for (const part of ["backend", "frontend"]) {
    expect(
      JSON.parse(await readFile(path.join(ts.app, part, "package.json"), "utf8")).scripts.setup,
    ).toBeUndefined();
  }
  const frontend = await project({ modality: "frontend", language: "js" });
  const { env, trace } = await npmFixture(frontend.root);
  expect(
    JSON.parse(await readFile(path.join(frontend.app, "package.json"), "utf8")).scripts.setup,
  ).toBe("node scripts/setup.mjs");
  expect(run(frontend.app, env)).toMatchObject({
    status: 0,
    output: expect.stringContaining("Entorno: omitido"),
  });
  expect((await readFile(trace, "utf8")).trim()).toBe(frontend.app);
  await expect(access(path.join(frontend.app, "node_modules"))).rejects.toMatchObject({
    code: "ENOENT",
  });
  const backend = await project({ modality: "backend", language: "js", docker: true });
  expect(JSON.parse(await readFile(path.join(backend.app, "package.json"), "utf8"))).toMatchObject({
    scripts: { setup: "node scripts/setup.mjs" },
    dependencies: { express: expect.any(String) },
  });
  expect(await readFile(path.join(backend.app, ".dockerignore"), "utf8")).toContain(
    ".brixa-setup/",
  );
});

it.runIf(linux)(
  "crea y reutiliza el entorno privado sin rotar secretos ni empaquetarlos",
  async () => {
    const { root, app } = await project(auth);
    const destination = path.join(app, "backend", ".env");
    const { env, trace } = await npmFixture(root);
    const first = run(app, env);
    expect(first).toMatchObject({
      status: 0,
      output: expect.stringContaining("backend/.env creado"),
    });
    expect((await readFile(trace, "utf8")).trim().split("\n")).toEqual(
      ["backend", "frontend"].map((part) => path.join(app, part)),
    );
    expect((await stat(destination)).mode & 0o777).toBe(0o600);
    const file = await readFile(destination, "utf8");
    const secret = parseEnv(file).LOGIN_ABUSE_HMAC_KEY ?? "";
    expect(secret).toMatch(/^[a-f0-9]{64}$/);
    expect(first.output).not.toContain(secret);
    expect(parseEnv(file).ACTIVATION_PAGE_URL).toBe("http://localhost:5173/activate");
    const second = run(app, env);
    expect(second).toMatchObject({ status: 0, output: expect.stringContaining("reutilizado") });
    expect(second.output).not.toContain(secret);
    expect(await readFile(destination, "utf8")).toBe(file);

    const npmEntry = process.env.npm_execpath;
    if (!npmEntry) throw new Error("Ejecuta esta prueba con npm test.");
    const pack = spawnSync(
      process.execPath,
      [
        npmEntry,
        "pack",
        "--ignore-scripts",
        "--dry-run",
        "--json",
        "--cache",
        path.join(root, "cache"),
      ],
      {
        cwd: path.join(app, "backend"),
        encoding: "utf8",
        timeout: 10_000,
      },
    );
    expect(pack.status).toBe(0);
    const files: { path: string }[] = JSON.parse(pack.stdout)[0].files;
    expect(files.map(({ path: name }) => name)).toContain(".env.example");
    expect(files.map(({ path: name }) => name)).not.toContain(".env");
    expect(pack.stdout + pack.stderr).not.toContain(secret);
  },
);

it.runIf(linux)(
  "rechaza configuraciones incompletas, enlaces y fallos de instalación sin divulgar valores",
  async () => {
    const { root, app } = await project(auth);
    const { env } = await npmFixture(root);
    const location = path.join(app, "backend", ".env");
    const secret = randomBytes(24).toString("hex");
    await writeFile(location, `LOGIN_ABUSE_HMAC_KEY=${secret}\n`, { mode: 0o600 });
    const incomplete = run(app, env);
    expect(incomplete).toMatchObject({
      status: 1,
      output: expect.stringContaining("LOGIN_ABUSE_HMAC_KEY"),
    });
    expect(incomplete.output).not.toContain(secret);
    expect(await readFile(location, "utf8")).toContain(secret);
    await rm(location);
    const other = path.join(root, "target.env");
    await writeFile(other, secret);
    await symlink(other, location);
    expect(run(app, env)).toMatchObject({
      status: 1,
      output: expect.stringContaining("sin enlaces"),
    });
    expect(await readFile(other, "utf8")).toBe(secret);
    await rm(location);
    const lock = path.join(app, "backend", ".brixa-setup");
    await mkdir(lock);
    await writeFile(path.join(lock, ".env"), secret, { mode: 0o600 });
    expect(run(app, env)).toMatchObject({
      status: 1,
      output: expect.stringContaining("consérvalo en privado"),
    });
    expect(await readFile(path.join(lock, ".env"), "utf8")).toBe(secret);
    await rm(lock, { recursive: true });
    const failed = run(app, { ...env, SETUP_TEST_FAILURE: secret });
    expect(failed).toMatchObject({ status: 1, output: expect.stringContaining("código 31") });
    expect(failed.output).not.toContain(secret);
    await expect(access(location)).rejects.toMatchObject({ code: "ENOENT" });
  },
);

it.runIf(linux)(
  "comprueba las migraciones de SQLite y solo invoca bootstrap después de migrar Auth",
  async () => {
    const { root, app } = await project(auth);
    const { env, trace } = await npmFixture(root);
    const secret = randomBytes(24).toString("hex");
    const result = run(app, { ...env, SETUP_TEST_MIGRATION_FAILURE: secret });
    expect(result).toMatchObject({ status: 1, output: expect.stringContaining("código 37") });
    expect(result.output).not.toContain(secret);
    expect(await readFile(trace + ".db", "utf8")).toBe("migrate\n");
    expect(run(app, env).status).toBe(0);
    expect(await readFile(trace + ".db", "utf8")).toBe("migrate\nmigrate\nbootstrap\n");

    const plain = await project({ ...auth, auth: false });
    const plainFixture = await npmFixture(plain.root);
    expect(run(plain.app, plainFixture.env).output).toContain("npm run db:generate");
    await mkdir(path.join(plain.app, "backend/drizzle"), { recursive: true });
    await writeFile(path.join(plain.app, "backend/drizzle/0000_fixture.sql"), "SELECT 1;");
    expect(run(plain.app, plainFixture.env).status).toBe(0);
    expect(await readFile(plainFixture.trace + ".db", "utf8")).toBe("migrate\n");
  },
);

it.runIf(linux)("en Docker omite npm y prepara solo el entorno de Compose", async () => {
  const { root, app } = await project({ ...auth, database: "postgres", docker: true });
  const { env, trace } = await npmFixture(root);
  await writeFile(
    path.join(root, "docker"),
    '#!/bin/sh\ntest -z "$POSTGRES_PASSWORD$MIGRATION_DATABASE_URL$SETUP_TEST_AMBIENT" || exit 42\ncase "$*" in "--version"|"compose version") exit 0;; *) exit 1;; esac\n',
    { mode: 0o700 },
  );
  const ambient = randomBytes(32).toString("hex");
  const result = run(app, {
    ...env,
    PATH: root + path.delimiter + env.PATH,
    POSTGRES_PASSWORD: ambient,
    MIGRATION_DATABASE_URL: ambient,
    SETUP_TEST_AMBIENT: ambient,
  });
  expect(result).toMatchObject({
    status: 0,
    output: expect.stringContaining("Dependencias en el host: omitidas"),
  });
  await expect(access(trace)).rejects.toMatchObject({ code: "ENOENT" });
  await expect(access(path.join(app, "backend", ".env"))).rejects.toMatchObject({ code: "ENOENT" });
  const file = parseEnv(await readFile(path.join(app, ".env"), "utf8"));
  expect(file.LOGIN_ABUSE_HMAC_KEY).toMatch(/^[a-f0-9]{64}$/);
  expect(file.DATABASE_URL).toBe("");
  expect(file).not.toHaveProperty("POSTGRES_PASSWORD");
  expect(file).not.toHaveProperty("MIGRATION_DATABASE_URL");
  expect(result.output).toContain("Configuración pendiente: DATABASE_URL");
  expect(result.output).not.toContain(ambient);
  expect(result.output).toContain("el arranque asistido requiere una terminal");
  await expect(access(path.join(app, ".env.migration"))).rejects.toMatchObject({ code: "ENOENT" });
  await expect(access(path.join(app, "scripts/setup-docker.mjs"))).resolves.toBeUndefined();
});

it.runIf(linux)(
  "bloquea otra ejecución y cancela el árbol de instalación sin publicar el entorno",
  async () => {
    const { root, app } = await project(auth);
    const { env } = await npmFixture(root);
    const marker = path.join(root, "started");
    const heartbeat = path.join(root, "heartbeat");
    const child = spawn(process.execPath, ["scripts/setup.mjs"], {
      cwd: app,
      env: { ...env, SETUP_TEST_WAIT: marker, SETUP_TEST_HEARTBEAT: heartbeat },
      stdio: "ignore",
    });
    const exited = new Promise<number | null>((resolve) => child.once("close", resolve));
    try {
      await expect
        .poll(() =>
          access(marker).then(
            () => true,
            () => false,
          ),
        )
        .toBe(true);
      await expect
        .poll(() =>
          access(heartbeat).then(
            () => true,
            () => false,
          ),
        )
        .toBe(true);
      const simultaneous = run(app, env);
      expect(simultaneous).toMatchObject({
        status: 1,
        output: expect.stringContaining("podría seguir activo"),
      });
      child.kill("SIGTERM");
      expect(await exited).toBe(130);
      const stopped = await readFile(heartbeat, "utf8");
      await new Promise((resolve) => setTimeout(resolve, 150));
      expect(await readFile(heartbeat, "utf8")).toBe(stopped);
      await expect(access(path.join(app, "backend", ".env"))).rejects.toMatchObject({
        code: "ENOENT",
      });
      await expect(access(path.join(app, "backend", ".brixa-setup"))).rejects.toMatchObject({
        code: "ENOENT",
      });
      expect(run(app, env).status).toBe(0);
    } finally {
      child.kill("SIGTERM");
      await exited;
      const descendant = Number(await readFile(heartbeat + ".pid", "utf8").catch(() => ""));
      stopFixtureProcess(descendant);
    }
  },
);
