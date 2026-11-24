import assert from "node:assert/strict";
import { execFileSync, spawn } from "node:child_process";
import { randomBytes } from "node:crypto";
import { EventEmitter, once } from "node:events";
import { mkdir, mkdtemp, readFile, rm, symlink, writeFile } from "node:fs/promises";
import http from "node:http";
import https from "node:https";
import { networkInterfaces, tmpdir } from "node:os";
import path from "node:path";
import { URL, URLSearchParams } from "node:url";
import { generate } from "../src/generator/generate.ts";
import { startBackendServer, stopProcess } from "./verify-generated.js";

const address = "127.0.0.1";
const proxyAddress = "127.0.0.2";
const hostname = "brixa.test";
const otherHost = "other.test";
const fixture = path.join(import.meta.dirname, "fixtures", "auth-https");
const timeout = () => globalThis.AbortSignal.timeout(5000);
const secret = () => randomBytes(32).toString("hex");

function command(label, executable, args, options = {}) {
  try {
    execFileSync(executable, args, { timeout: 120_000, stdio: "pipe", ...options });
  } catch (error) {
    const { code, status, signal } = error;
    const cause = { code, status, signal };
    // eslint-disable-next-line preserve-caught-error -- La salida del subproceso puede contener secretos.
    throw new Error(`${label}: ${code ?? status ?? signal}.`, { cause });
  }
}

async function certificates(workspace) {
  const openssl = (...args) =>
    command("Certificado TLS de prueba", "openssl", args, { cwd: workspace });
  openssl(
    "req",
    "-x509",
    "-newkey",
    "rsa:2048",
    "-nodes",
    "-days",
    "1",
    "-subj",
    "/CN=Brixa fixture CA",
    "-addext",
    "basicConstraints=critical,CA:TRUE",
    "-keyout",
    "ca.key",
    "-out",
    "ca.pem",
  );
  openssl(
    "req",
    "-new",
    "-newkey",
    "rsa:2048",
    "-nodes",
    "-subj",
    `/CN=${hostname}`,
    "-keyout",
    "tls.key",
    "-out",
    "tls.csr",
  );
  await writeFile(
    path.join(workspace, "tls.ext"),
    `subjectAltName=DNS:${hostname},DNS:${otherHost}\nextendedKeyUsage=serverAuth\n`,
  );
  openssl(
    "x509",
    "-req",
    "-in",
    "tls.csr",
    "-CA",
    "ca.pem",
    "-CAkey",
    "ca.key",
    "-CAcreateserial",
    "-days",
    "1",
    "-extfile",
    "tls.ext",
    "-out",
    "tls.pem",
  );
  openssl("x509", "-in", "ca.pem", "-outform", "DER", "-out", "ca.der");

  const home = path.join(workspace, "browser-home");
  const data = path.join(home, ".local", "share");
  const nssdb = path.join(data, "pki", "nssdb");
  await mkdir(nssdb, { recursive: true });
  // Chromium versions before the XDG migration look in ~/.pki.
  await symlink(path.dirname(nssdb), path.join(home, ".pki"));
  command("Confianza NSS de Chromium (Python 3 y libnss3)", "python3", [
    path.join(fixture, "trust-ca.py"),
    nssdb,
    path.join(workspace, "ca.der"),
  ]);
  return {
    home,
    data,
    tls: {
      key: await readFile(path.join(workspace, "tls.key")),
      cert: await readFile(path.join(workspace, "tls.pem")),
    },
  };
}

