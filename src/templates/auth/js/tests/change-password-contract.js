import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { setImmediate } from "node:timers/promises";
import { and, eq, isNull } from "drizzle-orm";
import { Argon2SaturatedError, getArgon2Limiter } from "../src/auth/argon2-limiter.js";
import { bootstrapInitialAdministrator } from "../src/auth/bootstrap.js";
import { createPasswordChangeService } from "../src/auth/change-password.js";
import { createLoginService } from "../src/auth/login.js";
import { hashPassword } from "../src/auth/password-crypto.js";
import { createSessionService, tokenDigest } from "../src/auth/sessions.js";

import { auditLogSystem, sessions, users } from "../src/db/schema.js";

export function holdWrite() {
  const entered = Promise.withResolvers();
  const resume = Promise.withResolvers();
  const gate = (database) =>
    new Proxy(database, {
      get(target, key, receiver) {
        if (key !== "transaction") return Reflect.get(target, key, receiver);
        return async (operation) => {
          entered.resolve();
          await resume.promise;
          return target.transaction(operation);
        };
      },
    });
  return { gate, entered: entered.promise, release: () => resume.resolve() };
}

export async function interleave(barrier, pending, intervene) {
  try {
    await Promise.race([
      barrier.entered,
      pending.then(() => {
        throw new Error("La operación terminó antes de la barrera.");
      }),
    ]);
    await intervene();
  } finally {
    barrier.release();
    await pending;
  }
  return pending;
}

