import assert from "node:assert/strict";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import https from "node:https";
import { tmpdir } from "node:os";
import path from "node:path";
import { setTimeout as delay } from "node:timers/promises";
import { URL } from "node:url";
import { generate } from "../src/generator/generate.ts";
import { checkActivationHistory } from "./check-activation-history.js";
import { startDockerUi, startSqliteUi } from "./fixtures/auth-https/ui-deployment.js";
import { runStep, verifyAuthFrontendTests } from "./verify-auth.js";
import {
  address,
  browser,
  certificates,
  navigatePage,
  secret,
  spawnTlsBrowser,
} from "./verify-auth-https.js";
import { stopProcess } from "./verify-generated.js";
import { verifyI18n } from "./verify-i18n.js";

const variants = [
  {
    id: "A",
    language: "ts",
    database: "postgres",
    docker: true,
    authAppMode: "private",
    i18n: true,
    apiDocs: true,
  },
  {
    id: "B",
    language: "js",
    database: "sqlite",
    docker: false,
    authAppMode: "public",
    i18n: false,
    apiDocs: false,
  },
];
const loginInput = 'main input[autocomplete="username"]';
const activationInput = 'main input[name="confirmation"]';
const cspSource = new URL("../src/templates/docker/fullstack/frontend/nginx.conf", import.meta.url);

async function revokeOutsideBrowser(origin, ca, cookie) {
  const { hostname, host, port } = new URL(origin);
  return new Promise((resolve, reject) => {
    const request = https.request(
      {
        hostname: address,
        servername: hostname,
        port,
        ca,
        method: "POST",
        path: "/api/auth/logout",
        headers: {
          Host: host,
          Origin: origin,
          Cookie: `${cookie.name}=${cookie.value}`,
          "X-Requested-With": "XMLHttpRequest",
        },
        signal: globalThis.AbortSignal.timeout(5000),
      },
      (response) => {
        response.resume();
        resolve(response.statusCode);
      },
    );
    request.on("error", () => reject(new Error("No se pudo revocar la sesión de prueba.")));
    request.end();
  });
}

