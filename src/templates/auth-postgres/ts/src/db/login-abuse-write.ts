import { asc, lte, sql } from "drizzle-orm";
import type { withActivationWrite } from "./activation-write.js";
import { loginAbuseCounters, loginIdentifierReservations as reservations } from "./schema.js";

type Write = Parameters<Parameters<typeof withActivationWrite>[1]>[0];

export const loginAbuseNow =
  sql<number>`floor(extract(epoch from clock_timestamp()) * 1000)`.mapWith(Number);

export function expiredLoginAbuseKeys(tx: Write, limit: number) {
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

export function expiredLoginReservations(tx: Write, limit: number) {
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
