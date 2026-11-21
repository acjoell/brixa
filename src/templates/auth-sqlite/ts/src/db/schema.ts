import { systemAuditEvents } from "../auth/audit-events.js";
import type { SystemAuditEventName } from "../auth/audit-events.js";
import { sql } from "drizzle-orm";
import { sqliteTable, text, integer, check, index, uniqueIndex } from "drizzle-orm/sqlite-core";

const instant = (name: string) => integer(name, { mode: "timestamp_ms" });
const states = ["pending_activation", "active", "disabled"] as const;

export const users = sqliteTable(
  "users",
  {
    id: text("id").notNull().primaryKey(),
    canonicalIdentifier: text("canonical_identifier").notNull().unique(),
    status: text("status", { enum: states }).notNull().default("pending_activation"),
    passwordHash: text("password_hash"),
    createdAt: instant("created_at").notNull(),
    updatedAt: instant("updated_at").notNull(),
  },
  () => [
    check("users_status", sql`status IN ('pending_activation', 'active', 'disabled')`),
    check(
      "users_identifier_nonempty",
      sql`typeof(canonical_identifier) = 'text' AND length(trim(canonical_identifier)) > 0`,
    ),
    check(
      "users_uuid",
      sql`length(id) = 36 AND id GLOB '????????-????-????-????-????????????' AND length(replace(id, '-', '')) = 32 AND replace(id, '-', '') NOT GLOB '*[^0-9a-f]*' AND instr(id, char(0)) = 0`,
    ),
  ],
);

export const sessions = sqliteTable(
  "sessions",
  {
    sessionTokenHash: text("session_token_hash").notNull().primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id),
    createdAt: instant("created_at").notNull(),
    lastActivityAt: instant("last_activity_at").notNull(),
    idleExpiresAt: instant("idle_expires_at").notNull(),
    revokedAt: instant("revoked_at"),
  },
  (table) => [
    check(
      "sessions_digest",
      sql`typeof(session_token_hash) = 'text' AND length(session_token_hash) = 64 AND session_token_hash NOT GLOB '*[^0-9a-f]*' AND instr(session_token_hash, char(0)) = 0`,
    ),
    index("sessions_user_id_idx").on(table.userId),
  ],
);

export const auditLogSystem = sqliteTable(
  "audit_log_system",
  {
    id: text("id").notNull().primaryKey(),
    event: text("event").$type<SystemAuditEventName>().notNull(),
    actorId: text("actor_id").references(() => users.id),
    requestId: text("request_id").notNull(),
    createdAt: instant("created_at").notNull(),
  },
  (table) => [
    check(
      "audit_system_event",
      sql.raw("event IN (" + systemAuditEvents.map((name) => "'" + name + "'").join(",") + ")"),
    ),
    check(
      "audit_system_correlation",
      sql`typeof(request_id) = 'text' AND length(request_id) BETWEEN 1 AND 128 AND request_id NOT GLOB '*[^A-Za-z0-9._:-]*' AND instr(request_id,char(0)) = 0`,
    ),
    index("audit_system_request_idx").on(table.requestId),
    index("audit_system_time_idx").on(table.createdAt),
  ],
);

export const initialAdministrator = sqliteTable(
  "initial_administrator",
  {
    singleton: text("singleton").notNull().primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "restrict" }),
  },
  () => [check("initial_administrator_singleton", sql`singleton = 'initial'`)],
);

const activationStates = ["open", "consumed", "revoked", "expired"] as const;

export const activationTokens = sqliteTable(
  "activation_tokens",
  {
    tokenDigest: text("token_digest").notNull().primaryKey(),
    userId: text("user_id")
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
      sql`typeof(token_digest) = 'text' AND length(token_digest) = 64 AND token_digest NOT GLOB '*[^0-9a-f]*' AND instr(token_digest, char(0)) = 0`,
    ),
    check(
      "activation_tokens_dates",
      sql`typeof(issued_at) = 'integer' AND typeof(expires_at) = 'integer' AND (closed_at IS NULL OR typeof(closed_at) = 'integer') AND expires_at > issued_at`,
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

export const loginAbuseCounters = sqliteTable(
  "login_abuse_counters",
  {
    keyDigest: text("key_digest").notNull().primaryKey(),
    hits: integer("hits").notNull(),
    expiresAtMs: integer("expires_at_ms").notNull(),
  },
  (table) => [
    check(
      "login_abuse_digest",
      sql`typeof(key_digest) = 'text' AND length(key_digest) = 64 AND key_digest NOT GLOB '*[^0-9a-f]*' AND instr(key_digest, char(0)) = 0`,
    ),
    check(
      "login_abuse_window",
      sql`hits >= 0 AND expires_at_ms >= 0 AND typeof(hits) = 'integer' AND typeof(expires_at_ms) = 'integer'`,
    ),
    index("login_abuse_expiry_idx").on(table.expiresAtMs, table.keyDigest),
  ],
);

export const loginIdentifierReservations = sqliteTable(
  "login_identifier_reservations",
  {
    id: text("id").notNull().primaryKey(),
    keyDigest: text("key_digest").notNull(),
    expiresAtMs: integer("expires_at_ms").notNull(),
  },
  (table) => [
    check(
      "login_reservation_digest",
      sql`typeof(key_digest) = 'text' AND length(key_digest) = 64 AND key_digest NOT GLOB '*[^0-9a-f]*' AND instr(key_digest, char(0)) = 0`,
    ),
    check("login_reservation_expiry", sql`typeof(expires_at_ms) = 'integer' AND expires_at_ms > 0`),
    index("login_reservation_identifier_idx").on(table.keyDigest, table.expiresAtMs),
    index("login_reservation_expiry_idx").on(table.expiresAtMs, table.id),
  ],
);
