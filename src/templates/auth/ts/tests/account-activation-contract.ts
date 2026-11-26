import assert from "node:assert/strict";
import { eq } from "drizzle-orm";
import type { ActivationDatabase } from "../src/db/activation-write.js";
import { lockActivationUser } from "../src/db/activation-write.js";
import { auditLogSystem, sessions, users } from "../src/db/schema.js";
import {
  createAccountActivationService,
  createActivationValidationService,
} from "../src/auth/activate-account.js";
import { activationTokenDigest, generateActivationToken } from "../src/auth/activation-token.js";
import { createManagedActivationService } from "../src/auth/managed-activation.js";
import { hashPassword, verifyPassword } from "../src/auth/password-crypto.js";
import type { ActivationRace, managedActivationFixture } from "./managed-activation-contract.js";

type Fixture = Awaited<ReturnType<typeof managedActivationFixture>>;
const primaryPassword = "first test credential";
const secondaryPassword = "second test credential";

function activationSetup(fixture: Fixture) {
  let now = fixture.initialTime;
  const clock = () => now;
  const activate = (db: ActivationDatabase) => createAccountActivationService(db, clock);
  const manage = (db: ActivationDatabase) => createManagedActivationService(db, {}, clock);
  const issue = async (db: ActivationDatabase, label: string) => {
    const result = await manage(db).registerAccount(fixture.actor(label), label + "@example.test");
    assert(result.created);
    return result;
  };
  const account = async (id: string) => {
    const user = (await fixture.accounts()).find((row) => row.id === id);
    assert(user);
    return user;
  };
  const audit = (id: string, events: string[]) => fixture.audit(id, events, null);
  const succeeded = (id: string) => audit(id, ["account_activated", "activation_token_consumed"]);
  return {
    activate,
    validate: (db: ActivationDatabase) => createActivationValidationService(db, clock),
    manage,
    issue,
    account,
    audit,
    succeeded,
    setNow: (value: Date) => {
      now = value.getTime();
    },
  };
}

function activationFailed(operation: Promise<unknown>) {
  return assert.rejects(operation, (error: unknown) => {
    assert(error instanceof Error);
    assert.equal(error.message, "ACTIVATION_FAILED");
    assert.equal(error.cause, undefined);
    return true;
  });
}

export async function checkAccountActivation(
  fixture: Fixture,
  runtime: ActivationDatabase,
  failAudit: (
    event: "activation_token_consumed" | "activation_token_expired",
    enabled: boolean,
  ) => Promise<unknown>,
) {
  const { activate, validate, manage, issue, account, audit, succeeded, setNow } =
    activationSetup(fixture);
  const consume = activate(runtime);
  const check = validate(runtime);
  const first = await issue(runtime, "activate-new");
  const initialUser = await account(first.userId);
  const initialToken = await fixture.tokenRows(first.userId);
  assert.equal(await check(first.token), true);
  assert.equal(await check(first.token), true);
  assert.equal(initialUser.status, "pending_activation");
  assert.equal(initialUser.passwordHash, null);
  for (const invalid of [undefined, "bad", first.token + "=", generateActivationToken()]) {
    assert.equal(await check(invalid), false);
    assert.equal(await consume(invalid, primaryPassword, "bad-token"), false);
  }
  for (const invalid of [
    "",
    "a".repeat(129),
    "\ud800",
    "ACTIVATE-NEW@EXAMPLE.TEST",
    "ACTIVATE-NEW",
  ]) {
    await assert.rejects(consume(first.token, invalid, "bad-password"), {
      message: "PASSWORD_POLICY",
    });
  }
  assert.deepEqual(await account(first.userId), initialUser);
  assert.deepEqual(await fixture.tokenRows(first.userId), initialToken);
  await audit("bad-token", []);
  await audit("bad-password", []);

  await failAudit("activation_token_consumed", true);
  await activationFailed(consume(first.token, primaryPassword, "audit-failed"));
  assert.deepEqual(await account(first.userId), initialUser);
  assert.deepEqual(await fixture.tokenRows(first.userId), initialToken);
  await audit("audit-failed", []);
  await failAudit("activation_token_consumed", false);
  assert.equal(await consume(first.token, primaryPassword, "confirm"), true);
  const activated = await account(first.userId);
  assert.equal(activated.status, "active");
  assert(await verifyPassword(primaryPassword, activated.passwordHash));
  assert.deepEqual(await fixture.tokenRows(first.userId), [
    { ...initialToken[0], status: "consumed", closedAt: new Date(fixture.initialTime) },
  ]);
  await succeeded("confirm");
  assert.equal(await check(first.token), false);
  assert.equal(await consume(first.token, secondaryPassword, "reuse"), false);
  assert.deepEqual(await account(first.userId), activated);

  const revoked = await issue(runtime, "activate-revoked");
  assert.equal(await check(revoked.token), true);
  await manage(runtime).revokeActivationToken(fixture.actor("revoke"), revoked.userId);
  assert.equal(await check(revoked.token), false);
  assert.equal(await consume(revoked.token, primaryPassword, "revoked"), false);
  await audit("revoked", []);
  await audit("reuse", []);

  const pendingWithPassword = await issue(runtime, "activate-hashed");
  await fixture.owner
    .update(users)
    .set({ passwordHash: await hashPassword(secondaryPassword) })
    .where(eq(users.id, pendingWithPassword.userId));
  const existing = await account(pendingWithPassword.userId);
  for (const status of ["pending_activation", "active", "disabled"] as const) {
    await fixture.owner
      .update(users)
      .set({ status })
      .where(eq(users.id, pendingWithPassword.userId));
    assert.equal(await check(pendingWithPassword.token), false);
    assert.equal(await consume(pendingWithPassword.token, primaryPassword, "incompatible"), false);
    assert.deepEqual(await account(pendingWithPassword.userId), { ...existing, status });
  }
  await audit("incompatible", []);

  const expired = await issue(runtime, "activate-expired");
  assert.equal(await check(expired.token), true);
  setNow(expired.expiresAt);
  const expiredBefore = await fixture.tokenRows(expired.userId);
  assert.equal(await check(expired.token), false);
  assert.deepEqual(await fixture.tokenRows(expired.userId), expiredBefore);
  await failAudit("activation_token_expired", true);
  await activationFailed(consume(expired.token, primaryPassword, "expiry-audit-failed"));
  assert.deepEqual(await fixture.tokenRows(expired.userId), expiredBefore);
  await audit("expiry-audit-failed", []);
  await failAudit("activation_token_expired", false);
  assert.equal(await consume(expired.token, primaryPassword, "expire-now"), false);
  assert.equal(await consume(expired.token, primaryPassword, "expire-again"), false);
  await audit("expire-now", ["activation_token_expired"]);
  await audit("expire-again", []);
  const [closed] = await fixture.tokenRows(expired.userId);
  assert.equal(closed?.status, "expired");
  assert.deepEqual(closed.closedAt, expired.expiresAt);
  assert.equal((await account(expired.userId)).status, "pending_activation");
  assert.equal((await account(expired.userId)).passwordHash, null);
  assert.deepEqual(await fixture.owner.select().from(sessions), []);
  const serializedAudit = JSON.stringify(await fixture.owner.select().from(auditLogSystem));
  for (const secret of [
    first.token,
    primaryPassword,
    secondaryPassword,
    activated.passwordHash,
    activationTokenDigest(first.token),
  ]) {
    assert(secret && !serializedAudit.includes(secret));
  }
}

