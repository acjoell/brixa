import { Buffer } from "node:buffer";
import { createHmac, randomUUID } from "node:crypto";
import { isIP } from "node:net";
import { URL } from "node:url";
import { and, count, eq, gt, inArray, min, sql } from "drizzle-orm";
import { z } from "zod";
import { readActivation, withActivationWrite } from "../db/activation-write.js";

import {
  expiredLoginAbuseKeys,
  expiredLoginReservations,
  loginAbuseNow,
} from "../db/login-abuse-write.js";
import {
  loginAbuseCounters as counters,
  loginIdentifierReservations as reservations,
} from "../db/schema.js";
import { emailSchema } from "./email.js";
import { recordSystemAudit } from "./system-audit.js";

const reservationMs = 60_000;

const positiveInteger = z
  .string()
  .regex(/^[1-9][0-9]*(?![\s\S])/)
  .transform(Number)
  .pipe(z.int().min(1).max(2_147_483_647));

const config = z.object({
  LOGIN_IDENTIFIER_FAILURE_LIMIT: positiveInteger.default(5),
  LOGIN_IP_REQUEST_LIMIT: positiveInteger.default(10),
  LOGIN_ABUSE_WINDOW_MINUTES: positiveInteger.default(15),
  LOGIN_ABUSE_HMAC_KEY: z
    .string()
    .length(64)
    .regex(/^[0-9a-f]{64}$/),
});

function canonicalIp(ip) {
  const version = typeof ip === "string" && !ip.includes("%") ? isIP(ip) : 0;
  if (version === 4) return ip;
  if (version !== 6) throw new Error("LOGIN_ABUSE_INVALID_IP");
  const host = new URL("http://[" + ip + "]").hostname.slice(1, -1);
  const [, highHex, lowHex] = /^::ffff:([0-9a-f]+):([0-9a-f]+)$/.exec(host) ?? [];
  if (!highHex || !lowHex) return host;
  const high = Number.parseInt(highHex, 16);
  const low = Number.parseInt(lowHex, 16);
  return [high >>> 8, high & 255, low >>> 8, low & 255].join(".");
}

