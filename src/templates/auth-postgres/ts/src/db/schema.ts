import { systemAuditEvents } from "../auth/audit-events.js";
import { sql } from "drizzle-orm";
import { pgTable, text, uuid, timestamp, check, index } from "drizzle-orm/pg-core";

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
    event: text("event", { enum: systemAuditEvents }).notNull(),
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