export async function checkAccountActivationRaces(
  fixture: Fixture,
  runtime: ActivationDatabase,
  race: ActivationRace,
) {
  const { activate, manage, issue, account, audit, succeeded, setNow } = activationSetup(fixture);
  const first = await issue(runtime, "race-consume");
  const [confirmed, racing] = await race(
    (db) => activate(db)(first.token, primaryPassword, "winner"),
    (db) => activate(db)(first.token, secondaryPassword, "second"),
  );
  assert.equal(confirmed, true);
  assert.deepEqual(racing, { status: "fulfilled", value: false });
  assert(await verifyPassword(primaryPassword, (await account(first.userId)).passwordHash));
  assert(!(await verifyPassword(secondaryPassword, (await account(first.userId)).passwordHash)));
  assert.equal((await fixture.tokenRows(first.userId))[0]?.status, "consumed");
  await succeeded("winner");
  await audit("second", []);

  const regen = await issue(runtime, "race-regenerate");
  const [replacement, late] = await race(
    (db) => manage(db).regenerateActivationToken(fixture.actor("replacement"), regen.userId),
    (db) => activate(db)(regen.token, primaryPassword, "after-replacement"),
  );
  assert.deepEqual(late, { status: "fulfilled", value: false });
  const tokens = await fixture.tokenRows(regen.userId);
  assert.equal(tokens.length, 2);
  assert.equal(
    tokens.find(({ status }) => status === "open")?.tokenDigest,
    activationTokenDigest(replacement.token),
  );
  assert.equal((await account(regen.userId)).passwordHash, null);
  await audit("after-replacement", []);

  const revoke = await issue(runtime, "race-activation-revoke");
  const [revoked, afterRevoke] = await race(
    (db) => manage(db).revokeActivationToken(fixture.actor("revoke-first"), revoke.userId),
    (db) => activate(db)(revoke.token, primaryPassword, "after-revoke"),
  );
  assert.equal(revoked.closed, "revoked");
  assert.deepEqual(afterRevoke, { status: "fulfilled", value: false });
  assert.equal((await fixture.tokenRows(revoke.userId))[0]?.status, "revoked");
  assert.equal((await account(revoke.userId)).passwordHash, null);
  await audit("after-revoke", []);

  const disable = await issue(runtime, "race-disable-activation");
  const [, afterDisable] = await race(
    (_db, writer) =>
      writer.transaction(async (tx) => {
        await tx.update(users).set({ status: "disabled" }).where(eq(users.id, disable.userId));
      }),
    (db) => activate(db)(disable.token, primaryPassword, "after-disable"),
  );
  assert.deepEqual(afterDisable, { status: "fulfilled", value: false });
  const disabled = await account(disable.userId);
  assert.equal(disabled.status, "disabled");
  assert.equal(disabled.passwordHash, null);
  assert.equal((await fixture.tokenRows(disable.userId))[0]?.status, "open");
  await audit("after-disable", []);

  const expiry = await issue(runtime, "race-expire-activation");
  const [, afterExpiry] = await race(
    (_db, writer) => writer.transaction((tx) => lockActivationUser(tx, expiry.userId)),
    (db) => activate(db)(expiry.token, primaryPassword, "expires-while-waiting"),
    () => setNow(expiry.expiresAt),
  );
  assert.deepEqual(afterExpiry, { status: "fulfilled", value: false });
  const [expired] = await fixture.tokenRows(expiry.userId);
  assert.equal(expired?.status, "expired");
  assert.deepEqual(expired.closedAt, expiry.expiresAt);
  assert.equal((await account(expiry.userId)).status, "pending_activation");
  assert.equal((await account(expiry.userId)).passwordHash, null);
  assert.equal(
    await activate(runtime)(expiry.token, secondaryPassword, "after-expiry-race"),
    false,
  );
  await audit("expires-while-waiting", ["activation_token_expired"]);
  await audit("after-expiry-race", []);
  assert.deepEqual(await fixture.owner.select().from(sessions), []);
}
