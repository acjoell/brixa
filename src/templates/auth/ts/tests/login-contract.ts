import { Buffer } from "node:buffer";
import assert from "node:assert/strict";
import { createHash, randomBytes, randomUUID } from "node:crypto";
import { Algorithm, hash, Version } from "@node-rs/argon2";
import { eq } from "drizzle-orm";
import type { ActivationDatabase } from "../src/db/activation-write.js";
import type { db } from "../src/db/client.js";
import {
  auditLogSystem,
  loginIdentifierReservations as reservations,
  sessions,
  users,
} from "../src/db/schema.js";
import { createAccountActivationService } from "../src/auth/activate-account.js";
import { getArgon2Limiter } from "../src/auth/argon2-limiter.js";
import { bootstrapInitialAdministrator } from "../src/auth/bootstrap.js";
import { createLoginService, LoginRateLimitedError } from "../src/auth/login.js";
import { createLoginAbuseService } from "../src/auth/login-abuse.js";
import { createManagedActivationService } from "../src/auth/managed-activation.js";
import { hashPassword, needsPasswordRehash } from "../src/auth/password-crypto.js";
import { createSessionService } from "../src/auth/sessions.js";

type Database = typeof db;
const testKey = randomBytes(32).toString("hex");
export const testLoginEnv = { LOGIN_ABUSE_HMAC_KEY: testKey };

export async function testLogin(database: ActivationDatabase, clock = Date.now) {
  const login = await createLoginService(
    database,
    { ...testLoginEnv, LOGIN_IDENTIFIER_FAILURE_LIMIT: "20" },
    clock,
  );
  return (email: unknown, password: unknown, requestId: string) =>
    login(email, password, requestId, "192.0.2." + ((nextIp++ % 254) + 1));
}
let nextIp = 0;

type LoginFactory = Awaited<ReturnType<typeof testLogin>>;

