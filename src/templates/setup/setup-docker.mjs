import { createHash, randomBytes, randomUUID, X509Certificate } from "node:crypto";
import { chmod, lstat, mkdtemp, readdir, realpath } from "node:fs/promises";
import { get } from "node:https";
import path from "node:path";
import { createInterface } from "node:readline/promises";
import { isIPv4 } from "node:net";
import { parseEnv } from "node:util";

const privileged = ["POSTGRES_PASSWORD", "MIGRATION_DATABASE_URL", "PGPASSWORD", "PGPASSFILE"];
const secret = () => randomBytes(32).toString("hex");

async function ask(question) {
  const terminal = createInterface({ input: process.stdin, output: process.stdout });
  const controller = new AbortController();
  const cancel = () => controller.abort();
  terminal.once("SIGINT", cancel);
  terminal.once("close", cancel);
  process.once("SIGINT", cancel);
  process.once("SIGTERM", cancel);
  try {
    return (await terminal.question(question, { signal: controller.signal })).trim();
  } finally {
    terminal.close();
    process.off("SIGINT", cancel);
    process.off("SIGTERM", cancel);
  }
}

function external(file, root) {
  const relative = path.relative(root, file);
  return relative === ".." || relative.startsWith("../");
}

function versionAtLeast(version, minimum) {
  const match = /^v?(\d+)\.(\d+)\.(\d+)/.exec(version);
  if (!match) return false;
  for (const [index, required] of minimum.entries()) {
    const current = Number(match[index + 1]);
    if (current !== required) return current > required;
  }
  return true;
}

function ipv4Number(address) {
  return address.split(".").reduce((value, part) => value * 256 + Number(part), 0);
}

function subnet(cidr) {
  const [ip, bits] = cidr?.split("/") ?? [];
  if (!isIPv4(ip ?? "") || !/^\d+$/.test(bits ?? "") || Number(bits) > 32) return;
  const size = 2 ** (32 - Number(bits));
  const first = ipv4Number(ip);
  if (first % size === 0) return { first, last: first + size - 1 };
}

async function checkHttps(origin, ca, fail) {
  const healthy = await new Promise((resolve) => {
    const request = get(
      new URL("/api/health", origin),
      { ca, family: 4, timeout: 5_000 },
      (response) => {
        response.resume();
        resolve(response.statusCode === 200);
      },
    );
    request.on("error", () => resolve(false));
    request.on("timeout", () => request.destroy());
  });
  if (!healthy) fail("El servicio no respondió por HTTPS con la CA configurada.");
}

