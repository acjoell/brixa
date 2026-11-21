import { Buffer } from "node:buffer";
import assert from "node:assert/strict";
import { createHash, randomBytes, randomUUID } from "node:crypto";
import { Algorithm, hash, Version } from "@node-rs/argon2";
import { eq } from "drizzle-orm";
import type { ActivationDatabase } from "../src/db/activation-write.js";
import type { db } from "../src/db/client.js";
import { auditLogSystem, sessions, users } from "../src/db/schema.js";
import { createAccountActivationService } from "../src/auth/activate-account.js";
import { getArgon2Limiter } from "../src/auth/argon2-limiter.js";
import { bootstrapInitialAdministrator } from "../src/auth/bootstrap.js";
import { createLoginService } from "../src/auth/login.js";
import { createManagedActivationService } from "../src/auth/managed-activation.js";
import { hashPassword, needsPasswordRehash } from "../src/auth/password-crypto.js";
import { createSessionService } from "../src/auth/sessions.js";

type Database = typeof db;
type LoginFactory = Awaited<ReturnType<typeof createLoginService>>;

export async function checkLogin(
  owner: Database,
  runtime: Database,
  activation: ActivationDatabase,
  other: ActivationDatabase,
  pauseRead: (database: ActivationDatabase, pause: () => Promise<void>) => ActivationDatabase,
  failAudit: (enabled: boolean) => Promise<unknown>,
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
  const login = await createLoginService(activation);
  const loginOther = await createLoginService(other);
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
    const gated = await createLoginService(
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
    await createLoginService(pauseRead(activation, barrier)),
    await createLoginService(pauseRead(other, barrier)),
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
