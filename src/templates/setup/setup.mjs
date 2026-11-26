import { spawn } from "node:child_process";
import { randomBytes } from "node:crypto";
import { constants } from "node:fs";
import { link, lstat, mkdir, open, readdir, rename, rmdir, unlink } from "node:fs/promises";
import path from "node:path";
import { parseEnv } from "node:util";
import project from "./setup.config.json" with { type: "json" };

const root = path.resolve(import.meta.dirname, "..");
const windows = process.platform === "win32";
const reserved = ["MIGRATION_DATABASE_URL", "PGPASSWORD", "PGPASSFILE"];
const secretNames = [...reserved, "POSTGRES_PASSWORD", "DATABASE_URL", "LOGIN_ABUSE_HMAC_KEY"];

class SetupError extends Error {}
const fail = (message) => {
  throw new SetupError(message);
};

async function statIfPresent(file) {
  try {
    return await lstat(file);
  } catch (error) {
    if (error.code !== "ENOENT") throw error;
  }
}

async function readFile(file, { optional = false, privateFile = false } = {}) {
  const entry = await statIfPresent(file);
  if (!entry && optional) return;
  const name = path.basename(file);
  if (!entry?.isFile()) fail(`Se requiere un archivo regular sin enlaces: ${name}.`);
  const handle = await open(
    file,
    constants.O_RDONLY | (constants.O_NOFOLLOW ?? 0) | (constants.O_NONBLOCK ?? 0),
  );
  try {
    const actual = await handle.stat();
    if (!actual.isFile() || actual.ino !== entry.ino || actual.dev !== entry.dev)
      fail(`El archivo cambió durante la comprobación: ${name}.`);
    if (
      privateFile &&
      (actual.nlink !== 1 ||
        (!windows && (actual.uid !== process.getuid() || (actual.mode & 0o077) !== 0)))
    )
      fail("El .env debe pertenecer al usuario actual, con permisos 0600 y sin enlaces.");
    return await handle.readFile("utf8");
  } finally {
    await handle.close();
  }
}

