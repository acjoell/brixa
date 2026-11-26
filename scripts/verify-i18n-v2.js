#!/usr/bin/env node
/**
 * Scripts de V2 (SSR) para verify-i18n.
 * Se ejecuta en un subproceso aislado desde verifyI18n() para evitar que
 * Vite createServer contamine process.env.NODE_ENV del proceso padre.
 *
 * Uso: node scripts/verify-i18n-v2.js <frontendDir> <language>
 */
import fs from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import { pathToFileURL } from "node:url";

// Las etiquetas para ocultar se activan tras pulsar el control en el navegador.
const interactionOnly = new Set([
  "auth.hidePassword",
  "auth.hideNewPassword",
  "auth.hideConfirmation",
]);

const [frontendDir, language] = process.argv.slice(2);
if (!frontendDir || !language) {
  console.error("Uso: node verify-i18n-v2.js <frontendDir> <language>");
  process.exit(1);
}

function getLeaves(obj, prefix = "") {
  const leaves = [];
  for (const [k, v] of Object.entries(obj)) {
    const fullKey = prefix ? `${prefix}.${k}` : k;
    if (typeof v === "object" && v !== null) {
      leaves.push(...getLeaves(v, fullKey));
    } else if (typeof v === "string") {
      leaves.push({ key: fullKey, val: v });
    }
  }
  return leaves;
}

const passwordPolicy = {
  minLength: 12,
  maxLength: 50,
  maxBytes: 512,
};

function cleanVal(str) {
  return str
    .replace(/<[^>]+>/g, "")
    .replace("{seconds}", "30")
    .replace(/\{(minLength|maxLength|maxBytes)\}/g, (_, key) => String(passwordPolicy[key]))
    .trim();
}

const req = createRequire(path.join(frontendDir, "package.json"));
const { createServer } = await import(pathToFileURL(req.resolve("vite")).href);
const { renderToString } = await import(pathToFileURL(req.resolve("react-dom/server")).href);
const React = (await import(pathToFileURL(req.resolve("react")).href)).default;

const enJson = JSON.parse(
  fs.readFileSync(path.join(frontendDir, "src", "locales", "en.json"), "utf-8"),
);
const esJson = JSON.parse(
  fs.readFileSync(path.join(frontendDir, "src", "locales", "es.json"), "utf-8"),
);

const vite = await createServer({
  root: frontendDir,
  server: { middlewareMode: true },
  appType: "custom",
});

