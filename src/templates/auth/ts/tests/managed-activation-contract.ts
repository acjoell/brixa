import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import type { db } from "../src/db/client.js";
import type { ActivationDatabase } from "../src/db/activation-write.js";
import { activationTokens, auditLogSystem, initialAdministrator, users } from "../src/db/schema.js";
import { activationTokenDigest } from "../src/auth/activation-token.js";
import { createManagedActivationService } from "../src/auth/managed-activation.js";

type Database = typeof db;
type Operation<T> = (activation: ActivationDatabase, database: Database) => Promise<T>;
export type ActivationRace = <A, B>(
  first: Operation<A>,
  second: Operation<B>,
  onBlocked?: () => void,
) => Promise<[A, PromiseSettledResult<B>]>;

type Fixture = Awaited<ReturnType<typeof managedActivationFixture>>;

function rejectsWith(operation: Promise<unknown>, code: string) {
  return assert.rejects(operation, (error: unknown) => {
    assert(error instanceof Error);
    assert.equal(error.message, code);
    assert.equal(error.cause, undefined);
    return true;
  });
}

export async function managedActivationFixture(owner: Database) {
  const admin = randomUUID();
  const outsider = randomUUID();
  const disabled = randomUUID();
  const initialTime = Date.parse("2026-11-21T12:00:00Z");
  const now = new Date(initialTime);
  await owner.insert(users).values([
    {
      id: admin,
      canonicalIdentifier: "admin@example.test",
      status: "active",
      createdAt: now,
      updatedAt: now,
    },
    {
      id: outsider,
      canonicalIdentifier: "active@example.test",
      status: "active",
      createdAt: now,
      updatedAt: now,
    },
    {
      id: disabled,
      canonicalIdentifier: "disabled@example.test",
      status: "disabled",
      createdAt: now,
      updatedAt: now,
    },
  ]);
  await owner.insert(initialAdministrator).values({ singleton: "initial", userId: admin });
  const tokenRows = (userId: string) =>
    owner.select().from(activationTokens).where(eq(activationTokens.userId, userId));
  const accounts = () => owner.select().from(users).orderBy(users.id);
  const allTokens = () =>
    owner.select().from(activationTokens).orderBy(activationTokens.tokenDigest);
  const actor = (requestId: string, userId = admin) => ({ userId, requestId });
  const audit = async (
    requestId: string,
    expected: string[],
    expectedActor: string | null = admin,
  ) => {
    const events = await owner
      .select()
      .from(auditLogSystem)
      .where(eq(auditLogSystem.requestId, requestId));
    assert.deepEqual(events.map(({ event }) => event).sort(), [...expected].sort());
    assert(events.every(({ actorId }) => actorId === expectedActor));
  };
  return {
    admin,
    outsider,
    disabled,
    initialTime,
    actor,
    tokenRows,
    accounts,
    allTokens,
    audit,
    owner,
  };
}