async function verifyBrowser(page, { origin, ca, csp, variant, admin, messages, signal }) {
  const evaluate = page.evaluate;
  await page.send("Page.enable");
  await page.send("Page.addScriptToEvaluateOnNewDocument", {
    source: `
      globalThis.activationRequests = 0;
      globalThis.activationStatuses = [];
      globalThis.activationValidationRequests = 0;
      globalThis.activationValidationStatuses = [];
      globalThis.cspViolations = [];
      addEventListener('securitypolicyviolation', event => cspViolations.push(event.violatedDirective));
      const originalFetch = globalThis.fetch;
      globalThis.fetch = async (url, options) => {
        if (url === '/api/auth/activate') activationRequests++;
        if (url === '/api/auth/activate/validate') activationValidationRequests++;

        const response = await originalFetch(url, options);

        if (url === '/api/auth/activate') activationStatuses.push(response.status);
        if (url === '/api/auth/activate/validate') activationValidationStatuses.push(response.status);

        return response;
      };
    `,
  });

  async function until(expression, description) {
    const deadline = Date.now() + 10000;
    while (Date.now() < deadline) {
      signal.throwIfAborted();
      if (await evaluate(expression).catch(() => false)) return;
      await delay(50, undefined, { signal });
    }
    throw new Error(description);
  }
  const at = (route, selector) =>
    until(
      `location.pathname === ${JSON.stringify(route)} && Boolean(document.querySelector(${JSON.stringify(selector)}))`,
      `No se mostró la vista esperada en ${route} (selector: ${selector}).`,
    );
  const text = (value) =>
    until(
      `document.querySelector('main')?.textContent.includes(${JSON.stringify(value)})`,
      "No se mostró el mensaje esperado.",
    );
  const focused = () =>
    until(
      "document.activeElement.id === 'route-heading' && document.querySelector('[role=status]')?.textContent === document.activeElement.textContent && document.title.includes(document.activeElement.textContent)",
      "La ruta no actualizó el título, el foco o el anuncio.",
    );
  const checkCsp = async () =>
    assert.deepEqual(await evaluate("globalThis.cspViolations ?? []"), []);
  async function go(route, step) {
    await checkCsp();
    await evaluate("globalThis.brixaPreviousDocument = true");
    await navigatePage(page.send, origin + route, step);
    await freshDocument();
  }
  const freshDocument = () =>
    until(
      "!globalThis.brixaPreviousDocument && location.protocol === 'https:'",
      "No cargó el documento HTTPS.",
    );
  const reload = async () => {
    await checkCsp();
    await evaluate("globalThis.brixaPreviousDocument = true");
    await page.send("Page.reload");
    await freshDocument();
  };
  const status = (route) =>
    evaluate(`fetch(${JSON.stringify(route)}).then(response => response.status)`);
  const login = (email, password) =>
    evaluate(`(() => {
    const form = document.querySelector('main form');
    form.elements.email.value = ${JSON.stringify(email)};
    form.elements.password.value = ${JSON.stringify(password)};
    form.requestSubmit();
  })()`);
  const activate = (password) =>
    evaluate(`(() => {
    const form = document.querySelector('main form');
    form.elements.password.value = form.elements.confirmation.value = ${JSON.stringify(password)};
    form.requestSubmit();
  })()`);
  const cookies = async () => (await page.send("Network.getCookies", { urls: [origin] })).cookies;
  const logout = async () => {
    await evaluate("document.querySelector('main button').click()");
    await at("/login", loginInput);
    assert.equal(await status("/api/auth/session"), 401);
  };

  await go("/", "entrada inicial");
  if (variant.authAppMode === "public") {
    await at("/", "#welcome-title");
    assert(
      await evaluate(
        "document.title.includes(document.querySelector('#welcome-title').textContent)",
      ),
    );
    await evaluate("document.querySelector('main a[href=\"/login\"]').click()");
  }
  await at("/login", loginInput);
  await focused();
  assert(await evaluate("isSecureContext"));
  assert.equal(
    await evaluate("fetch('/login').then(r => r.headers.get('Content-Security-Policy'))"),
    csp,
  );
  if (variant.apiDocs) assert.equal(await status("/api/docs/"), 401);
  await go("/app", "acceso directo al área privada");
  await at("/login", loginInput);
  await focused();

  for (const type of ["keyDown", "keyUp"]) {
    await page.send("Input.dispatchKeyEvent", {
      type,
      key: "Tab",
      code: "Tab",
      windowsVirtualKeyCode: 9,
    });
  }
  assert(
    await evaluate(
      "document.activeElement.autocomplete === 'username' && document.activeElement.labels.length === 1 && document.activeElement.matches(':focus-visible')",
    ),
  );
  if (variant.i18n) {
    await evaluate(`(() => {
      const select = document.querySelector('#language-select');
      select.value = 'es';
      select.dispatchEvent(new Event('change', { bubbles: true }));
    })()`);
    await text("Iniciar sesión");
    await evaluate(`(() => {
      const select = document.querySelector('#language-select');
      select.value = 'en';
      select.dispatchEvent(new Event('change', { bubbles: true }));
    })()`);
    await text(messages.loginTitle);
  } else {
    assert(!(await evaluate("Boolean(document.querySelector('#language-select'))")));
  }
  await login(admin.email, "wrong-fixture-password");
  await text(messages.loginRejected);
  assert.equal(await status("/api/auth/session"), 401);
  await login(admin.email, admin.password);
  await at("/app", "main button");
  await focused();
  assert.equal(await status("/api/auth/session"), 200);
  const session = (await cookies()).find(({ name }) => name.startsWith("__Host-"));
  assert(
    session?.secure && session?.httpOnly && session?.sameSite === "Lax" && session.path === "/",
    "La cookie emitida no cumple el contrato HTTPS.",
  );
  assert(
    !(await evaluate("document.cookie.includes('__Host-')")),
    "JavaScript puede leer la cookie.",
  );
  if (variant.apiDocs) {
    assert.equal(await status("/api/docs/"), 200);
    assert.equal(await status("/api/docs/swagger-ui-init.js"), 200);
  }
  await reload();
  await at("/app", "main button");
  await text(messages.appWelcome);
  await go("/login", "acceso a login con sesión");
  await at("/app", "main button");

  const member = { email: "member@example.test", password: secret() };
  const registration = await evaluate(`(async () => {
    const response = await fetch('/api/auth/register', {
      method: 'POST',
      headers: {'Content-Type':'application/json', 'X-Requested-With':'XMLHttpRequest'},
      body: JSON.stringify({ email: ${JSON.stringify(member.email)} }),
    });
    return { status: response.status, url: response.status === 201 ? (await response.json()).activationUrl : null };
  })()`);
  assert.equal(registration.status, 201);
  const link = new URL(registration.url);
  assert(
    link.origin === origin &&
      link.pathname === "/activate" &&
      !link.search &&
      /^#token=[A-Za-z0-9_-]{43}$/.test(link.hash),
    "El enlace no apunta a la activación del mismo origen.",
  );
  await logout();
  await go(link.pathname + link.hash, "apertura del enlace de activación");
  await at("/activate", activationInput);
  assert.equal(await evaluate("activationValidationRequests"), 1);
  assert.deepEqual(await evaluate("activationValidationStatuses"), [200]);
  assert(
    await evaluate("location.hash === '' && activationRequests === 0"),
    "Abrir el enlace debe sanear la URL y dejar la cuenta pendiente.",
  );
  assert.deepEqual(await evaluate("activationStatuses"), []);
  await focused();
  await activate(member.password);
  await at("/login", loginInput);
  await text(messages.activationSuccess);
  assert.deepEqual(await evaluate("activationStatuses"), [204]);
  assert.equal(await status("/api/auth/session"), 401);
  assert.equal((await cookies()).length, 0);
  await go(link.pathname + link.hash, "reapertura del enlace consumido");
  await text(messages.activationInvalid);

  assert.equal(await evaluate("location.pathname"), "/activate");
  assert.equal(await evaluate("activationValidationRequests"), 1);
  assert.deepEqual(await evaluate("activationValidationStatuses"), [400]);

  assert(
    !(await evaluate(`Boolean(document.querySelector(${JSON.stringify(activationInput)}))`)),
    "Un enlace consumido no debe mostrar el formulario de activación.",
  );

  assert.equal(await evaluate("activationRequests"), 0);
  assert.deepEqual(await evaluate("activationStatuses"), []);
  assert.equal(await evaluate("location.hash"), "");
  assert(
    await evaluate(`(() => {
    const retained = JSON.stringify([history.state, {...localStorage}, {...sessionStorage}, document.body.textContent]);
    return ${JSON.stringify([link.hash.slice(7), admin.password, member.password, session.value])}.every(value => !retained.includes(value));
  })()`),
    "Se encontró una credencial fuera del flujo en memoria.",
  );
  await checkCsp();
  await go("/login", "login de la cuenta activada");
  await at("/login", loginInput);
  await login(member.email, member.password);
  await at("/app", "main button");
  const stale = (await cookies()).find(({ name }) => name.startsWith("__Host-"));
  assert(stale, "El nuevo usuario no recibió cookie.");
  assert.equal(await revokeOutsideBrowser(origin, ca, stale), 204);
  assert(
    (await cookies()).some(({ value }) => value === stale.value),
    "La simulación perdió la cookie revocada.",
  );
  assert.equal(await status("/api/auth/session"), 401);
  await reload();
  await at("/login", loginInput);
  await focused();
  await checkCsp();
}