export function createLoginAbuseService(database, env = process.env) {
  const settings = config.safeParse(env);
  if (!settings.success) {
    throw new Error("LOGIN_ABUSE_INVALID_CONFIG: " + String(settings.error.issues[0].path[0]));
  }

  const {
    LOGIN_ABUSE_HMAC_KEY: secret,
    LOGIN_ABUSE_WINDOW_MINUTES: minutes,
    LOGIN_IP_REQUEST_LIMIT: ipLimit,
    LOGIN_IDENTIFIER_FAILURE_LIMIT: identifierLimit,
  } = settings.data;
  const key = Buffer.from(secret, "hex");
  const windowMs = minutes * 60_000;

  const digest = (kind, value) =>
    createHmac("sha256", key)
      .update(kind + ":" + value)
      .digest("hex");

  function identifierKey(identifier) {
    const normalized = emailSchema.safeParse(identifier);
    if (!normalized.success) throw new Error("LOGIN_ABUSE_INVALID_IDENTIFIER");
    return digest("identifier", normalized.data);
  }

  async function storage(operation) {
    try {
      return await operation();
    } catch {
      // Driver errors can contain SQL and parameter values.
      throw new Error("LOGIN_ABUSE_STORAGE_FAILED");
    }
  }

  async function status(keyDigest, limit) {
    const [row] = await storage(() =>
      readActivation(database, (connection) =>
        connection
          .select({ hits: counters.hits, expiresAtMs: counters.expiresAtMs, now: loginAbuseNow })
          .from(counters)
          .where(eq(counters.keyDigest, keyDigest))
          .execute(),
      ),
    );
    return state(row?.hits ?? 0, (row?.expiresAtMs ?? 0) - (row?.now ?? 0), limit);
  }

  function state(hits, remainingMs, limit) {
    const blocked = remainingMs > 0 && hits >= limit;
    return { blocked, retryAfterMs: blocked ? remainingMs : 0 };
  }

  async function lockCounter(tx, keyDigest) {
    // PostgreSQL locks the counter even on conflict. SQLite already holds its write lock.
    await tx
      .insert(counters)
      .values({ keyDigest, hits: 0, expiresAtMs: 0 })
      .onConflictDoUpdate({ target: counters.keyDigest, set: { hits: sql`${counters.hits}` } });
    const [row] = await tx
      .select({ hits: counters.hits, expiresAtMs: counters.expiresAtMs, now: loginAbuseNow })
      .from(counters)
      .where(eq(counters.keyDigest, keyDigest));
    if (!row) throw new Error("LOGIN_ABUSE_COUNTER_MISSING");
    return row;
  }

  async function addHit(tx, keyDigest, row) {
    const active = row.expiresAtMs > row.now;
    const hits = active ? row.hits + 1 : 1;
    const expiresAtMs = active ? row.expiresAtMs : row.now + windowMs;
    await tx.update(counters).set({ hits, expiresAtMs }).where(eq(counters.keyDigest, keyDigest));
    return { hits, expiresAtMs };
  }

  async function consume(keyDigest, limit) {
    return storage(() =>
      withActivationWrite(database, async (tx) => {
        const row = await lockCounter(tx, keyDigest);
        const current = state(row.hits, row.expiresAtMs - row.now, limit);
        if (current.blocked) return { accepted: false, ...current };

        const { hits, expiresAtMs } = await addHit(tx, keyDigest, row);
        return { accepted: true, ...state(hits, expiresAtMs - row.now, limit) };
      }),
    );
  }

  function liveReservations(keyDigest, now) {
    return and(eq(reservations.keyDigest, keyDigest), gt(reservations.expiresAtMs, now));
  }

  function reserveIdentifier(identifier) {
    const keyDigest = identifierKey(identifier);
    return storage(() =>
      withActivationWrite(database, async (tx) => {
        const row = await lockCounter(tx, keyDigest);
        const remaining = row.expiresAtMs - row.now;
        const hits = remaining > 0 ? row.hits : 0;
        if (hits >= identifierLimit) return { accepted: false, retryAfterMs: remaining };

        const [pending] = await tx
          .select({ size: count(), nextExpiry: min(reservations.expiresAtMs) })
          .from(reservations)
          .where(liveReservations(keyDigest, row.now));
        if (!pending) throw new Error("LOGIN_ABUSE_RESERVATIONS_MISSING");
        if (hits + pending.size >= identifierLimit && pending.nextExpiry !== null) {
          const remainingLease = pending.nextExpiry - row.now;
          return {
            accepted: false,
            retryAfterMs: hits > 0 ? Math.min(remaining, remainingLease) : remainingLease,
          };
        }

        const reservation = { id: randomUUID(), keyDigest };
        await tx
          .insert(reservations)
          .values({ ...reservation, expiresAtMs: row.now + reservationMs });
        return { accepted: true, reservation };
      }),
    );
  }

  // Consume the capability once. An expired or already finalized reservation never authorizes
  // a session, increments the counter or creates audit events.
  function finishIdentifier(reservation, failure) {
    const { id, keyDigest } = reservation;
    return storage(() =>
      withActivationWrite(database, async (tx) => {
        const row = await lockCounter(tx, keyDigest);
        const [deleted] = await tx
          .delete(reservations)
          .where(and(eq(reservations.id, id), liveReservations(keyDigest, row.now)))
          .returning({ id: reservations.id });
        if (!deleted) return false;

        if (failure !== null) {
          const { hits } = await addHit(tx, keyDigest, row);
          const context = { actorId: null, requestId: failure.requestId };
          await recordSystemAudit(tx, { ...context, event: "login_failed" });
          if (hits === identifierLimit)
            await recordSystemAudit(tx, { ...context, event: "brute_force_detected" });
        }
        return true;
      }),
    );
  }

  return {
    consumeIp: (ip) => consume(digest("ip", canonicalIp(ip)), ipLimit),
    // Status is a snapshot. Call consumeIp to decide and account for IP admission.
    ipStatus: (ip) => status(digest("ip", canonicalIp(ip)), ipLimit),
    // Records an observed failure. This does not reserve a slot before verification.
    recordFailure: (identifier) => consume(identifierKey(identifier), identifierLimit),
    reserveIdentifier,
    finishIdentifier,
    identifierStatus: (identifier) => status(identifierKey(identifier), identifierLimit),
    // One bounded transaction per invocation. Scheduling belongs to the caller.
    cleanupExpired: () =>
      storage(() =>
        withActivationWrite(database, async (tx) => {
          const rows = await expiredLoginAbuseKeys(tx, 100);
          if (rows.length > 0)
            await tx.delete(counters).where(
              inArray(
                counters.keyDigest,
                rows.map((row) => row.keyDigest),
              ),
            );
          const expired = await expiredLoginReservations(tx, 100);
          if (expired.length > 0)
            await tx.delete(reservations).where(
              inArray(
                reservations.id,
                expired.map(({ id }) => id),
              ),
            );
          return rows.length;
        }),
      ),
  };
}
