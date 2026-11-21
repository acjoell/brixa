import assert from "node:assert/strict";
import { Buffer } from "node:buffer";
import { createHash } from "node:crypto";
import { eq } from "drizzle-orm";
import { bootstrapInitialAdministrator } from "../src/auth/bootstrap.js";
import { createLoginService } from "../src/auth/login.js";
import { createSessionService } from "../src/auth/sessions.js";

import { auditLogSystem, sessions, users } from "../src/db/schema.js";

export async function checkLogout(owner, runtime, other, activation, failAudit) {
  const password = "logout test passphrase";
  const email = "logout@example.test";
  const { userId } = await bootstrapInitialAdministrator(owner, { email, password });
  const initial = Date.now();
  let now = initial;
  const clock = () => now;
  const service = createSessionService(runtime, {}, clock);
  const remote = createSessionService(other, {}, clock);
  const login = await createLoginService(activation, {}, clock);
  const first = await login(email, password, "login-first");
  const second = await login(email, password, "login-second");
  assert(first && second);
  const digest = (token) => createHash("sha256").update(Buffer.from(token, "hex")).digest("hex");
  const state = async (token) =>
    (
      await runtime
        .select()
        .from(sessions)
        .where(eq(sessions.sessionTokenHash, digest(token)))
    )[0];
  const events = () =>
    owner.select().from(auditLogSystem).where(eq(auditLogSystem.event, "logout"));
  const sanitized = (error) => {
    assert(error instanceof Error);
    assert.equal(error.message, "SESSION_OPERATION_FAILED");
    assert.equal(error.cause, undefined);
    return true;
  };

  assert.equal(await service.validateSession(first), userId);
  for (const invalid of ["bad", "f".repeat(64), first.toUpperCase(), first + "\n"]) {
    assert.equal(await remote.validateSession(invalid, true), null);
    assert.equal(await remote.logout(invalid, "invalid"), false);
  }
  await owner.update(users).set({ status: "disabled" }).where(eq(users.id, userId));
  assert.equal(await service.validateSession(first, true), null);
  assert.equal(await service.logout(first, "disabled"), false);
  await owner.update(users).set({ status: "active" }).where(eq(users.id, userId));
  now = initial + 59_999;
  assert.equal(await service.validateSession(first, true), userId);
  now++;
  assert.equal(await service.validateSession(first), userId);
  assert.equal((await state(first)).lastActivityAt.getTime(), initial);
  assert.equal(await service.validateSession(first, true), userId);
  assert.equal((await state(first)).lastActivityAt.getTime(), now);

  await failAudit(true);
  try {
    await assert.rejects(remote.logout(first, "rollback"), sanitized);
  } finally {
    await failAudit(false);
  }
  assert.equal((await state(first)).revokedAt, null);
  assert.deepEqual(await events(), []);

  // La renovación ya leyó una sesión válida, pero aún no tiene sus bloqueos.
  // Otra conexión confirma logout antes de que la renovación la vuelva a leer.
  now += 60_000;
  const ready = Promise.withResolvers();
  const resume = Promise.withResolvers();
  const gated = new Proxy(runtime, {
    get(target, key, receiver) {
      if (key !== "transaction") return Reflect.get(target, key, receiver);
      return async (operation) => {
        ready.resolve();
        await resume.promise;
        return target.transaction(operation);
      };
    },
  });
  const renew = createSessionService(gated, {}, clock).validateSession(first, true);
  try {
    await Promise.race([
      ready.promise,
      renew.then(() => {
        throw new Error("La renovación terminó antes de adquirir sus bloqueos.");
      }),
    ]);
    assert.equal(await remote.logout(first, "logout"), true);
  } finally {
    resume.resolve();
    await renew;
  }
  assert.equal(await renew, null);
  assert.equal((await state(first)).lastActivityAt.getTime(), initial + 60_000);
  assert.equal((await state(first)).revokedAt?.getTime(), now);
  assert.equal(await service.validateSession(first), null);
  assert.equal(await service.logout(first, "retry"), false);
  assert.equal(await service.validateSession(second), userId);
  const logs = await events();
  assert.deepEqual(
    logs.map(({ actorId, requestId }) => [actorId, requestId]),
    [[userId, "logout"]],
  );
  for (const secret of [password, first, second, digest(first), digest(second)])
    assert(!JSON.stringify(logs).includes(secret));

  now = initial + 30 * 60_000;
  assert.equal(await service.validateSession(second, true), null);
  assert.equal(await service.logout(second, "expired"), false);

  // Una sesión activa nunca supera el límite absoluto aunque esté renovándose.
  now = initial;
  const active = await login(email, password, "absolute");
  assert(active);
  for (let minute = 29; minute < 12 * 60; minute += 29) {
    now = initial + minute * 60_000;
    assert.equal(await service.validateSession(active, true), userId);
  }
  now = initial + 12 * 60 * 60_000 - 1;
  assert.equal(await service.validateSession(active, true), userId);
  assert.equal((await state(active)).idleExpiresAt.getTime(), now + 1);
  now++;
  assert.equal(await service.validateSession(active, true), null);

  const broken = new Proxy(runtime, {
    get(target, key, receiver) {
      if (key === "select")
        return () => {
          throw new Error(first);
        };
      return Reflect.get(target, key, receiver);
    },
  });
  await assert.rejects(createSessionService(broken).validateSession(first), sanitized);
}
