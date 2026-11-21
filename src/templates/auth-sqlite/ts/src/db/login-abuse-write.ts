import { asc, lte, sql } from "drizzle-orm";
import type { withActivationWrite } from "./activation-write.js";
import { loginAbuseCounters, loginIdentifierReservations as reservations } from "./schema.js";

type Write = Parameters<Parameters<typeof withActivationWrite>[1]>[0];

export const loginAbuseNow =
  sql<number>`CAST(ROUND(unixepoch('subsec') * 1000) AS INTEGER)`.mapWith(Number);

export function expiredLoginAbuseKeys(tx: Write, limit: number) {
  const query = tx
    .select({ keyDigest: loginAbuseCounters.keyDigest })
    .from(loginAbuseCounters)
    .where(lte(loginAbuseCounters.expiresAtMs, loginAbuseNow))
    .orderBy(asc(loginAbuseCounters.expiresAtMs), asc(loginAbuseCounters.keyDigest))
    .limit(limit);
  return query;
}

export function expiredLoginReservations(tx: Write, limit: number) {
  const query = tx
    .select({ id: reservations.id })
    .from(reservations)
    .where(lte(reservations.expiresAtMs, loginAbuseNow))
    .orderBy(asc(reservations.expiresAtMs), asc(reservations.id))
    .limit(limit);
  return query;
}