function pendingValues(content, creating) {
  const file = parseEnv(content);
  const composePg = project.docker && project.database === "postgres";
  const forbidden = composePg ? ["PGPASSWORD", "PGPASSFILE"] : [...reserved, "POSTGRES_PASSWORD"];
  const misplaced = forbidden.filter((name) => Object.hasOwn(file, name));
  if (misplaced.length)
    fail(`Retira del .env las credenciales reservadas: ${misplaced.join(", ")}.`);
  const values = project.docker ? file : { ...file, ...process.env };
  const issues = [];
  if (project.database === "postgres") {
    try {
      const url = new URL(values.DATABASE_URL);
      if (
        !["postgres:", "postgresql:"].includes(url.protocol) ||
        url.username !== "app_exec" ||
        !url.hostname ||
        !url.password ||
        url.password === "CLAVE" ||
        url.pathname.length < 2
      )
        issues.push("DATABASE_URL");
    } catch {
      issues.push("DATABASE_URL");
    }
  } else if (project.database === "sqlite" && !project.docker) {
    const sqlite = URL.parse(values.DATABASE_URL ?? "");
    if (
      sqlite?.protocol !== "file:" ||
      !sqlite.pathname ||
      decodeURIComponent(sqlite.pathname).endsWith("/:memory:") ||
      sqlite.searchParams.get("mode") === "memory"
    )
      issues.push("DATABASE_URL");
  }
  if (project.auth) {
    if (!/^[a-f0-9]{64}$/.test(values.LOGIN_ABUSE_HMAC_KEY ?? ""))
      issues.push("LOGIN_ABUSE_HMAC_KEY");
    const dockerTls = project.docker && project.modality === "fullstack";
    const origin = URL.parse(values.AUTH_PUBLIC_ORIGIN ?? "");
    const local =
      !project.docker &&
      values.NODE_ENV === "development" &&
      origin?.protocol === "http:" &&
      ["localhost", "127.0.0.1"].includes(origin.hostname);
    if (
      (project.cookie || values.AUTH_PUBLIC_ORIGIN) &&
      (!origin ||
        origin.origin !== values.AUTH_PUBLIC_ORIGIN ||
        (origin.protocol !== "https:" && !local))
    )
      issues.push("AUTH_PUBLIC_ORIGIN");
    if (!dockerTls) {
      const page = URL.parse(values.ACTIVATION_PAGE_URL ?? "");
      if (
        !page ||
        page.username ||
        page.password ||
        /[?#]/.test(values.ACTIVATION_PAGE_URL) ||
        (page.protocol !== "https:" && !(local && page.origin === origin.origin)) ||
        (project.cookie && page.origin !== origin?.origin)
      )
        issues.push("ACTIVATION_PAGE_URL");
    }
  }
  const pending = creating
    ? issues.filter(
        (name) =>
          !values[name] &&
          ((name === "DATABASE_URL" && project.database === "postgres") ||
            (name === "ACTIVATION_PAGE_URL" && project.modality === "backend")),
      )
    : composePg && !file.DATABASE_URL
      ? issues.filter((name) => name === "DATABASE_URL")
      : [];
  const invalid = issues.filter((name) => !pending.includes(name));
  if (invalid.length) fail(`Revisa las variables requeridas: ${invalid.join(", ")}.`);
  return pending;
}

function setExampleValue(content, name, value) {
  const pattern = new RegExp(`^${name}=.*$`, "gm");
  if ([...content.matchAll(pattern)].length !== 1) fail(`Revisa ${name} en .env.example.`);
  return content.replace(pattern, () => `${name}=${value}`);
}

async function prepareEnvironment(directory) {
  const destination = path.join(directory, ".env");
  const existing = await readFile(destination, { optional: true, privateFile: true });
  if (existing !== undefined) {
    return {
      content: existing,
      destination,
      previous: existing,
      pending: pendingValues(existing, false),
    };
  }
  if (process.platform !== "linux")
    fail(
      "Crea .env manualmente desde .env.example y protege sus permisos y ACL antes de repetir setup.",
    );

  const parent = await lstat(directory);
  if (parent.uid !== process.getuid() || (parent.mode & 0o022) !== 0)
    fail(
      "El directorio de .env debe pertenecer a tu usuario. Retira la escritura de grupo y otros antes de repetir setup.",
    );

  let content = await readFile(path.join(directory, ".env.example"));
  const example = parseEnv(content);
  if (project.auth && example.LOGIN_ABUSE_HMAC_KEY)
    fail("Retira LOGIN_ABUSE_HMAC_KEY de .env.example y guárdala solo en un .env privado.");
  if (project.auth && (project.docker || process.env.LOGIN_ABUSE_HMAC_KEY === undefined))
    content = setExampleValue(content, "LOGIN_ABUSE_HMAC_KEY", randomBytes(32).toString("hex"));
  if (project.database === "postgres") {
    if (example.DATABASE_URL && !/^postgresql:\/\/app_exec:CLAVE@/.test(example.DATABASE_URL))
      fail("Guarda DATABASE_URL solo en un .env privado. Revisa .env.example.");
    content = setExampleValue(content, "DATABASE_URL", "");
  }
  if (Object.hasOwn(example, "POSTGRES_PASSWORD"))
    fail("Proporciona POSTGRES_PASSWORD por separado a Compose. Revisa .env.example.");
  if (
    project.auth &&
    project.modality === "fullstack" &&
    !project.docker &&
    !example.ACTIVATION_PAGE_URL
  ) {
    const origin = parseEnv(content).AUTH_PUBLIC_ORIGIN;
    const url = URL.parse(origin ?? "");
    if (!url || origin !== url.origin || !["https:", "http:"].includes(url.protocol))
      fail("Revisa AUTH_PUBLIC_ORIGIN en .env.example.");
    content = setExampleValue(content, "ACTIVATION_PAGE_URL", url.origin + "/activate");
  }
  return { content, pending: pendingValues(content, true), destination };
}

let child;
let childGroup;
let stopping;
let interrupted = false;

function signalChild(signal) {
  if (childGroup) {
    try {
      process.kill(-childGroup, signal);
    } catch (error) {
      if (error.code !== "ESRCH") child?.kill(signal);
    }
  } else child?.kill(signal);
}

function stop() {
  interrupted = true;
  if (!child || stopping) return;
  signalChild("SIGTERM");
  stopping = setTimeout(() => signalChild("SIGKILL"), 2_000);
}

function checkInterruption(stage) {
  if (interrupted)
    fail(
      `${stage ? stage + ": " : ""}preparación interrumpida. Repite npm run setup para continuar.`,
    );
}

async function run(
  label,
  command,
  args,
  cwd,
  {
    installing = false,
    databaseEnv,
    tty = false,
    input,
    capture = false,
    exactEnv,
    failureHint,
    afterInterrupt = false,
    timeout,
  } = {},
) {
  if (!afterInterrupt) checkInterruption(label);
  console.log(`${label}…`);
  const env = { ...(exactEnv ?? process.env) };
  if (!exactEnv) for (const name of secretNames) delete env[name];
  Object.assign(env, databaseEnv);
  const timer = installing
    ? setInterval(() => console.log("  La instalación sigue en curso…"), 10_000)
    : undefined;
  const deadline =
    timeout === undefined ? undefined : setTimeout(() => signalChild("SIGKILL"), timeout);
  const separateGroup = !windows && (!tty || command === process.execPath);
  try {
    let output = "";
    let diagnostic = "";
    const result = await new Promise((resolve, reject) => {
      child = spawn(command, args, {
        cwd,
        env,
        detached: separateGroup,
        stdio: tty
          ? "inherit"
          : [
              input === undefined ? "ignore" : "pipe",
              capture ? "pipe" : "ignore",
              failureHint ? "pipe" : "ignore",
            ],
        windowsHide: true,
      });
      childGroup = separateGroup ? child.pid : undefined;
      child.stdout?.setEncoding("utf8").on("data", (chunk) => {
        output += chunk;
        if (output.length > 1_000_000) signalChild("SIGKILL");
      });
      child.stderr?.setEncoding("utf8").on("data", (chunk) => {
        diagnostic = (diagnostic + chunk).slice(-8192);
      });
      child.stdin?.on("error", () => {});
      child.stdin?.end(input);
      child.once("error", () => reject(new SetupError(`${label}: herramienta no disponible.`)));
      child.once("close", (code, signal) => resolve({ code, signal }));
    });
    if (result.code === 130 || result.signal === "SIGINT") interrupted = true;
    // A parent may exit before its descendants finish handling SIGTERM.
    if (!afterInterrupt) {
      if (interrupted && childGroup) signalChild("SIGKILL");
      checkInterruption(label);
    }
    if (result.code !== 0)
      fail(
        `${label}: falló (código ${result.code ?? "sin salida"}). ${failureHint?.(diagnostic) ?? "Consulta el README antes de reintentar."}`,
      );
    console.log("  OK");
    return output.trim();
  } finally {
    clearTimeout(stopping);
    stopping = undefined;
    child = undefined;
    childGroup = undefined;
    clearInterval(timer);
    clearTimeout(deadline);
  }
}

function npm(label, args, cwd, options) {
  return run(
    label,
    process.execPath,
    [process.env.npm_execpath, "--logs-max=0", ...args],
    cwd,
    options,
  );
}

function checkPostgres(backend, databaseEnv, withAuth = false) {
  const language = project.language === "ts" ? "ts" : "js";
  const check = withAuth
    ? `(await import("./src/db/check-auth-privileges.${language}")).checkAuthPrivileges`
    : "checkRuntimeIdentity";
  return run(
    withAuth ? "Comprobando privilegios de Auth" : "Comprobando el rol de ejecución PostgreSQL",
    process.execPath,
    [
      ...(language === "ts" ? ["--import", "tsx"] : []),
      "--input-type=module",
      "--eval",
      `const { pool, checkRuntimeIdentity } = await import("./src/db/client.${language}");
try { await (${check})(); } finally { await pool.end(); }`,
    ],
    backend,
    { databaseEnv },
  );
}

async function prepareDatabase(backend, plan) {
  if (project.database === "none") return;
  const directory = path.join(backend, "drizzle");
  const migrations = await statIfPresent(directory);
  if (migrations && !migrations.isDirectory())
    fail("Se requiere un directorio drizzle sin enlaces.");
  const entries = migrations ? await readdir(directory, { withFileTypes: true }) : [];
  if (!entries.some((entry) => entry.isFile() && entry.name.endsWith(".sql"))) {
    if (project.auth) fail("Faltan las migraciones incluidas de Auth en el directorio drizzle.");
    console.log("Pendiente: define el esquema y ejecuta npm run db:generate antes de migrar.");
    return;
  }

  const settings = parseEnv(plan.content);
  const runtimeUrl = process.env.DATABASE_URL ?? settings.DATABASE_URL;
  const runtime = { DATABASE_URL: runtimeUrl };
  let operation = runtime;
  if (project.database === "postgres") {
    const migrationUrl = process.env.MIGRATION_DATABASE_URL;
    if (!runtimeUrl || !migrationUrl) {
      const missing = [!runtimeUrl && "DATABASE_URL", !migrationUrl && "MIGRATION_DATABASE_URL"];
      console.log(
        `Migraciones pendientes: proporciona ${missing.filter(Boolean).join(" y ")} tras aprovisionar PostgreSQL.`,
      );
      return;
    }
    const app = URL.parse(runtimeUrl);
    const owner = URL.parse(migrationUrl);
    if (
      !owner ||
      !["postgres:", "postgresql:"].includes(owner.protocol) ||
      !owner.password ||
      owner.username !== "table_owner"
    )
      fail("MIGRATION_DATABASE_URL debe identificar el rol table_owner.");
    const target = (url) =>
      [url.hostname.toLowerCase(), url.port || "5432", decodeURIComponent(url.pathname)].join("/");
    if (!app || target(app) !== target(owner))
      fail(
        "DATABASE_URL y MIGRATION_DATABASE_URL deben apuntar al mismo servidor y base de datos.",
      );
    await checkPostgres(backend, runtime);
    operation = { MIGRATION_DATABASE_URL: migrationUrl };
  }
  await npm("Aplicando migraciones pendientes", ["run", "--silent", "db:migrate"], backend, {
    databaseEnv: operation,
  });
  if (!project.auth) return;
  if (project.database === "postgres") await checkPostgres(backend, runtime, true);
  const bootstrapEnv = { ...operation };
  for (const name of ["AUTH_PASSWORD_MIN_LENGTH", "AUTH_PASSWORD_MAX_LENGTH"]) {
    const value = process.env[name] ?? settings[name];
    if (value !== undefined) bootstrapEnv[name] = value;
  }
  await npm(
    "Comprobando el administrador inicial",
    ["run", "--silent", "auth:bootstrap", "--", "--if-needed"],
    backend,
    { databaseEnv: bootstrapEnv, tty: true },
  );
}

async function publish(plan, lock) {
  const staged = path.join(lock, ".env");
  const handle = await open(staged, "wx", 0o600);
  try {
    try {
      if (((await handle.stat()).mode & 0o777) !== 0o600)
        fail("No se pudo garantizar el modo 0600 para .env.");
      await handle.writeFile(plan.content);
      await handle.sync();
    } finally {
      await handle.close();
    }
    checkInterruption();
    if (plan.previous === undefined) await link(staged, plan.destination);
    else {
      if ((await readFile(plan.destination, { privateFile: true })) !== plan.previous)
        fail("El .env cambió durante setup. Revisa la configuración antes de reintentar.");
      checkInterruption();
      await rename(staged, plan.destination);
    }
  } finally {
    if (await statIfPresent(staged)) await unlink(staged);
  }
}

async function setup() {
  const major = Number(process.versions.node.split(".")[0]);
  if (major !== 24 && major < 26) fail("Se requiere Node.js 24 o 26 en adelante.");
  console.log("Preparación de Brixa: comprobaciones, dependencias y entorno.");
  const applications = project.modality === "fullstack" ? ["backend", "frontend"] : ["."];
  for (const directory of applications) {
    const location = path.join(root, directory);
    if (!(await lstat(location)).isDirectory())
      fail(`Directorio de aplicación inválido: ${directory}.`);
    await readFile(path.join(location, "package.json"));
  }
  const directory = path.join(root, project.environment ?? ".");
  const lock = path.join(directory, ".brixa-setup");
  const owner = path.join(lock, "pid");
  try {
    await mkdir(lock, { mode: 0o700 });
  } catch (error) {
    if (error.code === "EEXIST") {
      let pid;
      if ((await statIfPresent(lock))?.isDirectory()) {
        try {
          const value = await readFile(owner, { optional: true, privateFile: true });
          if (/^[1-9]\d{0,9}\n$/.test(value ?? "") && Number(value) <= 2147483647)
            pid = Number(value);
        } catch {
          // An existing lock may have been created by an older setup.
        }
      }
      if (pid) {
        let absent = false;
        try {
          process.kill(pid, 0);
        } catch (probe) {
          absent = probe.code === "ESRCH";
        }
        if (!absent)
          fail(
            `Ya existe .brixa-setup y el PID ${pid} podría seguir activo. Espera y vuelve a comprobarlo.`,
          );
      }
      const lockLabel = path.posix.join(project.environment ?? ".", ".brixa-setup");
      fail(
        `Ya existe ${lockLabel}. Confirma que no queden procesos de setup o Compose activos. Si contiene un .env provisional, consérvalo en privado para revisarlo antes de retirar el bloqueo y reintentar.`,
      );
    }
    throw error;
  }
  let recordedOwner = false;
  try {
    const handle = await open(owner, "wx", 0o600);
    recordedOwner = true;
    try {
      await handle.writeFile(String(process.pid) + "\n");
    } finally {
      await handle.close();
    }
    if (project.docker) {
      await readFile(path.join(root, "compose.yaml"));
    } else {
      if (!process.env.npm_execpath) fail("Ejecuta el asistente con npm run setup.");
      await run("Comprobando npm", process.execPath, [process.env.npm_execpath, "--version"], root);
    }

    const envLabel = path.posix.join(project.environment ?? ".", ".env");
    const plan = project.environment === null ? undefined : await prepareEnvironment(directory);
    if (project.environment === null)
      console.log("Entorno: omitido, la variante no requiere .env.");
    else if (plan.previous !== undefined)
      console.log(`Entorno: ${envLabel} reutilizado sin cambios.`);
    else console.log(`Entorno: ${envLabel} preparado para creación.`);

    if (project.docker)
      console.log("Dependencias en el host: omitidas. Docker las instala al construir.");
    else {
      for (const app of applications) {
        await npm(
          `Instalando dependencias en ${app}`,
          ["install", "--loglevel=silent", "--no-audit", "--no-fund"],
          path.join(root, app),
          { installing: true },
        );
      }
    }
    if (plan && plan.previous === undefined) {
      await publish(plan, lock);
      plan.previous = plan.content;
      console.log(`Entorno: ${envLabel} creado con permisos 0600.`);
      if (plan.pending.length) console.log(`Configuración pendiente: ${plan.pending.join(", ")}.`);
    }
    checkInterruption();
    const backend = path.join(root, project.modality === "fullstack" ? "backend" : ".");
    if (project.docker) {
      const { setupDocker } = await import("./setup-docker.mjs");
      await setupDocker({
        project,
        root,
        backend,
        plan,
        run,
        fail,
        readFile,
        wasInterrupted: () => interrupted,
        publish: (next) => publish(next, lock),
      });
    } else {
      await prepareDatabase(backend, plan);
      console.log("Sigue el README para completar la configuración e iniciar la aplicación.");
    }
  } finally {
    if (recordedOwner) await unlink(owner);
    await rmdir(lock);
  }
}

process.on("SIGINT", stop);
process.on("SIGTERM", stop);
try {
  await setup();
} catch (error) {
  console.error(
    interrupted && !(error instanceof SetupError)
      ? "Preparación interrumpida. Repite npm run setup para continuar."
      : error instanceof SetupError
        ? error.message
        : "No se pudo preparar el proyecto. Revisa la estructura y los permisos.",
  );
  console.error(
    "Las etapas marcadas OK terminaron. Revisa las pendientes y conserva los datos, credenciales y recursos ya creados.",
  );
  process.exitCode = interrupted ? 130 : 1;
} finally {
  process.off("SIGINT", stop);
  process.off("SIGTERM", stop);
}