async function prepareTls({ root, settings, exec, fail, readFile, update }) {
  const choice = await ask("HTTPS local ([e]xistente, [g]enerar con mkcert, [p]endiente): ");
  if (choice !== "e" && choice !== "g") return false;
  const origin = URL.parse(settings.AUTH_PUBLIC_ORIGIN ?? "");
  const port = Number(settings.TLS_PORT || "8443");
  if (
    origin?.protocol !== "https:" ||
    origin.origin !== settings.AUTH_PUBLIC_ORIGIN ||
    !["localhost", "127.0.0.1"].includes(origin.hostname) ||
    (Number(origin.port) || 443) !== port ||
    !Number.isInteger(port) ||
    port < 1 ||
    port > 65535
  )
    fail("Ajusta AUTH_PUBLIC_ORIGIN y TLS_PORT al mismo origen HTTPS de loopback.");

  const composeVersion = await exec(
    "Comprobando versión de Compose para TLS",
    ["compose", "version", "--short"],
    { capture: true },
  );
  const engineVersion = await exec(
    "Comprobando versión del motor para TLS",
    ["version", "--format", "{{.Server.Version}}"],
    { capture: true },
  );
  if (!versionAtLeast(composeVersion, [2, 24, 4]) || !versionAtLeast(engineVersion, [28, 0, 0]))
    fail("HTTPS requiere Docker Engine 28.0.0 y Docker Compose 2.24.4 o posteriores.");

  if (choice === "g") {
    if (settings.TLS_CERT_PATH || settings.TLS_KEY_PATH)
      fail("Ya hay rutas TLS configuradas. Selecciona el certificado existente.");
    const parent = await realpath(
      await ask("Directorio existente fuera del proyecto para la emisión: "),
    );
    const stat = await lstat(parent);
    if (
      !stat.isDirectory() ||
      !external(parent, root) ||
      stat.uid !== process.getuid() ||
      stat.mode & 0o022
    )
      fail("La emisión requiere un directorio externo del usuario sin escritura de grupo u otros.");
    const caRoot = await exec(
      "Localizando la CA de mkcert",
      ["-CAROOT"],
      { capture: true },
      "mkcert",
    );
    const ca = await realpath(path.join(caRoot, "rootCA.pem"));
    if (!external(ca, root)) fail("La CA de mkcert debe estar fuera del proyecto.");
    await readFile(ca);
    await lstat(path.join(caRoot, "rootCA-key.pem"));
    const directory = await mkdtemp(path.join(parent, "brixa-tls-"));
    const cert = path.join(directory, "tls.crt");
    const key = path.join(directory, "tls.key");
    await exec(
      "Emitiendo certificado local con la CA existente",
      ["-cert-file", cert, "-key-file", key, origin.hostname],
      {},
      "mkcert",
    );
    await chmod(key, 0o400);
    await chmod(cert, 0o644);
    await update({ TLS_CERT_PATH: cert, TLS_KEY_PATH: key, TLS_CA_PATH: ca });
    console.log(
      "Certificado emitido. Comprueba manualmente el acceso de Nginx a la clave y la confianza de la CA en el navegador.",
    );
  }

  for (const name of ["TLS_CERT_PATH", "TLS_KEY_PATH", "TLS_CA_PATH"]) {
    const file = settings[name];
    if (
      !file ||
      !path.isAbsolute(file) ||
      /[\r\n,:]/.test(file) ||
      !external(await realpath(file), root) ||
      !(await lstat(file)).isFile()
    )
      fail("Configura " + name + " con un archivo regular absoluto fuera del proyecto.");
  }
  const key = await lstat(settings.TLS_KEY_PATH);
  if ((key.mode & 0o777) !== 0o400 || key.nlink !== 1)
    fail("La clave TLS debe tener permisos 0400 y un único enlace.");
  const cert = new X509Certificate(await readFile(settings.TLS_CERT_PATH));
  const hostMatches = isIPv4(origin.hostname)
    ? cert.checkIP(origin.hostname)
    : cert.checkHost(origin.hostname, { subject: "never" });
  if (!hostMatches) fail("El SAN del certificado no cubre el origen HTTPS.");
  await exec(
    "Comprobando vigencia y cadena del certificado TLS",
    [
      "verify",
      "-purpose",
      "sslserver",
      "-CAfile",
      settings.TLS_CA_PATH,
      "-untrusted",
      settings.TLS_CERT_PATH,
      isIPv4(origin.hostname) ? "-verify_ip" : "-verify_hostname",
      origin.hostname,
      settings.TLS_CERT_PATH,
    ],
    {},
    "openssl",
  );
  console.log(
    "Cadena verificada contra TLS_CA_PATH. La confianza del navegador se configura manualmente.",
  );
  if (key.uid !== 101) {
    console.log("HTTPS pendiente: el operador debe preparar la clave para el UID 101 de Nginx.");
    return false;
  }
  return true;
}

