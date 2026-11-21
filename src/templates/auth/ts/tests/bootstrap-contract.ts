import assert from "node:assert/strict";
import { clearTimeout, setTimeout } from "node:timers";
import type { db } from "../src/db/client.js";
import { auditLogSystem, initialAdministrator, sessions, users } from "../src/db/schema.js";
import { bootstrapInitialAdministrator } from "../src/auth/bootstrap.js";
import { isInitialAdministrator } from "../src/auth/initial-administrator.js";
import { verifyPassword } from "../src/auth/password-crypto.js";

const credentials = { email: " initial@EXAMPLE.test ", password: "initial test passphrase" };
const other = { email: "other@example.test", password: "different test passphrase" };

function snapshot(database: typeof db) {
  return Promise.all([
    database.select().from(users).orderBy(users.id),
    database.select().from(initialAdministrator),
    database.select().from(auditLogSystem).orderBy(auditLogSystem.id),
    database.select().from(sessions),
  ]);
}

function rejectsWith(operation: Promise<unknown>, code: string) {
  return assert.rejects(operation, (error: unknown) => {
    assert(error instanceof Error);
    assert.equal(error.message, code);
    assert.equal(error.cause, undefined);
    return true;
  });
}

export async function checkBootstrap(
  database: typeof db,
  setAuditFailure: (enabled: boolean) => Promise<unknown>,
  bootstrap = (input: typeof credentials) => bootstrapInitialAdministrator(database, input),
) {
  for (const input of [
    { ...credentials, email: "invalid" },
    { ...credentials, password: "" },
    { ...credentials, password: "x".repeat(129) },
  ]) {
    await rejectsWith(bootstrap(input), "INVALID_CREDENTIALS");
  }
  assert.deepEqual(await snapshot(database), [[], [], [], []]);

  const now = new Date();
  await database.insert(users).values({
    id: "00000000-0000-4000-8000-000000000001",
    canonicalIdentifier: other.email,
    createdAt: now,
    updatedAt: now,
  });
  const before = await snapshot(database);
  await rejectsWith(bootstrap({ ...other, email: " OTHER@example.test " }), "EMAIL_IN_USE");
  assert.deepEqual(await snapshot(database), before);

  await setAuditFailure(true);
  await rejectsWith(bootstrap(credentials), "BOOTSTRAP_FAILED");
  assert.deepEqual(await snapshot(database), before);
  await setAuditFailure(false);

  const result = await bootstrap(credentials);
  const committed = await snapshot(database);
  const [accounts, assignments, events, activeSessions] = committed;
  assert.equal(accounts.length, 2);
  const account = accounts.find(({ id }) => id === result.userId);
  assert.equal(account?.canonicalIdentifier, "initial@example.test");
  assert.equal(account.status, "active");
  assert(await verifyPassword(credentials.password, account.passwordHash));
  assert.deepEqual(result, { userId: account.id });
  assert.deepEqual(assignments, [{ singleton: "initial", userId: account.id }]);
  assert(await isInitialAdministrator(database, account.id));
  assert.deepEqual(activeSessions, []);
  assert.equal(events.length, 1);
  assert.equal(events[0].event, "bootstrap");
  assert.equal(events[0].actorId, null);
  assert.match(events[0].requestId, /^[0-9a-f-]{36}$/);

  await rejectsWith(bootstrap(credentials), "ALREADY_INITIALIZED");
  await rejectsWith(bootstrap({ ...other, email: "new@example.test" }), "ALREADY_INITIALIZED");
  assert.deepEqual(await snapshot(database), committed);
}

export async function checkBootstrapRace(
  first: typeof db,
  second: typeof db,
  { serializeWrites = false } = {},
) {
  const release = Promise.withResolvers<void>();
  const firstWrite = Promise.withResolvers<void>();
  let arrivals = 0;
  const timeout = setTimeout(
    () => release.reject(new Error("Barrera de bootstrap incompleta")),
    5000,
  );
  // Ambas llamadas ya leyeron la asignación y calcularon Argon2id al llegar aquí.
  // Las escrituras y la resolución del conflicto usan las dos conexiones reales.
  const gated = (database: typeof db, first: boolean) =>
    new Proxy(database, {
      get(target, property, receiver) {
        if (property !== "transaction") return Reflect.get(target, property, receiver);
        return async (...args: Parameters<typeof database.transaction>) => {
          if (++arrivals === 2) release.resolve();
          await release.promise;
          // SQLite admite un solo escritor y puede devolver SQLITE_BUSY al abrir
          // la transacción. Dejar pasar el segundo después del commit prueba la
          // restricción con ambas lecturas previas realizadas sobre el estado vacío.
          if (serializeWrites && !first) await firstWrite.promise;
          try {
            return await target.transaction(...args);
          } finally {
            if (first) firstWrite.resolve();
          }
        };
      },
    });
  try {
    const outcomes = await Promise.allSettled([
      bootstrapInitialAdministrator(gated(first, true), credentials),
      bootstrapInitialAdministrator(gated(second, false), other),
    ]);
    assert.equal(arrivals, 2);
    const successes = outcomes.filter((outcome) => outcome.status === "fulfilled");
    const failures = outcomes.filter((outcome) => outcome.status === "rejected");
    assert.equal(successes.length, 1);
    assert.equal(failures.length, 1);
    assert.equal(failures[0].reason.message, "ALREADY_INITIALIZED");
    const [accounts, assignments, events, activeSessions] = await snapshot(second);
    assert.equal(accounts.length, 1);
    assert.equal(accounts[0].id, successes[0].value.userId);
    assert.deepEqual(assignments, [{ singleton: "initial", userId: accounts[0].id }]);
    assert.deepEqual(
      events.map(({ event }) => event),
      ["bootstrap"],
    );
    assert.deepEqual(activeSessions, []);
  } finally {
    clearTimeout(timeout);
  }
}
