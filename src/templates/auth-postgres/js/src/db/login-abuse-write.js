import { asc, lte, sql } from "drizzle-orm";

import { loginAbuseCounters, loginIdentifierReservations as reservations } from "./schema.js";

export const loginAbuseNow = sql`floor(extract(epoch from clock_timestamp()) * 1000)`.mapWith(
  Number,
);

export function expiredLoginAbuseKeys(tx, limit) {
  const query = tx
    .select({ keyDigest: loginAbuseCounters.keyDigest })
    .from(loginAbuseCounters)
    .where(
      lte(
        loginAbuseCounters.expiresAtMs,
        sql`floor(extract(epoch from statement_timestamp()) * 1000)::bigint`,
      ),
    )
    .orderBy(asc(loginAbuseCounters.expiresAtMs), asc(loginAbuseCounters.keyDigest))
    .limit(limit);
  return query.for("update", { skipLocked: true });
}

export function expiredLoginReservations(tx, limit) {
  return tx
    .select({ id: reservations.id })
    .from(reservations)
    .where(
      lte(
        reservations.expiresAtMs,
        sql`floor(extract(epoch from statement_timestamp()) * 1000)::bigint`,
      ),
    )
    .orderBy(asc(reservations.expiresAtMs), asc(reservations.id))
    .limit(limit);
}