try {
  const appExt = language === "ts" ? "tsx" : "jsx";
  const codeExt = language === "ts" ? "ts" : "js";
  const { default: i18n } = await vite.ssrLoadModule(`/src/i18n.${codeExt}`);
  const { I18nextProvider } = await vite.ssrLoadModule("react-i18next");
  const hasAuth =
    req(path.join(frontendDir, "package.json")).dependencies?.["react-router"] !== undefined;
  const hasWelcome = fs.existsSync(path.join(frontendDir, "src", `App.${appExt}`));
  const projectName = "V2 generated project";

  let views;
  if (hasAuth) {
    const { AuthRoutes } = await vite.ssrLoadModule(`/src/features/auth/AuthApp.${appExt}`);
    const { SessionContext } = await vite.ssrLoadModule(
      `/src/features/auth/sessionContext.${codeExt}`,
    );
    const { ActivationForm, LoginForm } = await vite.ssrLoadModule(
      `/src/features/auth/AuthForms.${appExt}`,
    );
    // AuthRoutes usa la instancia externa que Node resuelve en SSR.
    const { MemoryRouter } = await import(pathToFileURL(req.resolve("react-router")).href);
    const checking = { status: "checking" };
    const routes = [
      ["/login", { status: "unauthenticated" }],
      ["/login", { status: "error", failure: { kind: "http", status: 429 } }],
      ["/login", { status: "error", failure: { kind: "http", status: 503 } }],
      ["/login", { status: "error", failure: { kind: "communication" } }],
      ["/app", checking],
      ["/app", { status: "unauthenticated" }],
      ["/app", { status: "error", failure: { kind: "unexpected_response" } }],
      ["/app", { status: "authenticated", identity: { userId: "v2-fixture" } }],
      ["/activate", checking],
      ["/missing", checking],
    ];
    routes.unshift(["/", checking]);
    if (hasWelcome) routes.unshift(["/", { status: "authenticated" }]);
    views = routes.map(
      ([route, state]) =>
        (props) =>
          React.createElement(
            MemoryRouter,
            { initialEntries: [route] },
            React.createElement(
              SessionContext,
              { value: { state } },
              React.createElement(AuthRoutes, props),
            ),
          ),
    );
    views.push(
      ...[
        "loginRejected",
        "loginSessionMissing",
        "loginHttpRejected",
        "loginPending",
        "loginUnconfirmed",
        "activationSuccess",
      ].map((feedback) => () => React.createElement(LoginForm, { feedback })),
      () =>
        React.createElement(LoginForm, {
          feedback: "rateLimited",
          retryAfter: 30,
          fieldErrors: { email: "emailRequired", password: "passwordRequired" },
        }),
      () => React.createElement(LoginForm, { fieldErrors: { email: "emailInvalid" } }),
      ...[
        "operationPending",
        "passwordMismatch",
        "passwordLimits",
        "passwordPolicyRejected",
        "activationUnconfirmed",
      ].map(
        (feedback) => () =>
          React.createElement(ActivationForm, {
            feedback,
            onSubmit() {},
            passwordPolicy,
          }),
      ),
      () => React.createElement(ActivationForm, { feedback: "activationChecking" }),
      () =>
        React.createElement(ActivationForm, {
          feedback: "activationValidationError",
          onRetry() {},
        }),
      () =>
        React.createElement(
          MemoryRouter,
          null,
          React.createElement(ActivationForm, { feedback: "activationInvalid" }),
        ),
    );
  } else {
    const { default: App } = await vite.ssrLoadModule(`/src/App.${appExt}`);
    views = [(props) => React.createElement(App, props)];
  }

  const enLeaves = getLeaves(enJson);
  for (const [locale, catalog] of [
    ["en", enJson],
    ["es", esJson],
  ]) {
    await i18n.changeLanguage(locale);
    const html = views
      .map((view) =>
        renderToString(
          React.createElement(
            I18nextProvider,
            { i18n },
            view(locale === "es" ? { projectName } : undefined),
          ),
        ),
      )
      .join("\n");
    const visible = html.replace(/<[^>]+>/g, "");
    const leaves = getLeaves(catalog);

    if (locale === "es" && !visible.includes(projectName)) {
      throw new Error("[V2 SSR es] No se renderizó el nombre del proyecto");
    }

    for (const { key, val } of leaves) {
      const cleaned = cleanVal(val);
      const present = visible.includes(cleaned) || html.includes(`aria-label="${cleaned}"`);
      const welcomeOnly =
        hasAuth &&
        !hasWelcome &&
        (key.startsWith("home.") || key.startsWith("launchpad.") || key === "auth.workspaceAction");
      const privateOnly = hasAuth && hasWelcome && key === "auth.sessionTitle";
      if (present === (welcomeOnly || privateOnly || interactionOnly.has(key))) {
        throw new Error(
          `[V2 SSR ${locale}] Valor ${present ? "inesperado" : "ausente"} en HTML: "${cleaned}"`,
        );
      }
    }

    for (const { key, val } of enLeaves) {
      if (visible.includes(key) || html.includes(`aria-label="${key}"`)) {
        throw new Error(`[V2 SSR ${locale}] Clave de traducción visible: "${key}"`);
      }
      if (locale === "es") {
        const localized = leaves.find((leaf) => leaf.key === key);
        const english = cleanVal(val);
        if (
          localized &&
          english !== cleanVal(localized.val) &&
          (visible.includes(english) || html.includes(`aria-label="${english}"`))
        ) {
          throw new Error(`[V2 SSR es] Valor inglés encontrado en HTML español: "${english}"`);
        }
      }
    }
  }
} finally {
  await vite.close();
}
