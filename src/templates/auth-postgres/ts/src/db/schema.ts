import { systemAuditEvents } from "../auth/audit-events.js";
import type { SystemAuditEventName } from "../auth/audit-events.js";
import { sql } from "drizzle-orm";
import {
  pgTable,
  bigint,
  integer,
  text,
  uuid,
  timestamp,
  check,
  index,
  uniqueIndex,
} from "drizzle-orm/pg-core";

const instant = (name: string) => timestamp(name, { withTimezone: true });
const states = ["pending_activation", "active", "disabled"] as const;

export const users = pgTable(
  "users",
  {
    id: uuid("id").notNull().primaryKey(),
    canonicalIdentifier: text("canonical_identifier").notNull().unique(),
    status: text("status", { enum: states }).notNull().default("pending_activation"),
    passwordHash: text("password_hash"),
    createdAt: instant("created_at").notNull(),
    updatedAt: instant("updated_at").notNull(),
  },
  () => [
    check("users_status", sql`status IN ('pending_activation', 'active', 'disabled')`),
    check("users_identifier_nonempty", sql`length(trim(canonical_identifier)) > 0`),
  ],
);

export const sessions = pgTable(
  "sessions",
  {
    sessionTokenHash: text("session_token_hash").notNull().primaryKey(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id),
    createdAt: instant("created_at").notNull(),
    lastActivityAt: instant("last_activity_at").notNull(),
    idleExpiresAt: instant("idle_expires_at").notNull(),
    revokedAt: instant("revoked_at"),
  },
  (table) => [
    check("sessions_digest", sql`session_token_hash ~ '^[0-9a-f]{64}$'`),
    index("sessions_user_id_idx").on(table.userId),
  ],
);

export const auditLogSystem = pgTable(
  "audit_log_system",
  {
    id: uuid("id").notNull().primaryKey(),
    event: text("event").$type<SystemAuditEventName>().notNull(),
    actorId: uuid("actor_id").references(() => users.id),
    requestId: text("request_id").notNull(),
    createdAt: instant("created_at").notNull(),
  },
  (table) => [
    check(
      "audit_system_event",
      sql.raw("event IN (" + systemAuditEvents.map((name) => "'" + name + "'").join(",") + ")"),
    ),
    check("audit_system_correlation", sql`request_id ~ '^[A-Za-z0-9._:-]{1,128}$'`),
    index("audit_system_request_idx").on(table.requestId),
    index("audit_system_time_idx").on(table.createdAt),
  ],
);

export const initialAdministrator = pgTable(
  "initial_administrator",
  {
    singleton: text("singleton").notNull().primaryKey(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "restrict" }),
  },
  () => [check("initial_administrator_singleton", sql`singleton = 'initial'`)],
);

const activationStates = ["open", "consumed", "revoked", "expired"] as const;

export const activationTokens = pgTable(
  "activation_tokens",
  {
    tokenDigest: text("token_digest").notNull().primaryKey(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id),
    status: text("status", { enum: activationStates }).notNull().default("open"),
    issuedAt: instant("issued_at").notNull(),
    expiresAt: instant("expires_at").notNull(),
    closedAt: instant("closed_at"),
  },
  (table) => [
    check(
      "activation_tokens_digest",
      sql`length(token_digest) = 64 AND token_digest ~ '^[0-9a-f]+$'`,
    ),
    check(
      "activation_tokens_dates",
      sql`isfinite(issued_at) AND isfinite(expires_at) AND (closed_at IS NULL OR isfinite(closed_at)) AND expires_at > issued_at`,
    ),
    check(
      "activation_tokens_lifecycle",
      sql`(status = 'open' AND closed_at IS NULL) OR
          (closed_at IS NOT NULL AND closed_at >= issued_at AND (
            (status = 'consumed' AND closed_at < expires_at) OR
            status = 'revoked' OR
            (status = 'expired' AND closed_at >= expires_at)
          ))`,
    ),
    uniqueIndex("activation_tokens_open_user_idx")
      .on(table.userId)
      .where(sql`status = 'open'`),
  ],
);

export const loginAbuseCounters = pgTable(
  "login_abuse_counters",
  {
    keyDigest: text("key_digest").notNull().primaryKey(),
    hits: integer("hits").notNull(),
    expiresAtMs: bigint("expires_at_ms", { mode: "number" }).notNull(),
  },
  (table) => [
    check("login_abuse_digest", sql`length(key_digest) = 64 AND key_digest ~ '^[0-9a-f]+$'`),
    check("login_abuse_window", sql`hits >= 0 AND expires_at_ms >= 0`),
    index("login_abuse_expiry_idx").on(table.expiresAtMs, table.keyDigest),
  ],
);

export const loginIdentifierReservations = pgTable(
  "login_identifier_reservations",
  {
    id: uuid("id").notNull().primaryKey(),
    keyDigest: text("key_digest").notNull(),
    expiresAtMs: bigint("expires_at_ms", { mode: "number" }).notNull(),
  },
  (table) => [
    check("login_reservation_digest", sql`length(key_digest) = 64 AND key_digest ~ '^[0-9a-f]+$'`),
    check("login_reservation_expiry", sql`expires_at_ms > 0`),
    index("login_reservation_identifier_idx").on(table.keyDigest, table.expiresAtMs),
    index("login_reservation_expiry_idx").on(table.expiresAtMs, table.id),
  ],
);
