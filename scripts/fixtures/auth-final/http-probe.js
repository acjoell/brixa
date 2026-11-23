import assert from "node:assert/strict";
import { setTimeout } from "node:timers/promises";

export const adminEmail = "admin@example.test";
const password = "recovered test credential"; // Contrato ⑤-G, después de la recuperación.
const origin = "https://app.example.test";

export function authClient(port) {
  const base = "http://127.0.0.1:" + port;
  const request = (path, { method, body, headers } = {}) =>
    fetch(base + path, {
      method,
      headers: { "X-Forwarded-Proto": "https", ...headers },
      body,
      signal: globalThis.AbortSignal.timeout(10_000),
    });
  const post = (path, body, headers) =>
    request(path, {
      method: "POST",
      body: body === undefined ? undefined : JSON.stringify(body),
      headers: {
        Origin: origin,
        "X-Requested-With": "XMLHttpRequest",
        ...(body === undefined ? {} : { "Content-Type": "application/json" }),
        ...headers,
      },
    });
  return {
    request,
    post,
    login: (email = adminEmail, credential = password) =>
      post("/auth/login", { email, password: credential }),
  };
}

export async function checkCookieIsolation(client) {
  const login = await client.login();
  assert.equal(login.status, 204);
  const cookie = login.headers.get("set-cookie").split(";")[0];
  const token = cookie.split("=")[1];
  assert.equal(await login.text(), "");
  const session = (headers) => client.request("/auth/session", { headers });
  assert.equal((await session({ Cookie: cookie })).status, 200);
  assert.equal((await session({ Authorization: "Bearer " + token })).status, 401);
  assert.equal((await session({ Cookie: cookie, Authorization: "Bearer " + token })).status, 401);
  assert.equal(
    (await client.post("/auth/logout", undefined, { Cookie: cookie, Origin: "null" })).status,
    403,
  );
  assert.equal((await session({ Cookie: cookie })).status, 200);
  assert.equal((await client.post("/auth/logout", undefined, { Cookie: cookie })).status, 204);
  assert.equal((await session({ Cookie: cookie })).status, 401);
}

async function checkMemory() {
  const client = authClient(process.env.PORT);
  let ready = false;
  for (let wait = 0; wait < 60 && !ready; wait++) {
    ready = await client.request("/health").then(
      async (response) => {
        await response.body?.cancel();
        return response.status === 200;
      },
      () => false,
    );
    if (!ready) await setTimeout(200);
  }
  assert(ready, "No arrancó el backend limitado.");
  const before = await client.login();
  assert.equal(before.status, 204);
  // Identificadores distintos para que las reservas antiabuso no oculten la cola de Argon2.
  const pending = Array.from({ length: 36 }, (_, index) =>
    client.login("memory-" + index + "@example.test"),
  );
  let limited = 0;
  let rejected = 0;
  for (const response of await Promise.all(pending)) {
    if (response.status === 503) {
      assert.equal(response.headers.get("Retry-After"), "5");
      limited++;
    } else {
      assert.equal(response.status, 401);
      rejected++;
    }
    await response.body?.cancel();
  }
  assert(limited > 0 && rejected >= 2, "La ráfaga debe verificar contraseñas y saturar Argon2id.");
  assert.equal((await client.login()).status, 204);
  console.log(
    JSON.stringify({ rejected401: rejected, saturated503: limited, retryAfter: 5, recovery: 204 }),
  );
}

if (process.argv[2] === "--memory") await checkMemory();