function checkCompose(config, project, backend, root, tls, settings, fail) {
  const services = config.services;
  const expected = [
    "backend",
    ...(project.modality === "fullstack" ? ["frontend"] : []),
    ...(project.database === "postgres" ? ["postgres"] : []),
  ];
  if (Object.keys(services).sort().join() !== expected.sort().join())
    fail("Setup solo admite los servicios Compose generados.");
  for (const name of expected) {
    const service = services[name];
    if (
      service.env_file ||
      service.secrets ||
      (service.build &&
        (service.build.args || service.build.secrets || service.build.additional_contexts))
    )
      fail("El Compose modificado puede transmitir secretos a un contenedor o al build.");
    if (
      name !== "postgres" &&
      privileged.some((key) => Object.hasOwn(service.environment ?? {}, key))
    )
      fail("Compose entrega credenciales privilegiadas a un servicio de aplicación.");
  }
  if (
    services.backend.build?.context !== backend ||
    (services.frontend && services.frontend.build?.context !== path.join(root, "frontend"))
  )
    fail("Los contextos de construcción difieren de los generados.");
  if (
    services.postgres &&
    (services.postgres.ports?.length ||
      services.postgres.image !== "postgres:17.4-alpine" ||
      services.postgres.command ||
      services.postgres.entrypoint ||
      Object.keys(services.postgres.environment ?? {})
        .sort()
        .join() !== "POSTGRES_DB,POSTGRES_PASSWORD,POSTGRES_USER")
  )
    fail("PostgreSQL debe permanecer interno y recibir solo sus variables de administración.");
  if (services.postgres) {
    const effective = structuredClone(config);
    delete effective.services.postgres.environment.POSTGRES_PASSWORD;
    const rendered = JSON.stringify(effective);
    const owner = URL.parse(settings.MIGRATION_DATABASE_URL ?? "");
    if (
      [
        settings.MIGRATION_DATABASE_URL,
        settings.POSTGRES_PASSWORD,
        owner && decodeURIComponent(owner.password),
      ].some((value) => value?.length >= 12 && rendered.includes(value))
    )
      fail("La configuración Compose interpoló credenciales privilegiadas fuera de PostgreSQL.");
  }
  if (tls) {
    const ports = services.frontend.ports ?? [];
    const frontend = services.frontend;
    const mounts = new Map(frontend.volumes?.map((mount) => [mount.target, mount]));
    const ipam = config.networks.default?.ipam?.config ?? [];
    const network = subnet(ipam[0]?.subnet);
    const dynamic = subnet(ipam[0]?.ip_range);
    const nginx = isIPv4(settings.TLS_NGINX_IP ?? "") ? ipv4Number(settings.TLS_NGINX_IP) : -1;
    if (
      services.backend.ports?.length ||
      ports.length !== 1 ||
      ports[0].host_ip !== "127.0.0.1" ||
      ports[0].target !== 8443 ||
      Number(ports[0].published) !== Number(settings.TLS_PORT || "8443") ||
      frontend.networks.default.ipv4_address !== settings.TLS_NGINX_IP ||
      services.backend.environment.AUTH_TRUSTED_PROXIES !== settings.TLS_NGINX_IP ||
      services.backend.environment.AUTH_PUBLIC_ORIGIN !== settings.AUTH_PUBLIC_ORIGIN ||
      services.backend.environment.ACTIVATION_PAGE_URL !==
        settings.AUTH_PUBLIC_ORIGIN + "/activate" ||
      ipam.length !== 1 ||
      !network ||
      !dynamic ||
      dynamic.first < network.first ||
      dynamic.last > network.last ||
      nginx <= network.first + 1 ||
      nginx >= network.last ||
      (nginx >= dynamic.first && nginx <= dynamic.last) ||
      ![
        ["/etc/nginx/tls.crt", settings.TLS_CERT_PATH],
        ["/etc/nginx/tls.key", settings.TLS_KEY_PATH],
        ["/etc/nginx/conf.d/default.conf", path.join(root, "frontend/nginx.tls.conf")],
      ].every(([target, source]) => {
        const mount = mounts.get(target);
        return mount?.read_only && mount.type === "bind" && mount.source === source;
      })
    )
      fail("El override TLS efectivo no conserva los puertos, proxy o montajes de D-114.");
  }
}

