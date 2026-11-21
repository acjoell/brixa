import { asc, lte, sql } from "drizzle-orm";

import { loginAbuseCounters, loginIdentifierReservations as reservations } from "./schema.js";

export const loginAbuseNow = sql`CAST(ROUND(unixepoch('subsec') * 1000) AS INTEGER)`.mapWith(
  Number,
);

export function expiredLoginAbuseKeys(tx, limit) {
  const query = tx
    .select({ keyDigest: loginAbuseCounters.keyDigest })
    .from(loginAbuseCounters)
    .where(lte(loginAbuseCounters.expiresAtMs, loginAbuseNow))
    .orderBy(asc(loginAbuseCounters.expiresAtMs), asc(loginAbuseCounters.keyDigest))
    .limit(limit);
  return query;
}

export function expiredLoginReservations(tx, limit) {
  const query = tx
    .select({ id: reservations.id })
    .from(reservations)
    .where(lte(reservations.expiresAtMs, loginAbuseNow))
    .orderBy(asc(reservations.expiresAtMs), asc(reservations.id))
    .limit(limit);
  return query;
}