export async function checkManagedActivation(
  fixture: Fixture,
  runtime: ActivationDatabase,
  failAudit: (
    event: "activation_token_issued" | "platform_admin_access_denied",
    enabled: boolean,
  ) => Promise<unknown>,
) {
  const { actor, outsider, disabled, initialTime, tokenRows, accounts, allTokens, audit, owner } =
    fixture;
  let now = initialTime;
  const service = createManagedActivationService(runtime, {}, () => now);
  const custom = createManagedActivationService(
    runtime,
    { ACTIVATION_TOKEN_EXPIRY_HOURS: "1" },
    () => now,
  );
  const before = await accounts();
  await rejectsWith(service.registerAccount(actor("invalid"), "invalid"), "INVALID_INPUT");
  await rejectsWith(
    service.registerAccount(
      { ...actor("outsider", outsider), isAdmin: true } as ReturnType<typeof actor>,
      "new@example.test",
    ),
    "FORBIDDEN",
  );
  for (const [id, email] of [
    [outsider, "active@example.test"],
    [disabled, "disabled@example.test"],
  ] as const) {
    assert.deepEqual(await service.registerAccount(actor("existing"), email), {
      created: false,
      userId: id,
    });
    await rejectsWith(
      service.regenerateActivationToken(actor("nonpending"), id),
      "ACCOUNT_NOT_PENDING",
    );
    assert.deepEqual(await service.revokeActivationToken(actor("nonpending"), id), {
      closed: null,
    });
  }
  assert.deepEqual(await accounts(), before);
  assert.deepEqual(await allTokens(), []);
  await audit("existing", []);
  await audit("invalid", []);
  await audit("nonpending", []);
  await audit("outsider", ["platform_admin_access_denied"], outsider);
  await rejectsWith(
    service.registerAccount(actor("unknown", randomUUID()), "unknown@example.test"),
    "FORBIDDEN",
  );
  await audit("unknown", ["platform_admin_access_denied"], null);

  await failAudit("activation_token_issued", true);
  await rejectsWith(
    service.registerAccount(actor("failed-create"), "pending@example.test"),
    "MANAGED_ACTIVATION_FAILED",
  );
  assert.deepEqual(await accounts(), before);
  assert.deepEqual(await allTokens(), []);
  await audit("failed-create", []);
  await failAudit("activation_token_issued", false);

  const created = await service.registerAccount(actor("created"), " Pending@EXAMPLE.test ");
  assert(created.created);
  const user = (await accounts()).find(({ id }) => id === created.userId);
  assert.equal(user?.canonicalIdentifier, "pending@example.test");
  assert.equal(user.status, "pending_activation");
  assert.equal(user.passwordHash, null);
  assert.equal(created.expiresAt.getTime(), now + 24 * 3_600_000);
  const persisted = await tokenRows(created.userId);
  assert.deepEqual(persisted, [
    {
      tokenDigest: activationTokenDigest(created.token),
      userId: created.userId,
      status: "open",
      issuedAt: new Date(now),
      expiresAt: created.expiresAt,
      closedAt: null,
    },
  ]);
  await audit("created", ["user_created", "activation_token_issued"]);
  assert.deepEqual(await service.registerAccount(actor("repeat"), "pending@example.test"), {
    created: false,
    userId: created.userId,
  });
  assert.deepEqual(await tokenRows(created.userId), persisted);
  await audit("repeat", []);
  await rejectsWith(
    service.revokeActivationToken(actor("deny-revoke", outsider), created.userId),
    "FORBIDDEN",
  );
  await rejectsWith(
    service.regenerateActivationToken(actor("deny-regen", outsider), created.userId),
    "FORBIDDEN",
  );
  await audit("deny-revoke", ["platform_admin_access_denied"], outsider);
  await audit("deny-regen", ["platform_admin_access_denied"], outsider);
  const accountsBeforeDenial = await accounts();
  await failAudit("platform_admin_access_denied", true);
  await rejectsWith(
    service.regenerateActivationToken(actor("audit-denial-fails", outsider), created.userId),
    "MANAGED_ACTIVATION_FAILED",
  );
  await failAudit("platform_admin_access_denied", false);
  assert.deepEqual(await accounts(), accountsBeforeDenial);
  assert.deepEqual(await tokenRows(created.userId), persisted);
  await audit("audit-denial-fails", []);

  await failAudit("activation_token_issued", true);
  await rejectsWith(
    service.regenerateActivationToken(actor("failed-regen"), created.userId),
    "MANAGED_ACTIVATION_FAILED",
  );
  assert.deepEqual(await tokenRows(created.userId), persisted);
  await audit("failed-regen", []);
  await failAudit("activation_token_issued", false);

  const replacement = await custom.regenerateActivationToken(actor("renew"), created.userId);
  assert.equal(replacement.closed, "revoked");
  assert.notEqual(replacement.token, created.token);
  assert.equal(replacement.expiresAt.getTime(), now + 3_600_000);
  await audit("renew", ["activation_token_revoked", "activation_token_issued"]);
  now = replacement.expiresAt.getTime();
  assert.deepEqual(await service.revokeActivationToken(actor("expired"), created.userId), {
    closed: "expired",
  });
  assert.deepEqual(await service.revokeActivationToken(actor("expired-again"), created.userId), {
    closed: null,
  });
  await audit("expired", ["activation_token_expired"]);
  await audit("expired-again", []);
  const fresh = await service.regenerateActivationToken(actor("new-token"), created.userId);
  assert.equal(fresh.closed, null);
  now = fresh.expiresAt.getTime() - 1;
  await owner.update(users).set({ status: "disabled" }).where(eq(users.id, created.userId));
  const disabledAccounts = await accounts();
  assert.deepEqual(await service.revokeActivationToken(actor("revoked"), created.userId), {
    closed: "revoked",
  });
  await audit("revoked", ["activation_token_revoked"]);
  assert.deepEqual(await accounts(), disabledAccounts);

  const history = await tokenRows(created.userId);
  assert.deepEqual(history.map(({ status }) => status).sort(), ["expired", "revoked", "revoked"]);
  const serialized = JSON.stringify([history, await owner.select().from(auditLogSystem)]);
  for (const token of [created.token, replacement.token, fresh.token])
    assert(!serialized.includes(token));
}