async function browser(child) {
  const pending = new Map();
  let nextId = 0;
  let sessionId;
  let buffer = "";
  const input = child.stdio[3];
  const output = child.stdio[4];
  const disconnected = () => {
    for (const finish of pending.values())
      finish({ error: { message: "Chromium se desconectó." } });
  };
  for (const event of ["error", "exit"]) child.on(event, disconnected);
  input.on("error", disconnected);
  output.setEncoding("utf8").on("data", (data) => {
    buffer += data;
    const messages = buffer.split("\0");
    buffer = messages.pop();
    for (const message of messages) {
      const response = JSON.parse(message);
      pending.get(response.id)?.(response);
    }
  });
  function send(method, params = {}, target = sessionId) {
    return new Promise((resolve, reject) => {
      const id = ++nextId;
      const timer = setTimeout(() => {
        pending.delete(id);
        reject(new Error(`Chromium: timeout en ${method}.`));
      }, 10000);
      pending.set(id, ({ error, result }) => {
        clearTimeout(timer);
        pending.delete(id);
        if (error) reject(new Error(`Chromium: ${method} falló.`));
        else resolve(result);
      });
      input.write(JSON.stringify({ id, method, params, sessionId: target }) + "\0");
    });
  }
  const { targetId } = await send("Target.createTarget", { url: "about:blank" });
  ({ sessionId } = await send("Target.attachToTarget", { targetId, flatten: true }));
  return {
    send,
    async evaluate(expression) {
      const result = await send("Runtime.evaluate", {
        expression,
        awaitPromise: true,
        returnByValue: true,
      });
      assert(!result.exceptionDetails, "Falló una operación del navegador.");
      return result.result.value;
    },
    async open(url, selector) {
      const { errorText } = await send("Page.navigate", { url });
      assert(!errorText, `Chromium rechazó la navegación HTTPS (${errorText}).`);
      for (let attempt = 0; attempt < 50; attempt++) {
        const result = await send("Runtime.evaluate", {
          expression: `location.origin + '|' + Boolean(document.querySelector(${JSON.stringify(selector)}))`,
          returnByValue: true,
        });
        if (result.result?.value === new URL(url).origin + "|true") return;
        await new Promise((resolve) => setTimeout(resolve, 100));
      }
      throw new Error("No cargó la página de prueba HTTPS.");
    },
  };
}

