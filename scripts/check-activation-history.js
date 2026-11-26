// Uso: node --import tsx scripts/check-activation-history.js <frontend generado>
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { mkdtemp, rm } from "node:fs/promises";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import path from "node:path";
import { setTimeout as delay } from "node:timers/promises";
import { fileURLToPath, pathToFileURL } from "node:url";
import { browser } from "./verify-auth-https.js";
import { stopProcess } from "./verify-generated.js";

async function until(check, description) {
  for (let attempt = 0; attempt < 100; attempt++) {
    if (await check().catch(() => false)) return;
    await delay(50);
  }
  throw new Error(description);
}

async function checkSessionNavigation(page, origin) {
  const evaluate = page.evaluate;
  const email = "main input[name=email]";
  await page.open(origin + "/missing", "#route-heading");
  assert.equal(await evaluate("sessionReads"), 0);
  await page.open(origin + "/", "#route-heading, #welcome-title");
  const publicLanding = await evaluate("!!document.querySelector('#welcome-title')");
  if (publicLanding) {
    assert.equal(await evaluate("sessionReads"), 0);
    await evaluate(`
      sessionStatus = 200;
      document.querySelector('main a[href="/login"]').click();
    `);
    await until(() => evaluate("location.pathname === '/app'"), "No se abrió el espacio.");
    assert.equal(await evaluate("sessionReads"), 1);
    await evaluate("document.querySelector('header a[href=\"/\"]').click()");
    await until(
      () => evaluate("!!document.querySelector('main a[href=\"/app\"]')"),
      "El CTA perdió la sesión conocida.",
    );
    assert.equal(await evaluate("sessionReads"), 1);
    await evaluate(`
      holdSession = true;
      document.querySelector('main a[href="/app"]').click();
    `);
    await until(() => evaluate("sessionReads === 2"), "No se revalidó la sesión al volver.");
    assert.equal(await evaluate("!!document.querySelector('main button')"), false);
    await evaluate("holdSession = false; completeSession(401)");
  }
  await until(
    () => evaluate(`location.pathname === '/login' && !!document.querySelector('${email}')`),
    "No se resolvió la raíz privada o la sesión revocada hacia login.",
  );
  if (!publicLanding) {
    assert(await evaluate("sessionSignals[0]?.aborted && sessionReads === 2"));
    assert.equal(await evaluate("workspaceSeen"), false);
  } else {
    assert.equal(await evaluate("sessionReads"), 2);
  }
  assert(await evaluate("document.activeElement.id === 'route-heading'"));
  assert(await evaluate("document.title.includes(document.activeElement.textContent)"));
  await evaluate(`document.querySelector('main form').requestSubmit()`);
  assert(await evaluate(`document.activeElement.matches('${email}[aria-invalid=true]')`));
  assert.equal(await evaluate("loginCalls"), 0);
  await evaluate(`(() => {
    const form = document.querySelector('main form');
    form.elements.email.value = 'fixture@example.test';
    form.elements.password.value = 'fixture';
    form.requestSubmit();
    form.requestSubmit();
  })()`);
  assert(await evaluate("document.querySelector('main button[type=submit]').disabled"));
  assert.equal(await evaluate("loginCalls"), 1);
  await evaluate("completeLogin(429)");
  await until(
    () =>
      evaluate(
        "!!document.querySelector('main form [role=alert]') && !document.querySelector('main button[type=submit]').disabled",
      ),
    "El rechazo conocido de login reemplazó o dejó bloqueado el formulario.",
  );
  assert(
    await evaluate("document.querySelector('main form [role=alert]').textContent.includes('30')"),
  );
  assert.equal(await evaluate("sessionReads"), 2);
  if (await evaluate("!!document.getElementById('language-select')")) {
    await evaluate(`(() => {
      const select = document.getElementById('language-select');
      select.value = 'es';
      select.dispatchEvent(new Event('change', { bubbles: true }));
    })()`);
    await until(
      () =>
        evaluate(
          "document.querySelector('main button[type=submit]').textContent.trim() === 'Acceder' && document.querySelector('main form [role=alert]').textContent.includes('Espera 30 segundos')",
        ),
      "No se tradujo el formulario ni el aviso de reintento.",
    );
  }
  if (!publicLanding) {
    await page.open(origin + "/?fixture-session=active", "#route-heading");
    await until(() => evaluate("location.pathname === '/app'"), "La raíz no resolvió hacia /app.");
    assert.equal(await evaluate("sessionReads"), 2);
  }
  console.log("PASS navegación y sesión bajo demanda con transporte controlado");
}

