import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import { once } from "node:events";
import { chmod, mkdir, readFile, writeFile } from "node:fs/promises";
import https from "node:https";
import net from "node:net";
import path from "node:path";
import { URL } from "node:url";
import { redact } from "../../../src/templates/backend-express-js/src/redact.js";
import { executeCommand } from "../../mutation-engine.js";
import {
  address,
  bootstrapSource,
  command,
  forwardAuthApi,
  hostname,
  proxyAddress,
  secret,
  trustedForwardingHeaders,
} from "../../verify-auth-https.js";
import { provisionPostgres, runStep } from "../../verify-auth.js";
import { startBackendServer, stopProcess } from "../../verify-generated.js";

const mime = {
  ".html": "text/html",
  ".js": "text/javascript",
  ".css": "text/css",
  ".png": "image/png",
  ".svg": "image/svg+xml",
};

async function listen(server, cleanup) {
  server.listen(0, address);
  await once(server, "listening");
  cleanup.defer(async () => {
    const closed = once(server, "close");
    server.close();
    server.closeAllConnections?.();
    await closed;
  });
  return `https://${hostname}:${server.address().port}`;
}

function authEnv(origin, database, proxy) {
  return {
    ...Object.fromEntries(
      Object.keys(process.env)
        .filter((name) =>
          /^(?:PG|AUTH_|ARGON2_|SESSION_|ACTIVATION_|LOGIN_|DATABASE_|MIGRATION_|POSTGRES_|CORS_|COMPOSE_|ENABLE_API_DOCS$)/i.test(
            name,
          ),
        )
        .map((name) => [name, undefined]),
    ),
    DATABASE_URL: database,
    AUTH_PUBLIC_ORIGIN: origin,
    ...(proxy && { AUTH_TRUSTED_PROXIES: proxy, ACTIVATION_PAGE_URL: origin + "/activate" }),
    LOGIN_ABUSE_HMAC_KEY: secret(),
  };
}

function bootstrapEnv(admin) {
  return { BRIXA_FIXTURE_EMAIL: admin.email, BRIXA_FIXTURE_PASSWORD: admin.password };
}

export async function startSqliteUi({ project, workspace, tls, csp, admin, cleanup, signal }) {
  const cwd = path.join(project, "backend");
  const dist = path.join(project, "frontend", "dist");
  let backend;
  const server = https.createServer(tls, async (req, res) => {
    const pathname = new URL(req.url, "https://fixture.test").pathname;
    if (pathname.startsWith("/api/")) {
      if (!backend) return res.writeHead(503).end();
      forwardAuthApi(req, res, backend.port, trustedForwardingHeaders(req));
      return;
    }
    const ext = path.extname(pathname);
    if (ext && !Object.hasOwn(mime, ext)) return res.writeHead(404).end();
    try {
      const body = await readFile(path.join(dist, ext ? pathname : "index.html"));
      res
        .writeHead(200, {
          "Content-Type": mime[ext || ".html"],
          "Content-Security-Policy": csp,
          "Referrer-Policy": "no-referrer",
          "X-Content-Type-Options": "nosniff",
        })
        .end(body);
    } catch {
      res.writeHead(404).end();
    }
  });
  const origin = await listen(server, cleanup);
  const env = authEnv(origin, `file:${path.join(workspace, "auth.db")}`, proxyAddress);
  await runStep("Instalación backend SQLite", "npm", ["install", "--no-audit", "--no-fund"], cwd, {
    timeoutMs: 300_000,
    signal,
  });
  await runStep("Migración SQLite", "npm", ["run", "db:migrate"], cwd, {
    env,
    timeoutMs: 60_000,
    signal,
    sensitive: true,
  });
  await runStep(
    "Bootstrap SQLite",
    process.execPath,
    ["--input-type=module", "-e", bootstrapSource("src")],
    cwd,
    {
      env: { ...env, ...bootstrapEnv(admin) },
      timeoutMs: 60_000,
      signal,
      sensitive: true,
    },
  );
  // El backend generado solo es accesible por loopback en esta fixture.
  const entry = path.join(cwd, "src/index.js");
  const source = await readFile(entry, "utf8");
  const isolated = source.replace("app.listen(port, ", `app.listen(port, "${address}", `);
  assert.notEqual(isolated, source, "No se encontró el listener del backend JavaScript.");
  await writeFile(entry, isolated);
  backend = await startBackendServer(cwd, "src/index.js", env, {
    sanitizeOutput: (line) => redact(line.replaceAll(env.LOGIN_ABUSE_HMAC_KEY, "***")),
  });
  cleanup.defer(() => stopProcess(backend.child));
  return origin;
}

