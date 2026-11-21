import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import { systemAuditCatalog } from "../src/auth/audit-events.js";
import { bootstrapInitialAdministrator } from "../src/auth/bootstrap.js";
import { createPasswordChangeService } from "../src/auth/change-password.js";
import { createLoginService } from "../src/auth/login.js";
import { hashPassword } from "../src/auth/password-crypto.js";
import { recoverInitialAdministrator } from "../src/auth/recover-admin.js";
import { createSessionService } from "../src/auth/sessions.js";

import { auditLogSystem, initialAdministrator, sessions, users } from "../src/db/schema.js";
import { holdWrite, interleave } from "./change-password-contract.js";

const event = "initial_admin_password_recovered";

export async function checkAdminRecovery(
  owner,
  secondOwner,
  runtime,
  runtimeWriter,
  wrapWriter,
  upgrade,
  failAudit,
) {
  const email = "initial@example.test";
  const previous = "original test credential";
  const next = "test recovered credential";
  const final = "final recovered credential";
  const recover = (password, requestId) => recoverInitialAdministrator(owner, password, requestId);
  assert.equal(await recover(next, "missing"), false);
  assert.deepEqual(systemAuditCatalog[event], { category: "security", severity: "warning" });
  const { userId } = await bootstrapInitialAdministrator(owner, { email, password: previous });
  const login = await createLoginService(runtimeWriter);
  const validation = createSessionService(runtime);
  async function issue(password, requestId, identifier = email) {
    const token = await login(identifier, password, requestId);
    assert(token);
    return token;
  }
  const first = await issue(previous, "first");
  const second = await issue(previous, "second");
  const outsider = randomUUID();
  const now = new Date();
  await owner.insert(users).values({
    id: outsider,
    canonicalIdentifier: "other@example.test",
    passwordHash: await hashPassword(previous),
    status: "active",
    createdAt: now,
    updatedAt: now,
  });
  const unrelated = await issue(previous, "unrelated", "other@example.test");
  const read = async () => [
    await owner.select().from(users).orderBy(users.id),
    await owner.select().from(initialAdministrator),
    await owner.select().from(sessions).orderBy(sessions.sessionTokenHash),
    await owner.select().from(auditLogSystem).orderBy(auditLogSystem.id),
  ];

  const before = await read();
  await upgrade();
  assert.deepEqual(await read(), before);
  const status = (value) => owner.update(users).set({ status: value }).where(eq(users.id, userId));
  await status("disabled");
  assert.equal(await recover(next, "disabled"), false);
  assert.equal(await recover("\ud800", "invalid"), false);
  assert.equal(
    (await owner.select().from(users).where(eq(users.id, userId)))[0].status,
    "disabled",
  );
  await status("active");
  assert.deepEqual(await read(), before);
  await failAudit(true);
  try {
    await assert.rejects(recover(next, "rollback"), (error) => {
      assert(error instanceof Error);
      assert.equal(error.message, "ADMIN_RECOVERY_FAILED");
      assert.equal(error.cause, undefined);
      return true;
    });
  } finally {
    await failAudit(false);
  }
  assert.deepEqual(await read(), before);

  assert.equal(await recover(next, "success"), true);
  assert.equal(await validation.validateSession(first), null);
  assert.equal(await validation.validateSession(second), null);
  assert.equal(await validation.validateSession(unrelated), outsider);
  const [updated] = await owner.select().from(users).where(eq(users.id, userId));
  const original = before[0].find(({ id }) => id === userId);
  assert(original);
  assert.deepEqual(
    { ...updated, passwordHash: original.passwordHash, updatedAt: original.updatedAt },
    original,
  );
  assert.deepEqual(await owner.select().from(initialAdministrator), before[1]);
  assert.equal((await owner.select().from(sessions)).length, before[2].length);
  assert.equal(await login(email, previous, "obsolete"), null);
  let token = await issue(next, "new-password");

  const staleLogin = holdWrite();
  const loginOnHold = await createLoginService(wrapWriter(staleLogin.gate));
  assert.equal(
    await interleave(staleLogin, loginOnHold(email, next, "stale-login"), async () => {
      assert.equal(await recover(final, "beats-login"), true);
    }),
    null,
  );
  assert.equal(await validation.validateSession(token), null);
  token = await issue(final, "change-race");
  const staleChange = holdWrite();
  const change = createPasswordChangeService(wrapWriter(staleChange.gate));
  assert.equal(
    await interleave(staleChange, change(token, final, previous, "stale-change"), async () => {
      assert.equal(await recover(next, "beats-change"), true);
    }),
    false,
  );
  assert.equal(await validation.validateSession(token), null);

  const delayed = holdWrite();
  assert.equal(
    await interleave(
      delayed,
      recoverInitialAdministrator(delayed.gate(owner), final, "last-recovery"),
      async () => {
        assert.equal(
          await recoverInitialAdministrator(secondOwner, previous, "first-recovery"),
          true,
        );
      },
    ),
    true,
  );
  assert.equal(await login(email, previous, "concurrent-obsolete"), null);
  assert(await issue(final, "concurrent-winner"));
  const events = await owner.select().from(auditLogSystem).where(eq(auditLogSystem.event, event));
  assert.deepEqual(events.map(({ requestId }) => requestId).sort(), [
    "beats-change",
    "beats-login",
    "first-recovery",
    "last-recovery",
    "success",
  ]);
  assert(events.every(({ actorId }) => actorId === null));
  const logs = JSON.stringify(events);
  for (const secret of [
    first,
    second,
    unrelated,
    token,
    previous,
    next,
    final,
    original.passwordHash,
  ])
    assert(secret && !logs.includes(secret));
}
