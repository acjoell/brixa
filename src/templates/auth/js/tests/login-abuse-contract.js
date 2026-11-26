import assert from "node:assert/strict";
import { createHmac, randomBytes } from "node:crypto";
import { eq } from "drizzle-orm";
import { createLoginAbuseService } from "../src/auth/login-abuse.js";
import { readActivation, withActivationWrite } from "../src/db/activation-write.js";

import { loginAbuseNow } from "../src/db/login-abuse-write.js";
import { loginAbuseCounters as counters } from "../src/db/schema.js";

export async function checkLoginAbuse(first, second, rejectUpdates) {
  const secret = randomBytes(32);
  const env = { LOGIN_ABUSE_HMAC_KEY: secret.toString("hex") };
  const service = createLoginAbuseService(first, env);
  const reopened = createLoginAbuseService(second, env);
  const email = "member@example.test";
  const ip = "192.0.2.1";
  const key = (kind, value) =>
    createHmac("sha256", secret)
      .update(kind + ":" + value)
      .digest("hex");

  assert.throws(() => createLoginAbuseService(first, {}), /LOGIN_ABUSE_INVALID_CONFIG/);
  for (const value of ["", "0", "-1", "01", "1.0", "1\n", " 1", "2147483648", 2]) {
    for (const option of [
      "LOGIN_IP_REQUEST_LIMIT",
      "LOGIN_IDENTIFIER_FAILURE_LIMIT",
      "LOGIN_ABUSE_WINDOW_MINUTES",
      "ACTIVATION_IP_REQUEST_LIMIT",
      "ACTIVATION_ABUSE_WINDOW_MINUTES",
      "ACTIVATION_VALIDATION_IP_REQUEST_LIMIT",
      "ACTIVATION_VALIDATION_ABUSE_WINDOW_MINUTES",
    ])
      assert.throws(() => createLoginAbuseService(first, { ...env, [option]: value }), {
        message: "LOGIN_ABUSE_INVALID_CONFIG: " + option,
      });
  }
  assert.throws(() => createLoginAbuseService(first, { LOGIN_ABUSE_HMAC_KEY: "sensitive" }), {
    message: "LOGIN_ABUSE_INVALID_CONFIG: LOGIN_ABUSE_HMAC_KEY",
  });
  assert.throws(() => service.consumeIp("untrusted-header"), { message: "LOGIN_ABUSE_INVALID_IP" });
  assert.throws(() => service.recordFailure("invalid"), {
    message: "LOGIN_ABUSE_INVALID_IDENTIFIER",
  });

  const read = (keyDigest) =>
    readActivation(first, async (db) => {
      const [row] = await db.select().from(counters).where(eq(counters.keyDigest, keyDigest));
      assert(row);
      return row;
    });
  const identifierDigest = key("identifier", email);
  const ipDigest = key("ip", ip);
  for (let i = 1; i <= 5; i++) {
    const result = await service.recordFailure(" MEMBER@example.test ");
    assert.equal(result.accepted, true);
    assert.equal(result.blocked, i === 5);
  }
  const initial = await read(identifierDigest);
  const identifierStatus = await reopened.identifierStatus(email);
  assert.equal(identifierStatus.blocked, true);
  assert(identifierStatus.retryAfterMs > 0 && identifierStatus.retryAfterMs <= 900_000);
  assert.equal((await reopened.recordFailure(email)).accepted, false);
  assert.deepEqual(await read(identifierDigest), initial);
  assert.deepEqual(Object.keys(initial).sort(), ["expiresAtMs", "hits", "keyDigest"]);
  assert.equal(initial.hits, 5);

  assert.equal((await service.ipStatus(ip)).blocked, false);
  for (let i = 1; i <= 10; i++) {
    const result = await service.consumeIp(i % 2 ? ip : "::ffff:c000:201");
    assert.equal(result.accepted, true);
    assert.equal(result.blocked, i === 10);
  }
  const initialIp = await read(ipDigest);
  assert.equal((await reopened.consumeIp("::ffff:192.0.2.1")).accepted, false);
  assert.deepEqual(await read(ipDigest), initialIp);
  assert.equal(initialIp.hits, 10);
  assert.equal((await reopened.identifierStatus("other@example.test")).blocked, false);
  assert.equal((await service.consumeIp("2001:0db8:0:0:0:0:0:1")).accepted, true);
  assert.equal((await read(key("ip", "2001:db8::1"))).hits, 1);

  const custom = {
    ...env,
    LOGIN_IP_REQUEST_LIMIT: "1",
    LOGIN_IDENTIFIER_FAILURE_LIMIT: "1",
    LOGIN_ABUSE_WINDOW_MINUTES: "1",
  };
  const a = createLoginAbuseService(first, custom);
  const b = createLoginAbuseService(second, custom);
  for (const [left, right] of [
    [() => a.consumeIp("192.0.2.9"), () => b.consumeIp("192.0.2.9")],
    [() => a.recordFailure("race@example.test"), () => b.recordFailure("race@example.test")],
  ]) {
    const results = await Promise.all([left(), right()]);
    assert.equal(results.filter((result) => result.accepted).length, 1);
    for (const result of results) {
      assert.equal(result.blocked, true);
      assert(result.retryAfterMs > 0 && result.retryAfterMs <= 60_000);
      if (result.accepted) assert.equal(result.retryAfterMs, 60_000);
    }
  }

  // An expiry at DB time (or earlier by the time of the read) is inactive.
  await withActivationWrite(first, async (tx) => {
    await tx
      .update(counters)
      .set({ expiresAtMs: loginAbuseNow })
      .where(eq(counters.keyDigest, identifierDigest));
  });
  assert.deepEqual(await reopened.identifierStatus(email), { blocked: false, retryAfterMs: 0 });
  assert.deepEqual(await service.recordFailure(email), {
    accepted: true,
    blocked: false,
    retryAfterMs: 0,
  });
  assert.equal((await read(identifierDigest)).hits, 1);

  await withActivationWrite(first, async (tx) => {
    await tx.insert(counters).values(
      Array.from({ length: 102 }, (_, i) => ({
        keyDigest: key("identifier", "expired-" + i),
        hits: 5,
        expiresAtMs: 1,
      })),
    );
  });
  assert.equal(await service.cleanupExpired(), 100);
  assert.equal(await reopened.cleanupExpired(), 2);
  assert.equal(await service.cleanupExpired(), 0);
  assert.equal((await read(ipDigest)).hits, 10);
  for (const [limit, consume] of [
    [10, service.consumeActivationIp],
    [20, service.consumeActivationValidationIp],
  ]) {
    for (let i = 1; i <= limit; i++) {
      const result = await consume(i % 2 ? ip : "::ffff:c000:201");
      assert.equal(result.accepted, true);
      assert.equal(result.blocked, i === limit);
    }
    const rejected = await consume(ip);
    assert.equal(rejected.accepted, false);
    assert(rejected.retryAfterMs > 0 && rejected.retryAfterMs <= 900_000);
  }

  await rejectUpdates(true);
  try {
    await assert.rejects(service.consumeIp("192.0.2.3"), { message: "LOGIN_ABUSE_STORAGE_FAILED" });
    const [rolledBack] = await readActivation(second, async (db) =>
      db
        .select()
        .from(counters)
        .where(eq(counters.keyDigest, key("ip", "192.0.2.3"))),
    );
    assert.equal(rolledBack, undefined);
    await assert.rejects(service.consumeIp(ip), { message: "LOGIN_ABUSE_STORAGE_FAILED" });
    assert.equal((await read(ipDigest)).hits, 10);
  } finally {
    await rejectUpdates(false);
  }
  assert.equal((await service.consumeIp("192.0.2.3")).accepted, true);
}