export async function setupDocker({
  project,
  root,
  backend,
  plan,
  run,
  fail,
  readFile,
  wasInterrupted,
  publish,
}) {
  const env = Object.fromEntries(
    [
      "PATH",
      "HOME",
      "USER",
      "LOGNAME",
      "LANG",
      "TMPDIR",
      "XDG_CONFIG_HOME",
      "DOCKER_CONFIG",
      "CAROOT",
    ]
      .filter((key) => process.env[key] !== undefined)
      .map((key) => [key, process.env[key]]),
  );
  const exec = (label, args, flags = {}, command = "docker") =>
    run(label, command, args, root, { exactEnv: env, ...flags });
  await exec("Comprobando Docker", ["--version"]);
  await exec("Comprobando Compose", ["compose", "version"]);
  const tlsCapable = project.auth && project.modality === "fullstack";
  if (process.platform !== "linux" || !process.stdin.isTTY || !process.stdout.isTTY) {
    console.log(
      "Docker pendiente: el arranque asistido requiere una terminal en Linux. Consulta el README.",
    );
    return;
  }
  if ((await ask("¿Preparar el proyecto con Docker Compose? [s/N] ")) !== "s") {
    console.log("Docker pendiente: seleccionaste la preparación manual.");
    return;
  }
  const stat = await lstat(root);
  if (stat.uid !== process.getuid() || stat.mode & 0o022)
    fail("El directorio del proyecto debe pertenecer al usuario y excluir escritura de terceros.");
  if (process.env.DOCKER_HOST || process.env.DOCKER_CONTEXT)
    fail("Desactiva DOCKER_HOST y DOCKER_CONTEXT y selecciona un contexto Docker local.");
  const host = await exec(
    "Verificando el contexto local de Docker",
    ["context", "inspect", "--format", "{{.Endpoints.docker.Host}}"],
    { capture: true },
  );
  if (!host.startsWith("unix:///"))
    fail("Setup solo aprovisiona con un daemon local mediante socket Unix.");
  await exec("Comprobando el daemon Docker", ["info", "--format", "{{.ServerVersion}}"], {
    failureHint: () =>
      "Verifica que el daemon local esté en ejecución y sea accesible. Repite npm run setup.",
  });

  const settings = parseEnv(plan?.content ?? "");
  if (Object.keys(settings).some((key) => key.startsWith("COMPOSE_")))
    fail("Las variables COMPOSE_* no están admitidas en el .env del asistente.");
  for (const directory of [
    backend,
    ...(project.modality === "fullstack" ? [path.join(root, "frontend")] : []),
  ]) {
    const ignore = (await readFile(path.join(directory, ".dockerignore"))).split(/\r?\n/);
    if (
      !ignore.includes(".env") ||
      !ignore.includes(".env.*") ||
      ignore.some((line) => line.trim().startsWith("!")) ||
      (await readFile(path.join(directory, "Dockerfile.dockerignore"), { optional: true })) !==
        undefined
    )
      fail(
        "Los contextos de construcción deben excluir .env y .env.* con el .dockerignore generado.",
      );
  }
  const update = async (values) => {
    let content = plan.content;
    for (const [name, value] of Object.entries(values)) {
      if (settings[name] === value) continue;
      const pattern = new RegExp("^" + name + "=[^\\r\\n]*", "gm");
      const lines = content.match(pattern) ?? [];
      if (lines.length > 1 || (lines.length && settings[name]))
        fail("No se reemplazará la configuración existente: " + name + ".");
      const line = name + "=" + JSON.stringify(value);
      content = lines.length
        ? content.replace(pattern, () => line)
        : content.trimEnd() + "\n" + line + "\n";
    }
    await publish({ ...plan, content });
    plan.content = plan.previous = content;
    Object.assign(settings, values);
  };

  const tls = tlsCapable && (await prepareTls({ root, settings, exec, fail, readFile, update }));
  if (tlsCapable && !tls) {
    console.log("HTTPS pendiente. El asistente no arrancó servicios ni publicó HTTP.");
    return;
  }
  const base = ["compose", "--env-file", plan ? ".env" : "/dev/null", "-f", "compose.yaml"];
  const compose = (label, args, flags) =>
    exec(label, [...base, ...(tls ? ["-f", "compose.tls.yaml"] : []), ...args], flags);
  const skeleton = JSON.parse(
    await exec(
      "Identificando recursos del proyecto Compose",
      [...base, "config", "--no-interpolate", "--format", "json"],
      { capture: true },
    ),
  );
  const name = skeleton.name;
  const projectLocation = createHash("sha256").update(root).digest("hex");
  const jobProjectLabel = "io.brixa.setup.job-project=" + projectLocation;
  const unfinished = await exec(
    "Comprobando trabajos puntuales anteriores",
    ["ps", "-aq", "--filter", "label=" + jobProjectLabel],
    { capture: true },
  );
  if (unfinished)
    fail(
      "Hay un trabajo puntual de setup registrado. Comprueba su estado en docker ps -a antes de repetir. Conserva los volúmenes.",
    );
  const migrations =
    project.database !== "none" &&
    (
      await readdir(path.join(backend, "drizzle"), { withFileTypes: true }).catch((error) => {
        if (error.code !== "ENOENT") throw error;
        return [];
      })
    ).some((entry) => entry.isFile() && entry.name.endsWith(".sql"));
  if (project.database !== "none" && !migrations) {
    if (project.auth) fail("Faltan las migraciones incluidas de Auth.");
    console.log(
      "Migraciones pendientes: genera SQL con db:generate antes de iniciar la aplicación.",
    );
    return;
  }
  const volumeKey = project.database === "postgres" ? "postgres_data" : "sqlite_data";
  const volumeName = project.database === "none" ? undefined : skeleton.volumes?.[volumeKey]?.name;
  if (
    project.database !== "none" &&
    (volumeName !== name + "_" + volumeKey ||
      skeleton.volumes[volumeKey].external ||
      skeleton.volumes[volumeKey].driver_opts)
  )
    fail("La persistencia debe utilizar el volumen local generado por Compose.");
  const containers = (
    await exec(
      "Inspeccionando contenedores existentes",
      ["ps", "-aq", "--filter", "label=com.docker.compose.project=" + name],
      { capture: true },
    )
  )
    .split("\n")
    .filter(Boolean);
  const existing = [];
  for (const id of containers) {
    const result = JSON.parse(
      await exec(
        "Comprobando la propiedad de un contenedor",
        ["inspect", "--format", "{{json .Config.Labels}}", id],
        { capture: true },
      ),
    );
    if (result["com.docker.compose.project.working_dir"] !== root)
      fail("El nombre Compose también pertenece a otro directorio.");
    existing.push(result);
  }
  const volumeExists =
    volumeName &&
    (
      await exec("Buscando el volumen de datos", ["volume", "ls", "--format", "{{.Name}}"], {
        capture: true,
      })
    )
      .split("\n")
      .includes(volumeName);
  if (volumeExists) {
    const volume = JSON.parse(
      await exec(
        "Comprobando la propiedad del volumen",
        ["volume", "inspect", "--format", "{{json .}}", volumeName],
        { capture: true },
      ),
    );
    const service = project.database === "postgres" ? "postgres" : "backend";
    const attachedToProject = existing.some(
      (container) => container["com.docker.compose.service"] === service,
    );
    const reservedSqlite =
      project.database === "sqlite" &&
      volume.Labels?.["io.brixa.setup.root"] === projectLocation &&
      /^[0-9a-f-]{36}$/.test(volume.Labels?.["io.brixa.setup"] ?? "");
    if (
      volume.Labels?.["com.docker.compose.project"] !== name ||
      volume.Labels?.["com.docker.compose.volume"] !== volumeKey ||
      volume.Driver !== "local" ||
      Object.keys(volume.Options ?? {}).length ||
      (!attachedToProject && !reservedSqlite)
    )
      fail(
        "Volumen existente no atribuible con seguridad. Comprueba su origen y los contenedores con docker compose ps -a. Conserva el volumen y continúa manualmente.",
      );
    console.log("Volumen existente reutilizado.");
  }
  if (project.database !== "none" && !volumeExists && existing.length)
    fail("Hay contenedores existentes sin el volumen esperado. Revisa el estado manualmente.");

  let postgres;
  if (project.database === "postgres") {
    const database = settings.POSTGRES_DB || "app";
    const admin = settings.POSTGRES_USER || "postgres";
    if (
      !/^[a-z_][a-z_0-9]*$/.test(database) ||
      !/^[a-z_][a-z_0-9]*$/.test(admin) ||
      ["postgres", "template0", "template1"].includes(database) ||
      ["app_exec", "table_owner"].includes(admin)
    )
      fail("POSTGRES_DB y POSTGRES_USER deben identificar una base dedicada y su administrador.");
    const keys = ["POSTGRES_PASSWORD", "DATABASE_URL", "MIGRATION_DATABASE_URL"];
    const fresh = !volumeExists;
    if (fresh) {
      if (keys.some((key) => settings[key]))
        fail("Ya hay credenciales, pero falta el volumen. Revisa el estado antes de aprovisionar.");
      if ((await ask("¿Crear y aprovisionar un PostgreSQL local dedicado? [s/N] ")) !== "s") {
        console.log("PostgreSQL pendiente. No se inició la aplicación.");
        return;
      }
      await update({
        POSTGRES_PASSWORD: secret(),
        DATABASE_URL: "postgresql://app_exec:" + secret() + "@postgres:5432/" + database,
        MIGRATION_DATABASE_URL:
          "postgresql://table_owner:" + secret() + "@postgres:5432/" + database,
      });
    }
    if (!keys.every((key) => settings[key]))
      fail("Faltan credenciales en el .env privado para comprobar el PostgreSQL existente.");
    const password = (value, role) => {
      const url = URL.parse(value);
      if (
        !url ||
        !["postgres:", "postgresql:"].includes(url.protocol) ||
        url.username !== role ||
        url.hostname !== "postgres" ||
        (url.port && url.port !== "5432") ||
        url.pathname !== "/" + database ||
        url.search ||
        url.hash ||
        !url.password
      )
        fail("Las credenciales deben corresponder a los roles y a la base interna de Compose.");
      return decodeURIComponent(url.password);
    };
    const ownerPassword = password(settings.MIGRATION_DATABASE_URL, "table_owner");
    const appPassword = password(settings.DATABASE_URL, "app_exec");
    if (
      new Set([settings.POSTGRES_PASSWORD, ownerPassword, appPassword]).size !== 3 ||
      [settings.POSTGRES_PASSWORD, ownerPassword, appPassword].some((value) =>
        /[\r\n\0]/.test(value),
      )
    )
      fail("PostgreSQL requiere tres contraseñas distintas de una sola línea.");
    postgres = { database, admin, fresh, ownerPassword, appPassword };
  }

  const config = JSON.parse(
    await compose("Validando el Compose efectivo", ["config", "--format", "json"], {
      capture: true,
    }),
  );
  checkCompose(config, project, backend, root, tls, settings, fail);
  const network = config.networks.default;
  if (
    Object.keys(config.networks).length !== 1 ||
    network?.name !== name + "_default" ||
    network.external
  )
    fail("El proyecto debe utilizar la red local generada por Compose.");
  const usedNetwork = (
    await exec(
      "Inspeccionando la red Compose",
      ["network", "ls", "--filter", "name=^" + network.name + "$", "--format", "{{.Name}}"],
      { capture: true },
    )
  )
    .split("\n")
    .includes(network.name);
  if (usedNetwork) {
    const labels = JSON.parse(
      await exec(
        "Comprobando la propiedad de la red Compose",
        ["network", "inspect", "--format", "{{json .Labels}}", network.name],
        { capture: true },
      ),
    );
    if (
      !existing.length ||
      labels?.["com.docker.compose.project"] !== name ||
      labels["com.docker.compose.network"] !== "default"
    )
      fail("Hay una red existente que setup no puede atribuir a este proyecto.");
  }
  if (existing.length) {
    const hashes = new Map(
      (
        await compose(
          "Verificando la configuración de contenedores existentes",
          ["config", "--hash=*"],
          { capture: true },
        )
      )
        .split("\n")
        .map((line) => line.split(/\s+/, 2)),
    );
    if (
      existing.some(
        (labels) =>
          hashes.get(labels["com.docker.compose.service"]) !==
          labels["com.docker.compose.config-hash"],
      )
    )
      fail(
        "La configuración de un contenedor existente difiere. Revisa Compose manualmente antes de reintentar.",
      );
  }

  let volumeMarker;
  if (volumeName && !volumeExists) {
    volumeMarker = randomUUID();
    await exec("Reservando un volumen nuevo para este proyecto", [
      "volume",
      "create",
      "--label",
      "com.docker.compose.project=" + name,
      "--label",
      "com.docker.compose.volume=" + volumeKey,
      "--label",
      "io.brixa.setup=" + volumeMarker,
      "--label",
      "io.brixa.setup.root=" + projectLocation,
      volumeName,
    ]);
    const actual = await exec(
      "Confirmando reserva exclusiva del volumen",
      ["volume", "inspect", "--format", '{{index .Labels "io.brixa.setup"}}', volumeName],
      { capture: true },
    );
    if (actual !== volumeMarker) fail("El volumen ya existía. No se aprovisionará ni modificará.");
  }

  if (postgres)
    await preparePostgres({
      postgres,
      settings,
      compose,
      exec,
      volumeName,
      volumeMarker,
      backend,
      readFile,
      fail,
    });

  await compose("Construyendo las imágenes de la aplicación", ["build"], { installing: true });
  const image = config.services.backend.image ?? name + "-backend";
  const language = project.language === "ts" ? "ts" : "js";
  const tree = language === "ts" ? "dist" : "src";
  const runtime = { DATABASE_URL: settings.DATABASE_URL };
  const operation = postgres
    ? { MIGRATION_DATABASE_URL: settings.MIGRATION_DATABASE_URL }
    : { DATABASE_URL: "file:./data/app.db" };
  async function job(label, args, variables = {}, tty = false, mounts = []) {
    const jobLabel = "io.brixa.setup.job=" + randomUUID();
    try {
      return await exec(
        label,
        [
          "run",
          "--rm",
          "--label",
          jobProjectLabel,
          "--label",
          jobLabel,
          ...(tty ? ["-it"] : []),
          "--network",
          postgres ? config.networks.default.name : "none",
          ...(project.database === "sqlite"
            ? ["--mount", "type=volume,src=" + volumeName + ",dst=/app/data"]
            : []),
          ...mounts,
          ...Object.keys(variables).flatMap((key) => ["--env", key]),
          image,
          "node",
          ...args,
        ],
        { tty, exactEnv: { ...env, ...variables } },
      );
    } catch (error) {
      if (wasInterrupted()) {
        try {
          const id = await exec(
            "Buscando el trabajo interrumpido",
            ["ps", "-q", "--filter", "label=" + jobLabel],
            { capture: true, afterInterrupt: true, timeout: 8_000 },
          );
          if (id && /^[a-f0-9]{12,64}$/.test(id))
            await exec("Deteniendo solo el trabajo interrumpido", ["stop", "--time", "5", id], {
              afterInterrupt: true,
              timeout: 8_000,
            });
        } catch {
          console.error(
            "No se pudo comprobar la parada del trabajo puntual. Revisa docker ps -a antes de repetir.",
          );
        }
      }
      throw error;
    }
  }
  const checkRuntime = (auth) =>
    job(
      auth
        ? "Comprobando los privilegios efectivos de Auth"
        : "Comprobando los privilegios de app_exec",
      [
        "--input-type=module",
        "--eval",
        'const {pool, checkRuntimeIdentity} = await import("./' +
          tree +
          '/db/client.js");' +
          "try { await (" +
          (auth
            ? '(await import("./' + tree + '/db/check-auth-privileges.js")).checkAuthPrivileges'
            : "checkRuntimeIdentity") +
          ")(); } finally { await pool.end(); }",
      ],
      runtime,
    );
  if (tls) {
    await exec("Comprobando lectura del certificado y la clave como Nginx", [
      "run",
      "--rm",
      "--network",
      "none",
      "--mount",
      "type=bind,src=" + settings.TLS_KEY_PATH + ",dst=/etc/nginx/tls.key,readonly",
      "--mount",
      "type=bind,src=" + settings.TLS_CERT_PATH + ",dst=/etc/nginx/tls.crt,readonly",
      "--entrypoint",
      "sh",
      config.services.frontend.image ?? name + "-frontend",
      "-c",
      'test "$(id -u)" = 101 && test -r /etc/nginx/tls.key && test -r /etc/nginx/tls.crt',
    ]);
    await job(
      "Comprobando correspondencia del certificado y la clave",
      [
        "--input-type=module",
        "--eval",
        'import {readFileSync} from "node:fs"; import {X509Certificate,createPrivateKey} from "node:crypto";' +
          'if(!new X509Certificate(readFileSync("/tmp/setup.crt")).checkPrivateKey(createPrivateKey(readFileSync("/tmp/setup.key")))) process.exit(1);',
      ],
      {},
      false,
      [
        "--user",
        "101",
        "--mount",
        "type=bind,src=" + settings.TLS_CERT_PATH + ",dst=/tmp/setup.crt,readonly",
        "--mount",
        "type=bind,src=" + settings.TLS_KEY_PATH + ",dst=/tmp/setup.key,readonly",
      ],
    );
  }
  if (postgres) await checkRuntime(false);
  if (migrations)
    await job("Aplicando migraciones pendientes", [tree + "/db/migrate.js"], operation);
  if (project.auth) {
    if (postgres) await checkRuntime(true);
    for (const key of ["AUTH_PASSWORD_MIN_LENGTH", "AUTH_PASSWORD_MAX_LENGTH"]) {
      if (settings[key] !== undefined) operation[key] = settings[key];
    }
    await job(
      "Comprobando el administrador inicial",
      [tree + "/auth/bootstrap-cli.js", "--if-needed"],
      operation,
      true,
    );
  } else console.log("Bootstrap omitido: esta variante no incluye Auth.");
  if (project.auth && !tls) {
    console.log(
      "Backend con Auth preparado. Configura el transporte HTTPS externo antes de iniciar el servicio.",
    );
    return;
  }
  await compose(
    "Iniciando los servicios y esperando su salud",
    ["up", "-d", "--wait", "--wait-timeout", "90", "--no-recreate"],
    {
      failureHint: (diagnostic) =>
        /port is already allocated|address already in use|failed to bind host port|ports are not available/i.test(
          diagnostic,
        )
          ? "Un puerto publicado está ocupado. Libéralo y repite npm run setup. Si cambias el puerto, revisa y recrea manualmente solo el contenedor afectado, conservando los volúmenes."
          : "Comprueba los contenedores y su salud con docker compose ps -a antes de reintentar. Conserva los volúmenes.",
    },
  );
  if (tls) {
    console.log("Comprobando /api/health por HTTPS con la CA configurada…");
    await checkHttps(settings.AUTH_PUBLIC_ORIGIN, await readFile(settings.TLS_CA_PATH), fail);
    console.log("Servicios saludables. Acceso: " + settings.AUTH_PUBLIC_ORIGIN);
  } else {
    const fullstack = project.modality === "fullstack";
    const binding = await compose(
      "Identificando la publicación HTTP",
      ["port", fullstack ? "frontend" : "backend", fullstack ? "8080" : "3000"],
      { capture: true },
    );
    const match = /^(?:0\.0\.0\.0|127\.0\.0\.1):([0-9]+)$/.exec(binding.split("\n")[0]);
    if (match) console.log("Servicios saludables. Acceso: http://localhost:" + match[1]);
    else
      console.log("Servicios saludables. Consulta la dirección publicada con docker compose port.");
  }
}