export async function checkActivationHistory(frontend, signal) {
  signal?.throwIfAborted();
  if (!frontend) throw new Error("Indica el directorio de un frontend generado con Auth.");
  const root = path.resolve(frontend);
  const require = createRequire(path.join(root, "package.json"));
  const { createServer } = await import(pathToFileURL(require.resolve("vite")).href);

  const profile = await mkdtemp(path.join(tmpdir(), "brixa-activation-history-"));
  let server;
  let chrome;
  const interrupt = () => {
    // La limpieza espera la misma promesa y comunica un fallo de terminación.
    void stopProcess(chrome).catch(() => {});
  };
  signal?.addEventListener("abort", interrupt, { once: true });
  try {
    server = await createServer({
      root,
      mode: "development",
      server: { host: "127.0.0.1", port: 0, hmr: false },
    });
    await server.listen();
    const origin = `http://127.0.0.1:${server.httpServer.address().port}`;
    signal?.throwIfAborted();
    chrome = spawn(
      process.env.BRIXA_CHROMIUM || "chromium",
      [
        "--headless",
        "--no-first-run",
        "--disable-dev-shm-usage",
        "--no-proxy-server",
        "--remote-debugging-pipe",
        `--user-data-dir=${profile}`,
      ],
      { stdio: ["ignore", "ignore", "ignore", "pipe", "pipe"] },
    );
    const page = await browser(chrome);
    await page.send("Page.enable");
    // Tokens sintéticos y transporte controlado. La navegación y React son reales.
    await page.send("Page.addScriptToEvaluateOnNewDocument", {
      source: `
      globalThis.activationCalls = [];
      globalThis.validationCalls = [];
      globalThis.sessionReads = 0;
      globalThis.sessionSignals = [];
      globalThis.sessionStatus = location.search === '?fixture-session=active' ? 200 : 401;
      globalThis.holdSession = false;
      globalThis.loginCalls = 0;
      globalThis.workspaceSeen = false;
      new MutationObserver(() => {
        workspaceSeen ||= Boolean(document.querySelector('main button:not([type=submit])')?.textContent.match(/Sign out|Cerrar sesión/));
      }).observe(document, { childList: true, subtree: true });
      const sessionResponse = (status) => status === 200
        ? Response.json({ userId: 'fe042593-89a0-4373-9d31-f65c7f64eb62' })
        : new Response(null, { status });
      const fetchOriginal = globalThis.fetch;
      globalThis.fetch = (url, options) => {
        if (url === '/api/auth/session') {
          sessionReads++;
          sessionSignals.push(options.signal);
          if (holdSession) {
            return new Promise(resolve => {
              globalThis.completeSession = status => resolve(sessionResponse(status));
            });
          }
          return Promise.resolve(sessionResponse(sessionStatus));
        }
        if (url === '/api/auth/login') {
          loginCalls++;
          return new Promise(resolve => {
            globalThis.completeLogin = status => resolve(new Response(null, {
              status, headers: { 'Retry-After': '30' }
            }));
          });
        }
        if (url === '/api/auth/activate') {
          return new Promise(resolve => {
            activationCalls.push({
              isSecondLink: JSON.parse(options.body).token === 'E'.repeat(43),
              signal: options.signal,
              complete: (status, code, retryAfter) => resolve(code
                ? Response.json({ error: 'Bad Request', code }, { status })
                : new Response(null, {
                  status, headers: retryAfter ? { 'Retry-After': retryAfter } : {}
                }))
            });
          });
        }
        if (url === '/api/auth/activate/validate') {
          return new Promise(resolve => {
            validationCalls.push({
              signal: options.signal,
              complete: (status, retryAfter) => resolve(status === 200
                ? Response.json({ passwordPolicy: { minLength: 12, maxLength: 50, maxBytes: 512 } })
                : new Response(null, {
                  status, headers: retryAfter ? { 'Retry-After': retryAfter } : {}
                }))
            });
          });
        }
        return fetchOriginal(url, options);
      };
    `,
    });

    await page.open(origin + "/activate", "main [role=alert]");
    const evaluate = page.evaluate;
    const history = () => page.send("Page.getNavigationHistory");
    const confirm = "Boolean(document.querySelector('button[type=submit]'))";
    assert.equal(await evaluate("sessionReads"), 0);
    const initial = await history();
    const initialEntry = initial.entries[initial.currentIndex].id;

    const startLink = async (character) => {
      const index = await evaluate("validationCalls.length");
      await evaluate(`location.hash = 'token=' + '${character}'.repeat(43); undefined`);
      await until(
        () => evaluate(`location.hash === '' && validationCalls.length === ${index + 1}`),
        "El enlace no inició exactamente una comprobación tras sanearse.",
      );
      assert.equal(await evaluate(confirm), false);
      return index;
    };
    const completeValidation = (index, status, retryAfter) =>
      evaluate(`validationCalls[${index}].complete(${status}, ${JSON.stringify(retryAfter)})`);
    const follow = async (character) => {
      await completeValidation(await startLink(character), 200);
      await until(
        () => evaluate(`location.hash === '' && ${confirm}`),
        "El enlace no quedó saneado y listo para confirmar.",
      );
    };
    const goTo = async (entryId) => {
      await page.send("Page.navigateToHistoryEntry", { entryId });
      await until(async () => {
        const { entries, currentIndex } = await history();
        return entries[currentIndex].id === entryId;
      }, "Chromium no cambió de entrada del historial.");
      await until(
        () =>
          evaluate(
            `location.pathname === '/activate' && !location.hash && !${confirm} && !!document.querySelector('main [role=alert]')`,
          ),
        "Una entrada sin fragmento conservó el formulario de un enlace anterior.",
      );
    };
    const submit = (password = "fixture password") =>
      evaluate(`(() => {
      const form = document.querySelector('main form');
      form.elements.password.value = form.elements.confirmation.value = ${JSON.stringify(password)};
      form.requestSubmit();
    })()`);

    await follow("A");
    assert(await evaluate("document.querySelector('main form').textContent.includes('12 to 50')"));
    if (await evaluate("!!document.getElementById('language-select')")) {
      await evaluate(`(() => {
        const select = document.getElementById('language-select');
        select.value = 'es';
        select.dispatchEvent(new Event('change', { bubbles: true }));
      })()`);
      await until(
        () =>
          evaluate(
            "document.querySelector('main form').textContent.includes('12 y 50 caracteres Unicode')",
          ),
        "No se tradujeron los límites efectivos en el formulario de activación.",
      );
    }
    await submit("🧱".repeat(11));
    await until(
      () =>
        evaluate(
          "document.querySelector('input[name=password]').getAttribute('aria-invalid') === 'true'",
        ),
      "No se indicó el mínimo Unicode junto al campo de contraseña.",
    );
    const sanitized = await history();
    assert.equal(sanitized.currentIndex, initial.currentIndex + 1);
    assert(!sanitized.entries.some(({ url }) => url.includes("#token=")));
    assert.equal(await evaluate("activationCalls.length"), 0);
    await goTo(initialEntry);
    await goTo(sanitized.entries[sanitized.currentIndex].id);
    assert.equal(await evaluate("activationCalls.length"), 0);

    await follow("A");
    await submit();
    await until(() => evaluate("activationCalls.length === 1"), "No se recibió la confirmación.");
    const active = await history();
    await goTo(active.entries[active.currentIndex - 1].id);
    assert(await evaluate("activationCalls[0].signal.aborted"));
    await goTo(active.entries[active.currentIndex].id);

    await follow("A");
    await submit();
    await until(() => evaluate("activationCalls.length === 2"), "No se recibió la confirmación.");
    await follow("E");
    assert(await evaluate("activationCalls[1].signal.aborted"));
    await evaluate("activationCalls[0].complete(204); activationCalls[1].complete(204)");
    assert(await evaluate(`location.pathname === '/activate' && ${confirm}`));
    assert.equal(await evaluate("activationCalls.length"), 2);

    await submit();
    await until(() => evaluate("activationCalls.length === 3"), "No se recibió el enlace nuevo.");
    assert(await evaluate("activationCalls[2].isSecondLink"));
    assert(
      await evaluate(`(() => {
      const held = JSON.stringify([history.state, {...localStorage}, {...sessionStorage}]);
      return ['A', 'E'].every(character => !held.includes(character.repeat(43)));
    })()`),
    );
    await evaluate("activationCalls[2].complete(400, 'PASSWORD_POLICY')");
    await until(
      () =>
        evaluate(
          "document.querySelector('input[name=password]')?.getAttribute('aria-invalid') === 'true'",
        ),
      "El rechazo de política no conservó el formulario.",
    );
    await submit("different fixture password");
    await until(
      () => evaluate("activationCalls.length === 4"),
      "No se pudo corregir la contraseña.",
    );
    assert(await evaluate("activationCalls[3].isSecondLink"));
    const confirmationButton = "document.querySelector('main button[type=submit]')";
    const submitAgain = "document.querySelector('main form').requestSubmit()";
    await evaluate("activationCalls[3].complete(429, undefined, '2')");
    await until(
      () =>
        evaluate(
          `${confirmationButton}?.disabled && !!document.querySelector('main [role=alert]')`,
        ),
      "La confirmación no quedó bloqueada tras HTTP 429.",
    );
    assert(
      await evaluate(`(() => {
        ${submitAgain};
        const fields = document.querySelector('main form').elements;
        return activationCalls.length === 4 &&
          fields.password.value === 'different fixture password' &&
          fields.confirmation.value === fields.password.value;
      })()`),
    );
    await until(
      () => evaluate(`${confirmationButton}?.disabled === false`),
      "La confirmación no se habilitó al vencer Retry-After.",
    );
    await evaluate(submitAgain);
    assert.equal(await evaluate("activationCalls.length"), 5);
    assert(await evaluate("activationCalls[4].isSecondLink"));

    await evaluate("activationCalls[4].complete(429, undefined, '30')");
    await until(
      () =>
        evaluate(
          `${confirmationButton}?.disabled && !!document.querySelector('main [role=alert]')`,
        ),
      "No se bloqueó el reenvío antes de cambiar de enlace.",
    );
    await follow("A");
    assert(await evaluate(`${confirmationButton}?.disabled === false`));
    assert(await evaluate("document.querySelector('main input[name=password]').value === ''"));
    await submit();
    assert.equal(await evaluate("activationCalls.length"), 6);
    assert.equal(await evaluate("activationCalls[5].isSecondLink"), false);
    await evaluate("activationCalls[5].complete(204)");
    await until(
      () => evaluate("location.pathname === '/login' && location.hash === ''"),
      "La confirmación del enlace vigente no terminó en el login.",
    );
    await until(
      () => evaluate("sessionReads === 1 && !!document.querySelector('main input[name=email]')"),
      "El paso de activación a login debe comprobar la sesión una sola vez.",
    );
    await page.open(origin + "/activate#token=" + "A".repeat(43), "main [role=status]");
    await until(
      () => evaluate("location.hash === '' && validationCalls.length === 1"),
      "La carga directa no inició exactamente una comprobación en Strict Mode.",
    );
    const later = await startLink("E");
    assert(await evaluate("validationCalls[0].signal.aborted"));
    await completeValidation(0, 200);
    assert.equal(await evaluate(confirm), false);
    await completeValidation(later, 500);
    const retryButton = "document.querySelector('main form button[type=button]')";
    await until(() => evaluate(`!!${retryButton}`), "Falta el reintento tras el error temporal.");
    assert.equal(await evaluate("validationCalls.length"), later + 1);
    await evaluate(`${retryButton}.click(); ${retryButton}?.click()`);
    await until(
      () => evaluate(`validationCalls.length === ${later + 2}`),
      "No se inició el reintento.",
    );
    await completeValidation(later + 1, 429, "1");
    await until(() => evaluate(`${retryButton}?.disabled`), "No se respetó Retry-After.");
    await evaluate(`${retryButton}.click()`);
    assert.equal(await evaluate("validationCalls.length"), later + 2);
    await until(
      () => evaluate(`${retryButton}?.disabled === false`),
      "El reintento no se habilitó al vencer Retry-After.",
    );
    assert.equal(await evaluate("validationCalls.length"), later + 2);
    await evaluate(`${retryButton}.click()`);
    await until(
      () => evaluate(`validationCalls.length === ${later + 3}`),
      "No se inició la comprobación.",
    );
    await completeValidation(later + 2, 400);
    await until(
      () => evaluate(`! ${confirm} && !!document.querySelector('main a[href="/login"]')`),
      "Falta el estado uniforme de enlace inválido.",
    );
    assert(
      await evaluate("location.hash === '' && sessionReads === 0 && activationCalls.length === 0"),
    );
    await evaluate("globalThis.beforeReload = true");
    await page.send("Page.reload");
    await until(
      () =>
        evaluate(
          `!globalThis.beforeReload && sessionReads === 0 && !${confirm} && !!document.querySelector('main [role=alert]')`,
        ),
      "La recarga de la entrada saneada recuperó el token.",
    );
    console.log(
      "PASS historial de activación, cambio de enlace y respuestas obsoletas en Strict Mode",
    );
    await checkSessionNavigation(page, origin);
  } finally {
    signal?.removeEventListener("abort", interrupt);
    try {
      await stopProcess(chrome);
    } finally {
      try {
        await server?.close();
      } finally {
        await rm(profile, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 });
      }
    }
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  await checkActivationHistory(process.argv[2]);
}