export async function checkPasswordChange(
  owner,
  runtime,
  other,
  writer,
  remoteWriter,
  pauseWrite,

  failAudit,
) {
  const email = "change@example.test";
  const old = "initial test credential";
  const next = "replacement test credential";
  const third = "concurrent test credential";
  const { userId } = await bootstrapInitialAdministrator(owner, { email, password: old });
  const outsider = randomUUID();
  let now = Date.now();
  const clock = () => now;
  await owner.insert(users).values({
    id: outsider,
    canonicalIdentifier: "other@example.test",
    passwordHash: await hashPassword(old),
    status: "active",
    createdAt: new Date(now),
    updatedAt: new Date(now),
  });
  const validate = createSessionService(runtime, {}, clock);
  const remoteSessions = createSessionService(other, {}, clock);
  const login = await createLoginService(writer, {}, clock);
  const change = createPasswordChangeService(writer, {}, clock);
  const remoteChange = createPasswordChangeService(remoteWriter, {}, clock);
  const getCredential = async () =>
    (await runtime.select({ phc: users.passwordHash }).from(users).where(eq(users.id, userId)))[0]
      .phc;
  const activeSessions = () =>
    runtime
      .select({ id: sessions.sessionTokenHash })
      .from(sessions)
      .where(and(eq(sessions.userId, userId), isNull(sessions.revokedAt)));
  const events = () =>
    owner.select().from(auditLogSystem).where(eq(auditLogSystem.event, "password_changed"));
  const setStatus = (status) => owner.update(users).set({ status }).where(eq(users.id, userId));
  async function session(password, request, account = email) {
    const token = await login(account, password, request);
    assert(token);
    return token;
  }

  const first = await session(old, "first");
  const second = await session(old, "second");
  const unrelated = await session(old, "unrelated", "other@example.test");
  const original = await getCredential();
  assert(original);
  for (const [token, current, replacement] of [
    [userId, old, next],
    ["f".repeat(64), old, next],
    [first, "invalid current", next],
    [first, old, ""],
    [first, old, "😀".repeat(129)],
    [first, old, "\ud800"],
  ])
    assert.equal(await change(token, current, replacement, "rejected"), false);
  await setStatus("disabled");
  assert.equal(await change(first, old, next, "disabled"), false);
  await setStatus("active");
  now += 30 * 60_000;
  assert.equal(await change(first, old, next, "expired"), false);
  now -= 30 * 60_000;
  assert.equal(await getCredential(), original);
  assert.deepEqual(await events(), []);

  const releaseArgon2 = Promise.withResolvers();
  const limit = getArgon2Limiter();
  const occupied = Array.from({ length: 10 }, () => limit(() => releaseArgon2.promise));
  try {
    await assert.rejects(change(first, old, next, "saturated"), { code: "ARGON2_SATURATED" });
  } finally {
    releaseArgon2.resolve();
    await Promise.allSettled(occupied);
  }

  await failAudit(true);
  try {
    await assert.rejects(change(first, old, next, "rollback"), (error) => {
      assert(error instanceof Error);
      assert.equal(error.message, "PASSWORD_CHANGE_FAILED");
      assert.equal(error.cause, undefined);
      return true;
    });
  } finally {
    await failAudit(false);
  }
  assert.equal(await getCredential(), original);
  assert.equal((await activeSessions()).length, 2);
  assert.equal(await validate.validateSession(first), userId);
  assert.deepEqual(await events(), []);

  assert.equal(await change(first, old, next, "success"), true);
  assert.equal(await validate.validateSession(first), null);
  assert.equal(await remoteSessions.validateSession(second), null);
  assert.equal(await remoteSessions.validateSession(unrelated), outsider);
  assert.equal((await activeSessions()).length, 0);
  assert.equal(await change(first, next, third, "revoked"), false);
  assert.equal(await login(email, old, "old-password"), null);
  let token = await session(next, "new-password");

  // Pausar transacciones después de Argon2id sin simular escrituras de BD.
  function gateWriter() {
    const barrier = holdWrite();
    return { barrier, database: pauseWrite(writer, barrier.gate) };
  }
  let paused = gateWriter();
  const staleChange = createPasswordChangeService(paused.database, {}, clock)(
    token,
    next,
    old,
    "stale-change",
  );
  assert.equal(
    await interleave(paused.barrier, staleChange, async () => {
      assert.equal(await remoteChange(token, next, third, "winning-change"), true);
    }),
    false,
  );
  assert.equal((await activeSessions()).length, 0);
  token = await session(third, "winner-password");

  paused = gateWriter();
  const delayedLogin = await createLoginService(paused.database, {}, clock);
  assert.equal(
    await interleave(paused.barrier, delayedLogin(email, third, "stale-login"), async () => {
      assert.equal(await remoteChange(token, third, next, "change-beats-login"), true);
    }),
    null,
  );
  assert.equal((await activeSessions()).length, 0);

  async function duringVerification(requestId, intervene) {
    const credentialRead = Promise.withResolvers();
    const release = Promise.withResolvers();
    const held = [limit(() => release.promise), limit(() => release.promise)];
    const parked = pauseWrite(
      writer,
      (connection) =>
        new Proxy(connection, {
          get(target, key, receiver) {
            if (key !== "select") return Reflect.get(target, key, receiver);
            return (fields) => {
              if (!fields.passwordHash) return target.select(fields);
              return {
                from: () => ({
                  where: async (condition) => {
                    const row = await target
                      .select({ passwordHash: users.passwordHash })
                      .from(users)
                      .where(condition);
                    // El servicio recibe la fila y encola Argon2id antes del siguiente turno.
                    void setImmediate().then(() => credentialRead.resolve());
                    return row;
                  },
                }),
              };
            };
          },
        }),
    );
    const pending = createPasswordChangeService(parked, {}, clock)(token, next, third, requestId);
    try {
      await Promise.race([
        credentialRead.promise,
        pending.then(() => {
          throw new Error("El cambio terminó antes de encolar la verificación.");
        }),
      ]);
      for (let i = 0; i < 7; i++) held.push(limit(() => release.promise));
      let saturation;
      held.push(
        limit(async () => {}).catch((error) => {
          saturation = error;
        }),
      );
      await setImmediate();
      assert(saturation instanceof Argon2SaturatedError);
      await intervene();
    } finally {
      release.resolve();
      await Promise.allSettled(held);
      await pending;
    }
    assert.equal(await pending, false);
  }

  token = await session(next, "revocation-race");
  await duringVerification("revoked-during-change", async () => {
    assert.equal(await remoteSessions.logout(token, "concurrent-logout"), true);
  });
  token = await session(next, "disable-race");
  await duringVerification("disabled-during-change", async () => {
    await setStatus("disabled");
  });
  await setStatus("active");

  now += 60_000;
  const renew = holdWrite();
  const renewal = createSessionService(renew.gate(runtime), {}, clock).validateSession(token, true);
  assert.equal(
    await interleave(renew, renewal, async () => {
      assert.equal(await remoteChange(token, next, third, "change-beats-renewal"), true);
    }),
    null,
  );
  assert.equal(await remoteSessions.validateSession(token, true), null);
  assert.equal((await activeSessions()).length, 0);
  assert.equal(await remoteSessions.validateSession(unrelated), outsider);
  const logs = await events();
  assert.deepEqual(logs.map(({ requestId }) => requestId).sort(), [
    "change-beats-login",
    "change-beats-renewal",
    "success",
    "winning-change",
  ]);
  assert(logs.every(({ actorId }) => actorId === userId));
  const log = JSON.stringify(logs);
  for (const secret of [first, second, token, tokenDigest(token), original, old, next, third])
    assert(secret && !log.includes(secret));
}
