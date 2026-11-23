import assert from "node:assert/strict";
import { randomBytes, randomUUID } from "node:crypto";
import { once } from "node:events";
import { existsSync } from "node:fs";

import { URL, URLSearchParams } from "node:url";

import {
  activationTokens,
  auditLogSystem,
  initialAdministrator,
  sessions,
} from "../src/db/schema.js";
import { activationTokenDigest } from "../src/auth/activation-token.js";
import { tokenDigest } from "../src/auth/sessions.js";

export async function checkAuthLifecycle(mode, database, writer, asAdministrator) {
  const { bootstrapInitialAdministrator } = await import("../src/auth/bootstrap.js");
  const { recoverInitialAdministrator } = await import("../src/auth/recover-admin.js");
  const { getArgon2Limiter } = await import("../src/auth/argon2-limiter.js");
  const { initializeAuthHttp } = await import("../src/auth/http-runtime.js");
  const { app } = await import("../src/app.js");
  const origin = "https://app.example.test";
  const page = origin + "/activar";
  const env = {
    AUTH_PUBLIC_ORIGIN: origin,
    ACTIVATION_PAGE_URL: page,
    AUTH_TRUSTED_PROXIES: "127.0.0.1",
    LOGIN_ABUSE_HMAC_KEY: randomBytes(32).toString("hex"),
    LOGIN_IP_REQUEST_LIMIT: "30",
  };
  const adminEmail = "admin@example.test";
  const email = "member@example.test";
  const initial = "bootstrap test credential";
  const activated = "activation test credential";
  const changed = "updated test credential";
  const recovered = "recovered test credential";
  const { userId: adminId } = await asAdministrator((owner) =>
    bootstrapInitialAdministrator(owner, { email: adminEmail, password: initial }),
  );

  await initializeAuthHttp(mode, "brixa-lifecycle", database, writer, env);
  const server = app.listen(0, "127.0.0.1");
  try {
    await once(server, "listening");
    const base = "http://127.0.0.1:" + server.address().port;
    const requestId = (response) => {
      const id = response.headers.get("X-Request-Id");
      assert(id);
      return id;
    };

    const proxy = { "X-Forwarded-Proto": "https" };
    const get = (path, proof) =>
      fetch(base + path, { headers: { ...proxy, ...proof?.header }, redirect: "manual" });
    const post = (path, body, proof, requestOrigin = origin) =>
      fetch(base + "/auth" + path, {
        method: "POST",
        headers: {
          ...proxy,
          ...proof?.header,
          Origin: requestOrigin,
          "X-Requested-With": "XMLHttpRequest",
          ...(body ? { "Content-Type": "application/json" } : {}),
        },
        ...(body ? { body: JSON.stringify(body) } : {}),
      });
    const login = async (email, password) => {
      const response = await post("/login", { email, password });
      const id = requestId(response);
      if (mode === "cookie") {
        assert.equal(response.status, 204);
        assert.equal(await response.text(), "");
        const cookie = response.headers.get("Set-Cookie") ?? "";
        assert(/^__Host-brixa-lifecycle=[a-f0-9]{64};/.test(cookie) && cookie.includes("; Secure"));
        const pair = cookie.split(";")[0];
        return { header: { Cookie: pair }, token: pair.slice(-64), requestId: id };
      }
      assert.equal(response.status, 200);
      assert.equal(response.headers.get("Set-Cookie"), null);
      const { token } = await response.json();
      assert(tokenDigest(token));
      return { header: { Authorization: "Bearer " + token }, token, requestId: id };
    };
    const session = async (proof, userId) => {
      const response = await get("/auth/session", proof);
      assert.equal(response.status, 200);
      assert.deepEqual(await response.json(), { userId });
    };
    const absentSession = async (proof) =>
      assert.equal((await get("/auth/session", proof)).status, 401);

    const admin = await login(adminEmail, initial);
    const adminSecond = await login(adminEmail, initial);
    assert.equal((await fetch(base + "/auth/session", { headers: admin.header })).status, 403);
    const docsEnabled = existsSync("src/docs/openapi.json");
    assert.equal((await get("/docs/swagger-ui-init.js")).status, docsEnabled ? 401 : 404);
    const docs = await get("/docs/swagger-ui-init.js", admin);
    assert.equal(docs.status, docsEnabled ? 200 : 404);
    if (docsEnabled) {
      assert.equal(docs.headers.get("Cache-Control"), "no-store");
      assert(!(await docs.text()).includes(admin.token));
    }
    assert.equal((await get("/openapi.json")).status, 404);
    if (mode === "cookie")
      assert.equal(
        (await post("/register", { email }, admin, "https://other.example.test")).status,
        403,
      );
    const registration = await post("/register", { email }, admin);
    assert.equal(registration.status, 201);
    assert.equal(registration.headers.get("Cache-Control"), "no-store");
    const { userId, activationUrl } = await registration.json();

    const link = new URL(activationUrl);
    assert.equal(link.origin + link.pathname, page);
    assert.equal(link.search, "");
    const activation = new URLSearchParams(link.hash.slice(1)).get("token") ?? "";
    const digest = activationTokenDigest(activation);
    assert(digest);
    assert.deepEqual(
      await database.select({ digest: activationTokens.tokenDigest }).from(activationTokens),
      [{ digest }],
    );

    const confirmation = await post("/activate", { token: activation, password: activated });
    assert.equal(confirmation.status, 204);
    assert.equal(await confirmation.text(), "");
    assert.equal(confirmation.headers.get("Set-Cookie"), null);
    assert.equal(
      (await database.select({ digest: sessions.sessionTokenHash }).from(sessions)).length,
      2,
    );
    const member = await login(email, activated);
    const otherClient = await login(email, activated);
    await session(member, userId);
    const denial = await post("/register", { email: "unexpected@example.test" }, member);
    assert.equal(denial.status, 403);
    const change = await post(
      "/password",
      { currentPassword: activated, newPassword: changed },
      member,
    );
    assert.equal(change.status, 204);
    await absentSession(member);
    await absentSession(otherClient);
    await session(admin, adminId);
    const obsolete = await post("/login", { email, password: activated });
    assert.equal(obsolete.status, 401);
    const newMember = await login(email, changed);
    const loggedOut = await post("/logout", undefined, newMember);
    assert.equal(loggedOut.status, 204);
    await absentSession(newMember);
    const unaffectedMember = await login(email, changed);

    const recoveryId = randomUUID();
    assert.equal(
      await asAdministrator((owner) => recoverInitialAdministrator(owner, recovered, recoveryId)),
      true,
    );
    await absentSession(admin);
    await absentSession(adminSecond);
    await session(unaffectedMember, userId);
    assert.equal((await post("/login", { email: adminEmail, password: initial })).status, 401);
    const finalAdmin = await login(adminEmail, recovered);
    await session(finalAdmin, adminId);

    const gate = Promise.withResolvers();
    const tasks = Array.from({ length: 10 }, () => getArgon2Limiter()(() => gate.promise));
    let saturationId;
    try {
      const saturated = await post("/login", { email, password: changed });
      assert.equal(saturated.status, 503);
      assert.equal(saturated.headers.get("Retry-After"), "5");
      saturationId = requestId(saturated);
    } finally {
      gate.resolve();
      await Promise.allSettled(tasks);
    }
    const unknown = { email: "unknown@example.test", password: changed };
    for (let attempt = 0; attempt < 5; attempt++)
      assert.equal((await post("/login", unknown)).status, 401);
    const limited = await post("/login", unknown);
    assert.equal(limited.status, 429);
    assert(Number(limited.headers.get("Retry-After")) > 0);

    const audit = await asAdministrator((owner) => owner.select().from(auditLogSystem));
    const checkEvent = (event, actorId, id) =>
      assert.equal(
        audit.filter(
          (row) =>
            row.event === event &&
            row.actorId === actorId &&
            (id === undefined || row.requestId === id),
        ).length,
        1,
        event,
      );
    checkEvent("bootstrap", null);
    checkEvent("user_created", adminId, requestId(registration));
    checkEvent("activation_token_issued", adminId, requestId(registration));
    checkEvent("account_activated", null, requestId(confirmation));
    checkEvent("activation_token_consumed", null, requestId(confirmation));
    checkEvent("platform_admin_access_denied", userId, requestId(denial));
    checkEvent("password_changed", userId, requestId(change));
    checkEvent("logout", userId, requestId(loggedOut));
    checkEvent("initial_admin_password_recovered", null, recoveryId);
    checkEvent("login_failed", null, requestId(obsolete));
    checkEvent("login_succeeded", userId, newMember.requestId);
    checkEvent("login_succeeded", adminId, finalAdmin.requestId);
    checkEvent("brute_force_detected", null);
    assert(!audit.some((row) => row.requestId === saturationId));
    const [{ userId: authority }] = await database.select().from(initialAdministrator);
    assert.equal(authority, adminId);
    const persistedSessions = await database
      .select({ digest: sessions.sessionTokenHash })
      .from(sessions);
    for (const proof of [
      admin,
      adminSecond,
      member,
      otherClient,
      newMember,
      unaffectedMember,
      finalAdmin,
    ]) {
      assert(persistedSessions.some((row) => row.digest === tokenDigest(proof.token)));
      assert(!JSON.stringify(audit).includes(proof.token));
    }
    for (const secret of [activation, initial, activated, changed, recovered])
      assert(!JSON.stringify(audit).includes(secret));
  } finally {
    await new Promise((resolve, reject) =>
      server.close((error) => (error ? reject(error) : resolve())),
    );
  }
}
