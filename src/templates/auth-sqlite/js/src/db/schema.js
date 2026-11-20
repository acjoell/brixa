import { systemAuditEvents } from "../auth/audit-events.js";
import { sql } from "drizzle-orm";
import { sqliteTable, text, integer, check, index } from "drizzle-orm/sqlite-core";

const instant = (name) => integer(name, { mode: "timestamp_ms" });
const states = ["pending_activation", "active", "disabled"];

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
    event: text("event", { enum: systemAuditEvents }).notNull(),
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