async function startFixturePostgres(composeStep, env) {
  for (let attempt = 0; attempt < 8; attempt += 1) {
    const [second, third] = randomBytes(2);
    const block = `10.${second}.${third}`;
    // Compose reserva la red del proyecto al arrancar PostgreSQL.
    env.TLS_SUBNET = `${block}.0/28`;
    env.TLS_DYNAMIC_RANGE = `${block}.8/29`;
    env.TLS_NGINX_IP = `${block}.2`;
    let overlap = false;
    try {
      return await composeStep(
        "Arranque PostgreSQL",
        ["up", "-d", "--wait", "postgres"],
        {},
        120_000,
        ({ stdout, stderr }) => {
          overlap = /pool overlaps with other one on this address space/i.test(
            `${stdout}\n${stderr}`,
          );
        },
      );
    } catch (error) {
      if (!overlap || attempt === 7) throw error;
    }
  }
}

export async function reportComposeStartupFailure(result, compose, project, env) {
  const inspect = (args) =>
    executeCommand("docker", [...compose, ...args], project, { env, timeoutMs: 5_000 });
  const [status, logs] = await Promise.all([
    inspect(["ps", "--all", "--format", "{{.Service}} {{.State}} {{.Health}} {{.ExitCode}}"]),
    inspect(["logs", "--no-color", "--tail", "20", "backend", "frontend"]),
  ]);
  const output = [result.stderr, result.stdout, logs.stdout, logs.stderr].join("\n");
  // Emite motivos conocidos, nunca texto libre de Docker ni de los contenedores.
  const reasons = [
    [
      /user specified IP address.*user configured subnets/i,
      "Docker exige una subred explícita para asignar la IP fija de Nginx.",
    ],
    [
      /address already in use|port is already allocated|failed to bind host port/i,
      "No se pudo publicar un puerto.",
    ],
    [/invalid mount config|bind source path does not exist/i, "Docker rechazó un montaje."],
    [
      /cannot load certificate|SSL_CTX_use_PrivateKey/i,
      "Nginx no pudo cargar el certificado TLS o su clave.",
    ],
    [/host not found in upstream/i, "Nginx no pudo resolver el backend."],
    [/is unhealthy|healthcheck failed/i, "Falló un healthcheck."],
    [
      /backend recibió credenciales reservadas|Identidad o URL PostgreSQL inválida/i,
      "Express rechazó la configuración PostgreSQL de ejecución.",
    ],
  ]
    .filter(([pattern]) => pattern.test(output))
    .map(([, reason]) => reason);
  const states = status.stdout
    .split(/\r?\n/)
    .filter((line) =>
      /^(postgres|backend|frontend) (created|restarting|running|removing|paused|exited|dead) (starting|healthy|unhealthy)? \d{1,3}$/.test(
        line,
      ),
    );
  console.error(
    "Diagnóstico de arranque Compose\n" +
      (reasons.length ? reasons.join("\n") : "No se reconoció el motivo en la salida capturada.") +
      "\nServicios (estado, salud y salida)\n" +
      (states.length ? states.join("\n") : "Estado de servicios no disponible."),
  );
}

export async function startFixtureRelay(cleanup) {
  let targetPort;
  const sockets = new Set();
  // Reserva el origen efímero. El relay no termina TLS; eso lo hace el Nginx generado.
  const relay = net.createServer((client) => {
    if (!targetPort) return client.destroy();
    const upstream = net.connect(targetPort, address);
    for (const socket of [client, upstream]) {
      sockets.add(socket);
      socket.on("close", () => sockets.delete(socket));
    }
    client.on("error", () => upstream.destroy());
    upstream.on("error", () => client.destroy());
    client.on("close", () => upstream.destroy());
    upstream.on("close", () => client.destroy());
    client.pipe(upstream).pipe(client);
  });
  const origin = await listen(relay, cleanup);
  cleanup.defer(() => {
    for (const socket of sockets) socket.destroy();
  });
  return {
    origin,
    setTargetPort(port) {
      targetPort = port;
    },
  };
}