async function run() {
  const workspace = await mkdtemp(path.join(tmpdir(), "brixa-auth-https-"));
  let backend;
  let chrome;
  let proxy;
  try {
    const { home, data, tls } = await certificates(workspace);
    const project = path.join(workspace, "fixture");
    assert(
      (
        await generate({
          outputDir: project,
          modality: "fullstack",
          language: "ts",
          database: "sqlite",
          auth: true,
          authTransport: "cookie",
        })
      ).ok,
      "Falló la generación fullstack.",
    );
    const cwd = path.join(project, "backend");
    const env = Object.fromEntries(
      Object.entries(process.env).filter(
        ([name]) =>
          !/^(AUTH_|DATABASE_|MIGRATION_|CORS_|LOGIN_|ARGON2_|SESSION_|ACTIVATION_|NODE_ENV$)/i.test(
            name,
          ),
      ),
    );
    const npm = (...args) => command(`npm ${args.join(" ")}`, "npm", args, { cwd, env });
    npm("install", "--no-audit", "--no-fund");
    npm("run", "build");

    const logs = [];
    const forwarded = new EventEmitter();
    let loginForwarding;
    let loginSetCookie;
    const referers = [];
    const html = await readFile(path.join(fixture, "activate.html"));
    const script = await readFile(path.join(fixture, "activation-fixture.js"));
    proxy = https.createServer(tls, (req, res) => {
      logs.push(req.method + " " + req.url);
      if (req.headers.referer) referers.push(req.headers.referer);
      const external = req.headers.host === `${otherHost}:${proxy.address().port}`;
      res.setHeader("Referrer-Policy", external ? "strict-origin" : "no-referrer");
      res.setHeader("Cache-Control", "no-store");
      const formTarget = external ? `https://${hostname}:${proxy.address().port}` : "'self'";
      res.setHeader(
        "Content-Security-Policy",
        `default-src 'self'; frame-src ${formTarget}; form-action ${formTarget}; base-uri 'none'`,
      );
      if (req.url === "/activate")
        return res.writeHead(200, { "Content-Type": "text/html" }).end(html);
      if (req.url === "/activation-fixture.js")
        return res.writeHead(200, { "Content-Type": "text/javascript" }).end(script);
      if (req.url === "/")
        return res
          .writeHead(200, { "Content-Type": "text/html" })
          .end('<!doctype html><main id="fixture">Brixa HTTPS</main>');
      if (!req.url?.startsWith("/api/") || !backend) return res.writeHead(404).end();
      const headers = Object.fromEntries(
        Object.entries(req.headers).filter(
          ([name]) =>
            name !== "forwarded" && name !== "x-real-ip" && !name.startsWith("x-forwarded-"),
        ),
      );
      headers["x-forwarded-for"] = req.socket.remoteAddress;
      headers["x-forwarded-proto"] = "https";
      if (req.url === "/api/auth/login" && !loginForwarding) {
        const isForwardingHeader = ([name]) =>
          name.startsWith("x-forwarded-") || name === "forwarded" || name === "x-real-ip";
        loginForwarding = {
          incoming: Object.fromEntries(Object.entries(req.headers).filter(isForwardingHeader)),
          outgoing: Object.fromEntries(Object.entries(headers).filter(isForwardingHeader)),
        };
      }
      const upstream = http.request(
        {
          hostname: address,
          port: backend.port,
          localAddress: proxyAddress,
          method: req.method,
          path: req.url.slice(4),
          headers,
          signal: timeout(),
        },
        (response) => {
          if (req.url === "/api/auth/login" && !loginSetCookie)
            loginSetCookie = response.headers["set-cookie"];
          forwarded.emit(req.url, response.statusCode, req.headers.origin);
          res.writeHead(response.statusCode, response.headers);
          response.pipe(res);
        },
      );
      upstream.on("error", () => {
        if (res.headersSent) res.destroy();
        else res.writeHead(502).end();
      });
      req.pipe(upstream);
    });
    proxy.listen(0, address);
    await once(proxy, "listening");
    const origin = `https://${hostname}:${proxy.address().port}`;
    const admin = { email: "admin@example.test", password: secret() };
    const member = { email: "member@example.test", password: secret() };
    Object.assign(env, {
      DATABASE_URL: `file:${path.join(workspace, "auth.db")}`,
      AUTH_PUBLIC_ORIGIN: origin,
      ACTIVATION_PAGE_URL: origin + "/activate",
      AUTH_TRUSTED_PROXIES: proxyAddress,
      LOGIN_ABUSE_HMAC_KEY: secret(),
      BRIXA_FIXTURE_EMAIL: admin.email,
      BRIXA_FIXTURE_PASSWORD: admin.password,
    });
    npm("run", "db:migrate");
    // Run the generated app and Auth initializer with a loopback-only listener.
    await writeFile(
      path.join(cwd, "https-fixture.mjs"),
      `
import { app } from "./dist/app.js";
import { initializeAuthHttp } from "./dist/auth/http-runtime.js";
import { db } from "./dist/db/client.js";
import { sqliteActivationDatabase } from "./dist/db/activation-write.js";
import { withSqliteAdministrator } from "./dist/db/local-admin.js";
import { bootstrapInitialAdministrator } from "./dist/auth/bootstrap.js";
await withSqliteAdministrator((database) => bootstrapInitialAdministrator(database, {
  email: process.env.BRIXA_FIXTURE_EMAIL, password: process.env.BRIXA_FIXTURE_PASSWORD,
}));
delete process.env.BRIXA_FIXTURE_PASSWORD;
await initializeAuthHttp("cookie", "brixa-session-fixture", db, sqliteActivationDatabase({ url: process.env.DATABASE_URL }));
const server = app.listen(0, "${address}", () => console.log("http://localhost:" + server.address().port));
`,
    );
    // Mask any host Auth overrides when using the shared subprocess helper.
    backend = await startBackendServer(cwd, "https-fixture.mjs", {
      ...Object.fromEntries(
        Object.keys(process.env)
          .filter((name) => !(name in env))
          .map((name) => [name, undefined]),
      ),
      ...env,
    });

    const forged = {
      "X-Forwarded-For": "203.0.113.33",
      "X-Forwarded-Proto": "http",
      "X-Forwarded-Host": "other.test",
      Forwarded: "for=203.0.113.33;proto=http",
      "X-Real-IP": "203.0.113.33",
    };
    const direct = await fetch(`http://${address}:${backend.port}/auth/session`, {
      headers: { ...forged, "X-Forwarded-Proto": "https" },
      signal: timeout(),
    });
    assert.equal(
      direct.status,
      403,
      "El backend confió en TLS declarado desde un salto no confiable.",
    );
    const exterior = Object.values(networkInterfaces())
      .flat()
      .filter((entry) => entry && !entry.internal && entry.family === "IPv4");
    assert(exterior.length, "Se necesita una interfaz IPv4 externa para comprobar el aislamiento.");
    for (const { address: ip } of exterior) {
      await assert.rejects(
        fetch(`http://${ip}:${backend.port}/health`, { signal: timeout() }),
        (error) => error.cause?.code === "ECONNREFUSED",
      );
    }
    console.log(
      "OK backend inaccesible en IPv4 no loopback; X-Forwarded-Proto directo rechazado (403)",
    );

    chrome = spawn(
      process.env.BRIXA_CHROMIUM || "chromium",
      [
        "--headless",
        "--no-first-run",
        "--disable-background-networking",
        "--no-proxy-server",
        "--remote-debugging-pipe",
        "--disable-dev-shm-usage",
        `--user-data-dir=${path.join(home, "profile")}`,
        `--host-resolver-rules=MAP ${hostname} ${address}, MAP ${otherHost} ${address}`,
        "about:blank",
      ],
      {
        env: { ...env, BRIXA_FIXTURE_PASSWORD: undefined, HOME: home, XDG_DATA_HOME: data },
        stdio: ["ignore", "ignore", "ignore", "pipe", "pipe"],
      },
    );
    const page = await browser(chrome);
    await page.open(origin + "/", "#fixture");
    assert.equal(await page.evaluate("isSecureContext"), true);
    const request = (route, body, headers = {}) =>
      page.evaluate(`(async () => {
      const r = await fetch(${JSON.stringify("/api/auth/" + route)}, ${JSON.stringify(
        body === undefined
          ? {}
          : {
              method: "POST",
              headers: {
                "X-Requested-With": "XMLHttpRequest",
                ...(body === null ? {} : { "Content-Type": "application/json" }),
                ...headers,
              },
              body: body === null ? undefined : JSON.stringify(body),
            },
      )});
      return { status: r.status, text: await r.text() };
    })()`);

    const login = await request("login", admin, forged);
    assert.equal(login.status, 204);
    assert.equal(login.text.length, 0);
    assert.deepEqual(
      loginForwarding.incoming,
      Object.fromEntries(
        Object.entries(forged).map(([name, value]) => [name.toLowerCase(), value]),
      ),
    );
    assert.deepEqual(loginForwarding.outgoing, {
      "x-forwarded-for": address,
      "x-forwarded-proto": "https",
    });
    assert(
      loginSetCookie?.length === 1 && !/;\s*domain=/i.test(loginSetCookie[0]),
      "La cookie debe omitir Domain.",
    );
    const { cookies } = await page.send("Network.getCookies", { urls: [origin] });
    assert.equal(cookies.length, 1);
    const [cookie] = cookies;
    assert(cookie.name.startsWith("__Host-"));
    assert(
      cookie.httpOnly &&
        cookie.secure &&
        cookie.sameSite === "Lax" &&
        cookie.path === "/" &&
        cookie.domain === hostname &&
        cookie.expires > Date.now() / 1000,
    );
    assert.equal(
      (await page.send("Network.getCookies", { urls: [origin.replace("https:", "http:")] })).cookies
        .length,
      0,
    );
    assert.equal(await page.evaluate("document.cookie"), "");
    assert.equal((await request("session")).status, 200);
    assert.equal(
      (await request("register", { email: member.email }, { "X-Requested-With": "" })).status,
      403,
    );
    const registration = await request("register", { email: member.email });
    assert.equal(registration.status, 201);
    const link = new URL(JSON.parse(registration.text).activationUrl);
    assert.equal(link.origin + link.pathname, env.ACTIVATION_PAGE_URL);
    assert.equal(link.search, "");
    const activationToken = new URLSearchParams(link.hash.slice(1)).get("token");
    assert(typeof activationToken === "string" && /^[\w-]{43}$/.test(activationToken));
    assert.equal((await request("logout", null)).status, 204);
    assert.equal((await page.send("Network.getCookies", { urls: [origin] })).cookies.length, 0);
    assert.equal((await request("session")).status, 401);
    const { success } = await page.send("Network.setCookie", {
      name: cookie.name,
      value: cookie.value,
      url: origin,
      secure: true,
      httpOnly: true,
      sameSite: "Lax",
      path: "/",
    });
    assert(success);
    assert.equal(
      (await request("session")).status,
      401,
      "La cookie revocada sigue siendo aceptada.",
    );
    await page.send("Network.clearBrowserCookies");
    console.log(
      "OK TLS confiable, login 204, cookie __Host-, sesión 200, logout 204 y cookie revocada 401",
    );

    const otherOrigin = origin.replace(hostname, otherHost);
    await page.open(otherOrigin, "#fixture");
    const denied = once(forwarded, "/api/auth/activate", { signal: timeout() });
    const sendForm = page.evaluate(`(() => {
      const frame = document.createElement('iframe');
      frame.name = 'csrf';
      document.body.append(frame);
      const form = document.createElement('form');
      form.action = ${JSON.stringify(origin + "/api/auth/activate")};
      form.method = 'POST';
      form.target = 'csrf';
      document.body.append(form);
      form.submit();
    })()`);
    const [[csrfStatus, csrfOrigin]] = await Promise.all([denied, sendForm]);
    assert.equal(csrfStatus, 403);
    assert.equal(csrfOrigin, otherOrigin);
    console.log(
      "OK proxy sanea cabeceras y CSRF rechaza registro sin cabecera y formulario cross-site (403)",
    );
    const ordinary = logs.filter((entry) => entry === "POST /api/auth/activate").length;
    await page.open(link.href, "#activation[data-ready]");
    assert.equal(await page.evaluate("location.hash"), "");
    assert.equal(logs.filter((entry) => entry === "POST /api/auth/activate").length, ordinary);
    const confirm = () =>
      page.evaluate(`(() => {
      const form = document.querySelector('#activation');
      form.querySelector('input').value = ${JSON.stringify(member.password)};
      form.requestSubmit();
      return window.activationResult;
    })()`);
    assert.equal(await confirm(), 204);
    assert.equal((await request("session")).status, 401);
    assert.equal((await page.send("Network.getCookies", { urls: [origin] })).cookies.length, 0);
    assert.equal(await confirm(), 400);
    assert.equal((await request("login", member)).status, 204);
    const captured = [...logs, ...referers, ...backend.stdoutLines, ...backend.stderrLines].join(
      "\n",
    );
    for (const value of [activationToken, cookie.value, admin.password, member.password]) {
      assert(!captured.includes(value), "Se encontró un secreto en los logs capturados.");
    }
    console.log(
      "OK enlace #token, carga sin consumo, activación 204, sin sesión, reutilización 400 y nuevo login 204; logs sin secretos",
    );
  } finally {
    try {
      if (chrome?.pid) await stopProcess(chrome);
      if (backend) await stopProcess(backend.child);
    } finally {
      if (proxy?.listening) {
        const closed = once(proxy, "close");
        proxy.close();
        proxy.closeAllConnections();
        await closed;
      }
      await rm(workspace, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 });
    }
  }
}

run().catch((error) => {
  console.error(`Validación HTTPS fallida: ${error.message}`);
  process.exitCode = 1;
});