export async function checkManagedActivationRace(fixture: Fixture, race: ActivationRace) {
  const { actor, tokenRows, accounts, audit, admin } = fixture;
  const service = (db: ActivationDatabase) =>
    createManagedActivationService(db, {}, () => fixture.initialTime);
  const [created, duplicate] = await race(
    (db) => service(db).registerAccount(actor("race-create"), "race@example.test"),
    (db) => service(db).registerAccount(actor("race-duplicate"), " RACE@example.test "),
  );
  assert(created.created);
  assert.deepEqual(duplicate, {
    status: "fulfilled",
    value: { created: false, userId: created.userId },
  });
  assert.equal((await tokenRows(created.userId)).length, 1);
  await audit("race-create", ["user_created", "activation_token_issued"]);
  await audit("race-duplicate", []);

  const [early, late] = await race(
    (db) => service(db).regenerateActivationToken(actor("race-first"), created.userId),
    (db) => service(db).regenerateActivationToken(actor("race-second"), created.userId),
  );
  assert.equal(early.closed, "revoked");
  assert(late.status === "fulfilled");
  assert.equal(late.value.closed, "revoked");
  const after = await tokenRows(created.userId);
  assert.equal(after.length, 3);
  assert.equal(
    after.find(({ status }) => status === "open")?.tokenDigest,
    activationTokenDigest(late.value.token),
  );
  await audit("race-first", ["activation_token_revoked", "activation_token_issued"]);
  await audit("race-second", ["activation_token_revoked", "activation_token_issued"]);

  const [revoked, regenerated] = await race(
    (db) => service(db).revokeActivationToken(actor("race-revoke"), created.userId),
    (db) => service(db).regenerateActivationToken(actor("race-after-revoke"), created.userId),
  );
  assert.deepEqual(revoked, { closed: "revoked" });
  assert(regenerated.status === "fulfilled");
  assert.equal(regenerated.value.closed, null);
  const current = (await tokenRows(created.userId)).filter(({ status }) => status === "open");
  assert.equal(current.length, 1);
  assert.equal(current[0]?.tokenDigest, activationTokenDigest(regenerated.value.token));
  await audit("race-revoke", ["activation_token_revoked"]);
  await audit("race-after-revoke", ["activation_token_issued"]);

  const before = await accounts();
  const [, denied] = await race(
    (_activation, db) =>
      db.transaction(async (tx) => {
        await tx.update(users).set({ status: "disabled" }).where(eq(users.id, admin));
      }),
    (db) => service(db).registerAccount(actor("race-disabled"), "must-not-exist@example.test"),
  );
  assert(denied.status === "rejected");
  assert(denied.reason instanceof Error);
  assert.equal(denied.reason.message, "FORBIDDEN");
  assert.deepEqual(
    await accounts(),
    before.map((user) => (user.id === admin ? { ...user, status: "disabled" } : user)),
  );
  await audit("race-disabled", ["platform_admin_access_denied"]);
}

// Mantiene abierta la transacción real después de ejecutar las escrituras.
export function holdActivationCommit(database: Database) {
  const ready = Promise.withResolvers<void>();
  const release = Promise.withResolvers<void>();
  const gated = new Proxy(database, {
    get(target, key, receiver) {
      if (key !== "transaction") return Reflect.get(target, key, receiver);
      return (operation: Parameters<Database["transaction"]>[0]) =>
        target.transaction(async (tx) => {
          const value = await operation(tx);
          ready.resolve();
          await release.promise;
          return value;
        });
    },
  });
  return { gated, ready: ready.promise, release: release.resolve };
}