async function preparePostgres({
  postgres,
  settings,
  compose,
  exec,
  volumeName,
  volumeMarker,
  backend,
  readFile,
  fail,
}) {
  const { database, admin, fresh, ownerPassword, appPassword } = postgres;
  await compose("Iniciando solo PostgreSQL y esperando su salud", [
    "up",
    "-d",
    "--wait",
    "--wait-timeout",
    "90",
    "--no-recreate",
    "postgres",
  ]);
  const id = await compose("Identificando el contenedor PostgreSQL", ["ps", "-q", "postgres"], {
    capture: true,
  });
  if (!/^[a-f0-9]{12,64}$/.test(id)) fail("No se pudo identificar un único contenedor PostgreSQL.");
  const mounts = JSON.parse(
    await exec(
      "Confirmando el volumen montado en PostgreSQL",
      ["inspect", "--format", "{{json .Mounts}}", id],
      { capture: true },
    ),
  );
  if (
    !mounts.some(
      (item) =>
        item.Type === "volume" &&
        item.Name === volumeName &&
        item.Destination === "/var/lib/postgresql/data" &&
        item.RW,
    )
  )
    fail("PostgreSQL no está usando el volumen verificado del proyecto.");
  await compose("Esperando la conexión de red de PostgreSQL", [
    "exec",
    "-T",
    "postgres",
    "sh",
    "-c",
    'for n in $(seq 1 30); do pg_isready -q -h postgres -U "$1" -d "$2" && exit 0; sleep 1; done; exit 1',
    "sh",
    admin,
    database,
  ]);
  const psql = (label, args, flags) =>
    compose(
      label,
      [
        "exec",
        "-T",
        "postgres",
        "psql",
        "-XqAtw",
        "-U",
        admin,
        "-d",
        database,
        "-v",
        "ON_ERROR_STOP=1",
        ...args,
      ],
      flags,
    );
  const roles = "('table_owner','app_exec')";
  if (fresh) {
    const marker = await exec(
      "Verificando de nuevo el volumen reservado",
      ["volume", "inspect", "--format", '{{index .Labels "io.brixa.setup"}}', volumeName],
      { capture: true },
    );
    if (marker !== volumeMarker) fail("El volumen cambió antes del aprovisionamiento.");
    const empty = await psql(
      "Confirmando que la base dedicada está sin aprovisionar",
      [
        "-c",
        "SELECT NOT EXISTS (SELECT FROM pg_roles WHERE rolname IN " +
          roles +
          ") AND NOT EXISTS (SELECT FROM pg_class WHERE relnamespace = 'public'::regnamespace) AND to_regnamespace('drizzle') IS NULL",
      ],
      { capture: true },
    );
    if (empty !== "t") fail("La base no está vacía. No se modificaron roles.");
    await psql(
      "Aprovisionando los roles con ops/provision.sql",
      ["-v", "target=" + database, "-f", "-"],
      { input: await readFile(path.join(backend, "ops", "provision.sql")) },
    );
    for (const [role, password] of [
      ["table_owner", ownerPassword],
      ["app_exec", appPassword],
    ]) {
      await psql(
        "Asignando una credencial SCRAM a " + role,
        ["-c", "SET password_encryption = 'scram-sha-256'", "-c", "\\password " + role],
        { input: password + "\n" + password + "\n" },
      );
    }
  }
  const ready = await psql(
    "Comprobando verificadores SCRAM e identidades PostgreSQL",
    [
      "-c",
      "SELECT count(*) = 3 AND bool_and(COALESCE(rolpassword LIKE 'SCRAM-SHA-256$%', false) AND rolcanlogin) " +
        "AND bool_and(rolname NOT IN " +
        roles +
        " OR (NOT (rolsuper OR rolcreatedb OR rolcreaterole OR rolreplication OR rolbypassrls) " +
        "AND NOT EXISTS(SELECT FROM pg_auth_members WHERE member=pg_authid.oid) " +
        "AND shobj_description(oid, 'pg_authid') IS NOT DISTINCT FROM 'Brixa Auth PostgreSQL / database oid ' || " +
        "(SELECT oid FROM pg_database WHERE datname = current_database()))) FROM pg_authid WHERE rolname IN ('" +
        admin +
        "','table_owner','app_exec')",
    ],
    { capture: true },
  );
  if (ready !== "t")
    fail(
      "Roles incompletos o incompatibles. Revisa la instancia dedicada y el .env con el operador según ops/README.md. Conserva el volumen y las credenciales.",
    );
  for (const [role, password] of [
    [admin, settings.POSTGRES_PASSWORD],
    ["table_owner", ownerPassword],
    ["app_exec", appPassword],
  ]) {
    const identity = await compose(
      "Verificando la conexión TCP de " + (role === admin ? "administración" : role),
      [
        "exec",
        "-T",
        "postgres",
        "sh",
        "-c",
        "IFS= read -r wrong; IFS= read -r PGPASSWORD; export PGPASSWORD; " +
          'if PGPASSWORD="$wrong" psql -XwAt -h postgres -U "$1" -d "$2" -c "SELECT 1" >/dev/null 2>&1; then exit 1; fi; ' +
          'exec psql -XwAt -h postgres -U "$1" -d "$2" -c "SELECT current_user"',
        "sh",
        role,
        database,
      ],
      { input: secret() + "\n" + password + "\n", capture: true },
    );
    if (identity !== role) fail("La identidad PostgreSQL no coincide con el rol solicitado.");
  }
}