async function verifyVariant(variant, signal) {
  await using cleanup = new globalThis.AsyncDisposableStack();
  const workspace = await mkdtemp(path.join(tmpdir(), "brixa-auth-ui-"));
  cleanup.defer(() =>
    rm(workspace, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 }),
  );
  const project = path.join(workspace, "project");
  const { id, ...options } = variant;
  const result = await generate({
    ...options,
    modality: "fullstack",
    auth: true,
    outputDir: project,
  });
  assert(result.ok, "Falló la generación del proyecto de prueba.");
  const frontend = path.join(project, "frontend");
  const step = (label, args, timeoutMs = 120_000) =>
    runStep(label, "npm", args, frontend, { timeoutMs, signal });
  await step("Instalación frontend", ["install", "--no-audit", "--no-fund"], 300_000);
  await step("Lint frontend", ["run", "lint"]);
  await verifyAuthFrontendTests(frontend, signal);
  if (!variant.docker) await step("Build frontend", ["run", "build"]);
  await checkActivationHistory(frontend, signal);

  const tlsFixture = await certificates(workspace);
  const csp = (await readFile(cspSource, "utf8")).match(/Content-Security-Policy "([^"]+)"/)?.[1];
  assert(csp, "La plantilla Nginx no contiene la CSP esperada.");
  const admin = { email: "admin@example.test", password: secret() };
  const deployment = variant.docker ? startDockerUi : startSqliteUi;
  const origin = await deployment({
    project,
    workspace,
    tls: tlsFixture.tls,
    csp,
    admin,
    cleanup,
    signal,
  });
  if (variant.i18n) await verifyI18n(frontend, variant.language);
  signal.throwIfAborted();
  const chrome = spawnTlsBrowser(tlsFixture);
  cleanup.defer(() => stopProcess(chrome));
  const interrupt = () => {
    // La limpieza espera la misma promesa y comunica un fallo de terminación.
    void stopProcess(chrome).catch(() => {});
  };
  signal.addEventListener("abort", interrupt, { once: true });
  cleanup.defer(() => signal.removeEventListener("abort", interrupt));
  const page = await browser(chrome);
  const messages = JSON.parse(
    await readFile(path.join(frontend, "src/features/auth/messages.json"), "utf8"),
  );
  await verifyBrowser(page, {
    origin,
    ca: await readFile(path.join(workspace, "ca.pem")),
    csp,
    admin,
    messages,
    variant,
    signal,
  });
  console.log(`PASS Auth UI ${id}`);
}

const choice = process.argv[2];
if (
  process.platform !== "linux" ||
  process.argv.length > 3 ||
  (choice && !["A", "B"].includes(choice))
) {
  throw new Error("Uso en Linux: npm run verify:auth-ui [-- A|B]");
}
const controller = new globalThis.AbortController();
const interrupt = () => controller.abort(new Error("Verificación interrumpida."));
process.once("SIGINT", interrupt);
process.once("SIGTERM", interrupt);
try {
  for (const variant of variants.filter(({ id }) => !choice || choice === id)) {
    controller.signal.throwIfAborted();
    await verifyVariant(variant, controller.signal);
  }
} catch (error) {
  console.error(`verify:auth-ui falló: ${error.message}`);
  process.exitCode = 1;
} finally {
  process.off("SIGINT", interrupt);
  process.off("SIGTERM", interrupt);
}