export async function startDockerUi({ project, workspace, admin, cleanup, signal }) {
  const name = "brixa-auth-ui-" + secret().slice(0, 12);
  const docker = (label, args, options) =>
    command(label, "docker", args, {
      cwd: project,
      encoding: "utf8",
      ...options,
    }).trim();
  const version = (label, args, minimum) => {
    const output = docker(label, args);
    const numbers = /^v?(\d+)\.(\d+)\.(\d+)/.exec(output)?.slice(1).map(Number);
    const difference = numbers?.map((number, index) => number - minimum[index]).find(Boolean);
    assert(
      numbers && (difference ?? 0) >= 0,
      `${label}: el modo TLS requiere ${minimum.join(".")} o posterior.`,
    );
  };
  version("Docker Engine", ["version", "--format", "{{.Server.Version}}"], [28, 0, 0]);
  version("Docker Compose", ["compose", "version", "--short"], [2, 24, 4]);
  const { origin, setTargetPort } = await startFixtureRelay(cleanup);

  const keyDir = path.join(workspace, "nginx-key");
  const env = {
    ...authEnv(origin, "postgresql://app_exec:unprovisioned@postgres:5432/app"),
    POSTGRES_PASSWORD: secret(),
    ENABLE_API_DOCS: "true",
    TLS_PORT: "0",
    TLS_CERT_PATH: path.join(workspace, "tls.pem"),
    TLS_KEY_PATH: path.join(keyDir, "tls.key"),
  };
  const compose = [
    "compose",
    "--project-name",
    name,
    "-f",
    "compose.yaml",
    "-f",
    "compose.tls.yaml",
  ];
  const composeStep = (label, args, extraEnv = {}, timeoutMs = 120_000, onFailure) =>
    runStep(label, "docker", [...compose, ...args], project, {
      env: { ...env, ...extraEnv },
      timeoutMs,
      signal,
      sensitive: true,
      onFailure,
    });

  cleanup.defer(() =>
    runStep(
      "Limpieza Compose",
      "docker",
      [...compose, "down", "--volumes", "--rmi", "local", "--remove-orphans"],
      project,
      {
        env,
        timeoutMs: 120_000,
        sensitive: true,
      },
    ),
  );
  await startFixturePostgres(composeStep, env);
  const containerName = docker("Identificar PostgreSQL", [...compose, "ps", "-q", "postgres"], {
    env: { ...process.env, ...env },
  });
  assert(containerName, "Compose no devolvió el contenedor PostgreSQL.");
  const connection = await provisionPostgres(
    { containerName, database: "app", user: "postgres", port: 5432 },
    path.join(project, "backend"),
    "postgres",
  );
  env.DATABASE_URL = connection.DATABASE_URL;
  await composeStep("Build Compose", ["build", "backend", "frontend"], {}, 600_000);
  signal?.throwIfAborted();
  // El directorio padre es privado. Solo el helper usa el GID anfitrión para crear la copia.
  const gid = process.getgid();
  assert(gid > 0, "La fixture TLS necesita un GID anfitrión no root.");
  await mkdir(keyDir, { mode: 0o700 });
  await chmod(keyDir, 0o730);
  try {
    docker(
      "Preparar clave del UID 101",
      [
        "run",
        "--rm",
        "--pull",
        "never",
        "--network",
        "none",
        "--read-only",
        "--cap-drop",
        "ALL",
        "--security-opt",
        "no-new-privileges",
        "--user",
        `101:${gid}`,
        "-i",
        "--mount",
        `type=bind,source=${keyDir},target=/key`,
        "--entrypoint",
        "sh",
        `${name}-frontend`,
        "-ec",
        "umask 0377; cat > /key/tls.key",
      ],
      { input: await readFile(path.join(workspace, "tls.key")), timeout: 15_000 },
    );
  } finally {
    await chmod(keyDir, 0o700);
  }
  const runOwner = ["run", "--rm", "--no-deps", "-T", "-e", "MIGRATION_DATABASE_URL"];
  const ownerEnv = { MIGRATION_DATABASE_URL: connection.MIGRATION_DATABASE_URL };
  await composeStep(
    "Migración PostgreSQL",
    [...runOwner, "backend", "node", "dist/db/migrate.js"],
    ownerEnv,
  );
  await composeStep(
    "Bootstrap PostgreSQL",
    [
      ...runOwner,
      "-e",
      "BRIXA_FIXTURE_EMAIL",
      "-e",
      "BRIXA_FIXTURE_PASSWORD",
      "backend",
      "node",
      "--input-type=module",
      "-e",
      bootstrapSource("dist", true),
    ],
    { ...ownerEnv, ...bootstrapEnv(admin) },
  );
  await composeStep("Arranque Nginx y Express", ["up", "-d", "--wait"], {}, 120_000, (result) =>
    reportComposeStartupFailure(result, compose, project, env),
  );
  const port = docker("Consultar puerto TLS", [...compose, "port", "frontend", "8443"], {
    env: { ...process.env, ...env },
  });
  assert(/^127\.0\.0\.1:\d+$/.test(port), "Nginx debe publicar TLS solo en loopback.");
  setTargetPort(Number(port.split(":")[1]));
  // V4 comprueba los mismos archivos que sirve Nginx.
  await mkdir(path.join(project, "frontend", "dist"), { recursive: true });
  await composeStep("Extraer build de Nginx", [
    "cp",
    "frontend:/usr/share/nginx/html/.",
    "frontend/dist",
  ]);
  return origin;
}