export async function checkLogin(
  owner: Database,
  runtime: Database,
  activation: ActivationDatabase,
  other: ActivationDatabase,
  pauseRead: (database: ActivationDatabase, pause: () => Promise<void>) => ActivationDatabase,
  failAudit: (
    enabled: boolean,
    event?: "login_succeeded" | "brute_force_detected",
  ) => Promise<unknown>,
) {
  const password = "test-only login password";
  const adminEmail = "bootstrap@example.test";
  const managedEmail = "managed@example.test";
  const { userId: admin } = await bootstrapInitialAdministrator(owner, {
    email: adminEmail,
    password,
  });
  const registration = await createManagedActivationService(activation).registerAccount(
    { userId: admin, requestId: "register" },
    managedEmail,
  );
  assert(registration.created);
  assert.equal(
    await createAccountActivationService(activation)(registration.token, password, "activate"),
    true,
  );
  const login = await testLogin(activation);
  const loginOther = await testLogin(other);
  const audit = (requestId: string) =>
    owner.select().from(auditLogSystem).where(eq(auditLogSystem.requestId, requestId));
  const sessionsFor = (userId: string) =>
    runtime.select().from(sessions).where(eq(sessions.userId, userId));
  const account = async () => (await runtime.select().from(users).where(eq(users.id, admin)))[0];
  const token = await login(" BOOTSTRAP@EXAMPLE.TEST ", password, "bootstrap-login");
  assert(token);
  assert.equal(await createSessionService(runtime).validateSession(token), admin);
  assert.equal(
    (await sessionsFor(admin))[0].sessionTokenHash,
    createHash("sha256").update(Buffer.from(token, "hex")).digest("hex"),
  );
  assert.equal((await audit("bootstrap-login"))[0].event, "login_succeeded");
  assert(await login(managedEmail, password, "managed-login"));

  const now = new Date();
  await owner.insert(users).values({
    id: randomUUID(),
    canonicalIdentifier: "pending@example.test",
    status: "pending_activation",
    createdAt: now,
    updatedAt: now,
  });
  const original = (await account()).passwordHash;
  assert(original);
  const setCredential = (passwordHash: string) =>
    owner.update(users).set({ passwordHash }).where(eq(users.id, admin));
  const setStatus = (status: "active" | "disabled") =>
    owner.update(users).set({ status }).where(eq(users.id, admin));
  for (const [id, email, secret] of [
    ["wrong", adminEmail, "incorrect"],
    ["missing", "missing@example.test", password],
    ["pending", "pending@example.test", password],
  ]) {
    assert.equal(await login(email, secret, id), null);
    assert.deepEqual(
      (await audit(id)).map(({ event, actorId }) => [event, actorId]),
      [["login_failed", null]],
    );
  }
  await setStatus("disabled");
  assert.equal(await login(adminEmail, password, "disabled"), null);
  await setStatus("active");
  await setCredential("corrupt PHC fixture");
  assert.equal(await login(adminEmail, password, "corrupt"), null);
  assert.equal((await audit("corrupt"))[0].event, "login_failed");

  // Si la ruta de cuenta inexistente omite Argon2, devolvería null pese a la saturación.
  const gate = Promise.withResolvers<void>();
  const limiter = getArgon2Limiter();
  const jobs = Array.from({ length: 10 }, () => limiter(() => gate.promise));
  try {
    await assert.rejects(login("missing@example.test", password, "saturated"), {
      code: "ARGON2_SATURATED",
    });
    assert.deepEqual(await audit("saturated"), []);
    assert.deepEqual(await owner.select().from(reservations), []);
  } finally {
    gate.resolve();
    await Promise.allSettled(jobs);
  }

  const legacy = await hash(password, {
    algorithm: Algorithm.Argon2id,
    version: Version.V0x13,
    memoryCost: 19456,
    timeCost: 3,
    parallelism: 1,
    outputLen: 32,
    salt: randomBytes(16),
  });
  await setCredential(legacy);
  assert.equal(await login(adminEmail, "incorrect", "wrong-legacy"), null);
  assert.equal((await account()).passwordHash, legacy);
  const before = (await sessionsFor(admin)).length;
  await failAudit(true);
  try {
    await assert.rejects(login(adminEmail, password, "rollback"), (error: unknown) => {
      assert(error instanceof Error);
      assert.equal(error.message, "LOGIN_FAILED");
      assert.equal(error.cause, undefined);
      return true;
    });
  } finally {
    await failAudit(false);
  }
  assert.equal((await account()).passwordHash, legacy);
  assert.equal((await sessionsFor(admin)).length, before);
  assert.deepEqual(await audit("rollback"), []);

  // Las conexiones independientes cambian la fila tras la lectura de la prueba de credencial.
  async function afterLookup(change: () => Promise<unknown>, requestId: string) {
    const gated = await testLogin(
      pauseRead(activation, async () => {
        await change();
      }),
    );
    assert.equal(await gated(adminEmail, password, requestId), null);
    assert.equal((await audit(requestId))[0].event, "login_failed");
    assert.equal((await sessionsFor(admin)).length, before);
  }
  await afterLookup(() => setStatus("disabled"), "racing-disable");
  assert.equal((await account()).status, "disabled");
  await setStatus("active");
  const replacement = await hashPassword("replacement test password");
  await afterLookup(() => setCredential(replacement), "racing-replace");
  assert.equal((await account()).passwordHash, replacement);
  await setCredential(original);

  async function concurrent(a: LoginFactory, b: LoginFactory, label: string) {
    return Promise.all([
      a(adminEmail, password, label + "-1"),
      b(adminEmail, password, label + "-2"),
    ]);
  }
  assert((await concurrent(login, loginOther, "concurrent")).every(Boolean));
  await setCredential(legacy);
  const ready = Promise.withResolvers<void>();
  let reads = 0;
  const barrier = async () => {
    if (++reads === 2) ready.resolve();
    await ready.promise;
  };
  const results = await concurrent(
    await testLogin(pauseRead(activation, barrier)),
    await testLogin(pauseRead(other, barrier)),
    "rehash",
  );
  assert.equal(results.filter(Boolean).length, 1);
  assert.equal(needsPasswordRehash((await account()).passwordHash, true), false);
  assert.equal((await sessionsFor(admin)).length, before + 3);
  assert.deepEqual(
    (await Promise.all([audit("rehash-1"), audit("rehash-2")]))
      .flat()
      .map(({ event }) => event)
      .sort(),
    ["login_failed", "login_succeeded"],
  );
  const protectedLogin = await createLoginService(activation, testLoginEnv);
  const remoteLogin = await createLoginService(other, testLoginEnv);
  const abuse = createLoginAbuseService(activation, testLoginEnv);
  const remoteAbuse = createLoginAbuseService(other, testLoginEnv);

  // Hold the fifth attempt after DB admission but before Argon2id, without a write lock.
  const absent = "target@example.test";
  const checkedIp = "198.51.100.1";
  for (let i = 1; i <= 4; i++)
    assert.equal(await protectedLogin(absent, password, "quota-" + i, checkedIp), null);
  await failAudit(true, "brute_force_detected");
  try {
    await assert.rejects(protectedLogin(absent, password, "failed-threshold", checkedIp), {
      code: "LOGIN_FAILED",
    });
    assert.equal((await remoteAbuse.identifierStatus(absent)).blocked, false);
    assert.deepEqual(await audit("failed-threshold"), []);
    assert.deepEqual(await owner.select().from(reservations), []);
  } finally {
    await failAudit(false, "brute_force_detected");
  }

  async function pausedLogin(
    email: string,
    requestId: string,
    intervene: () => Promise<void>,
    rejectCode?: string,
  ) {
    const entered = Promise.withResolvers<void>();
    const resume = Promise.withResolvers<void>();
    const gated = await createLoginService(
      pauseRead(activation, async () => {
        entered.resolve();
        await resume.promise;
      }),
      testLoginEnv,
    );
    const attempt = gated(email, password, requestId, checkedIp);
    const outcome = rejectCode ? assert.rejects(attempt, { code: rejectCode }) : attempt;
    try {
      await Promise.race([
        entered.promise,
        outcome.then(() => {
          throw new Error("Login terminó antes de la barrera.");
        }),
      ]);
      await intervene();
    } finally {
      resume.resolve();
      await outcome;
    }
    return outcome;
  }

  const limited = (max: number) => (error: unknown) =>
    error instanceof LoginRateLimitedError &&
    Number.isInteger(error.retryAfterSeconds) &&
    error.retryAfterSeconds >= 1 &&
    error.retryAfterSeconds <= max;
  assert.equal(new LoginRateLimitedError(1001).retryAfterSeconds, 2);
  const fifth = await pausedLogin(absent, "quota-5", async () => {
    assert.equal((await remoteAbuse.identifierStatus(absent)).blocked, false);
    await assert.rejects(
      remoteLogin(absent, password, "pending-limit", "198.51.100.2"),
      limited(60),
    );
    assert.deepEqual(await audit("pending-limit"), []);
  });
  assert.equal(fifth, null);
  await assert.rejects(remoteLogin(absent, password, "quota-6", "198.51.100.3"), limited(900));
  assert.deepEqual(await audit("quota-6"), []);
  assert.deepEqual((await audit("quota-5")).map(({ event }) => event).sort(), [
    "brute_force_detected",
    "login_failed",
  ]);
  assert.equal(
    (
      await owner
        .select()
        .from(auditLogSystem)
        .where(eq(auditLogSystem.event, "brute_force_detected"))
    ).length,
    1,
  );

  // A successful login still consumes the tenth IP request, across both connections.
  const limitedIp = "198.51.100.4";
  for (let i = 1; i <= 9; i++) assert.equal((await abuse.consumeIp(limitedIp)).accepted, true);
  const priorSession = await remoteLogin(managedEmail, password, "ip-10", limitedIp);
  assert(priorSession);
  await assert.rejects(protectedLogin(managedEmail, password, "ip-11", limitedIp), limited(900));
  assert.deepEqual(await audit("ip-11"), []);

  const sessionService = createSessionService(runtime);
  const nextSession = await pausedLogin(managedEmail, "logout-race-login", async () => {
    assert.equal(await sessionService.logout(priorSession, "logout-race"), true);
  });
  assert(nextSession);
  assert.equal(await sessionService.validateSession(priorSession), null);
  assert(await sessionService.validateSession(nextSession));

  const singleSlot = { ...testLoginEnv, LOGIN_IDENTIFIER_FAILURE_LIMIT: "1" };
  const one = createLoginAbuseService(activation, singleSlot);
  const another = createLoginAbuseService(other, singleSlot);
  const crashed = await one.reserveIdentifier(managedEmail);
  assert(crashed.accepted);
  assert.equal((await another.reserveIdentifier(managedEmail)).accepted, false);
  await owner
    .update(reservations)
    .set({ expiresAtMs: 1 })
    .where(eq(reservations.id, crashed.reservation.id));
  const recovered = await another.reserveIdentifier(managedEmail);
  assert(recovered.accepted);
  assert.equal(
    await abuse.finishIdentifier(crashed.reservation, { requestId: "expired-lease" }),
    false,
  );
  const duplicates = await Promise.all([
    abuse.finishIdentifier(recovered.reservation, null),
    remoteAbuse.finishIdentifier(recovered.reservation, null),
  ]);
  assert.equal(duplicates.filter(Boolean).length, 1);
  await abuse.cleanupExpired();
  assert.deepEqual(await owner.select().from(reservations), []);
  assert.deepEqual(await audit("expired-lease"), []);

  const sessionCount = (await runtime.select().from(sessions)).length;
  await pausedLogin(
    managedEmail,
    "expired-valid-proof",
    async () => {
      await owner.update(reservations).set({ expiresAtMs: 1 });
    },
    "LOGIN_FAILED",
  );
  assert.equal((await runtime.select().from(sessions)).length, sessionCount);
  assert.deepEqual(await audit("expired-valid-proof"), []);
  assert.equal((await abuse.identifierStatus(managedEmail)).blocked, false);
  const records = JSON.stringify(await owner.select().from(auditLogSystem));
  for (const secret of [token, password, original, legacy, "corrupt PHC fixture"])
    assert(!records.includes(secret));
}

// Captura el resultado real antes de entregar la fila al servicio.
export function pauseLoginLookup(database: Database, pause: () => Promise<void>): Database {
  return new Proxy(database, {
    get(target, key, receiver) {
      if (key !== "select") return Reflect.get(target, key, receiver);
      return () => ({
        from: () => ({
          where: async (condition: ReturnType<typeof eq>) => {
            const rows = await target.select().from(users).where(condition);
            await pause();
            return rows;
          },
        }),
      });
    },
  });
}
