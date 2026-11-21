import { systemAuditCatalog, systemAuditEvents } from "../src/auth/audit-events.js";
import { Buffer } from "node:buffer";
import { checkAuditTransactions } from "./system-audit-contract.js";
import { randomUUID } from "node:crypto";
import { createClient } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";
import { migrate } from "drizzle-orm/libsql/migrator";
import { expect, it } from "vitest";
import * as schema from "../src/db/schema.js";
import { recordSystemAudit } from "../src/auth/system-audit.js";
import { activationTokenDigest, generateActivationToken } from "../src/auth/activation-token.js";
import { isInitialAdministrator } from "../src/auth/initial-administrator.js";
import { copyFile, mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

async function copyAuditMigrations(dir, count) {
  const folder = path.join(dir, "drizzle");
  await mkdir(path.join(folder, "meta"), { recursive: true });
  const journal = JSON.parse(await readFile("drizzle/meta/_journal.json", "utf8"));
  journal.entries = journal.entries.slice(0, count);
  await writeFile(path.join(folder, "meta/_journal.json"), JSON.stringify(journal));
  for (const { tag } of journal.entries) {
    await copyFile(path.join("drizzle", tag + ".sql"), path.join(folder, tag + ".sql"));
  }
  return folder;
}

async function migrationHistory(client) {
  return (await client.execute("SELECT * FROM __drizzle_migrations ORDER BY created_at")).rows;
}

it("persiste solo los campos de auditoría permitidos y conserva la correlación", async () => {
  const dir = await mkdtemp(path.join(tmpdir(), "audit-test-"));
  const client = createClient({ url: "file:" + path.join(dir, "auth.db") });
  try {
    const db = drizzle(client, { schema });
    await migrate(db, { migrationsFolder: "drizzle" });
    await client.execute("PRAGMA foreign_keys=ON");
    const id = randomUUID();
    const now = new Date();
    await db
      .insert(schema.users)
      .values({ id, canonicalIdentifier: id, createdAt: now, updatedAt: now });
    const input = {
      event: "logout",
      actorId: id,
      requestId: randomUUID(),
      password: "sensitive",
      token: "sensitive",
      phc: "sensitive",
    };
    await recordSystemAudit(db, input);
    await recordSystemAudit(db, { event: "bootstrap", actorId: null, requestId: "cli-1" });
    const rows = await db.select().from(schema.auditLogSystem);
    expect(rows).toHaveLength(2);
    expect(rows).toContainEqual({
      event: "logout",
      actorId: id,
      requestId: input.requestId,
      id: expect.any(String),
      createdAt: expect.any(Date),
    });
    expect(rows).toContainEqual({
      event: "bootstrap",
      actorId: null,
      requestId: "cli-1",
      id: expect.any(String),
      createdAt: expect.any(Date),
    });
    await expect(recordSystemAudit(db, { ...input, actorId: randomUUID() })).rejects.toThrow();
    await expect(recordSystemAudit(db, { ...input, requestId: "" })).rejects.toThrow();
    for (const [event, correlation] of [
      ["sensitive", "valid"],
      ["logout", ""],
      ["logout", Buffer.from("a1")],
    ]) {
      await expect(
        client.execute({
          sql: "INSERT INTO audit_log_system(id,event,request_id,created_at) VALUES(?,?,?,1)",
          args: [randomUUID(), event, correlation],
        }),
      ).rejects.toThrow(/CHECK/);
    }
  } finally {
    client.close();
    await rm(dir, { recursive: true, force: true });
  }
});

it("atomicidad de auditoría y denegación durable", async () => {
  const dir = await mkdtemp(path.join(tmpdir(), "audit-tx-"));
  const url = "file:" + path.join(dir, "auth.db");
  try {
    const client = createClient({ url });
    let requestId;
    try {
      const database = drizzle(client, { schema });
      await migrate(database, { migrationsFolder: "drizzle" });
      const observer = createClient({ url });
      try {
        requestId = await checkAuditTransactions(database, drizzle(observer, { schema }));
      } finally {
        observer.close();
      }
    } finally {
      client.close();
    }
    const reader = createClient({ url });
    try {
      expect(
        (
          await reader.execute({
            sql: "SELECT event FROM audit_log_system WHERE request_id=? AND event='login_failed'",
            args: [requestId],
          })
        ).rows,
      ).toHaveLength(1);
    } finally {
      reader.close();
    }
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

it.each([2, 4])(
  "migra auditoría SQLite desde %i migraciones conservando las protecciones",
  async (previousCount) => {
    const dir = await mkdtemp(path.join(tmpdir(), "audit-upgrade-"));
    const client = createClient({ url: "file:" + path.join(dir, "auth.db") });
    try {
      const db = drizzle(client, { schema });
      const previous = await copyAuditMigrations(dir, previousCount);
      await migrate(db, { migrationsFolder: previous });
      const id = randomUUID();
      const now = new Date();
      await db
        .insert(schema.users)
        .values({ id, canonicalIdentifier: id, createdAt: now, updatedAt: now });
      await db.insert(schema.sessions).values({
        sessionTokenHash: "a".repeat(64),
        userId: id,
        createdAt: now,
        lastActivityAt: now,
        idleExpiresAt: new Date(now.getTime() + 60000),
      });
      await recordSystemAudit(db, { event: "logout", actorId: id, requestId: "original" });
      const readData = () =>
        Promise.all([
          db.select().from(schema.users),
          db.select().from(schema.sessions),
          db.select().from(schema.auditLogSystem),
        ]);
      const before = await readData();
      const previousHistory = await migrationHistory(client);
      await migrate(db, { migrationsFolder: "drizzle" });
      const migrated = await migrationHistory(client);
      expect(migrated.slice(0, previousCount)).toEqual(previousHistory);
      const journal = JSON.parse(await readFile("drizzle/meta/_journal.json", "utf8"));
      expect(migrated).toHaveLength(journal.entries.length);
      await migrate(db, { migrationsFolder: "drizzle" });
      expect(await migrationHistory(client)).toEqual(migrated);
      expect(await readData()).toEqual(before);

      const { rows: tables } = await client.execute(
        "SELECT wr FROM pragma_table_list WHERE schema='main' AND name='audit_log_system'",
      );
      expect(tables).toEqual([expect.objectContaining({ wr: 1 })]);
      const { rows: triggers } = await client.execute(
        "SELECT name FROM sqlite_schema WHERE type='trigger' AND tbl_name='audit_log_system'",
      );
      expect(triggers.map(({ name }) => name)).toEqual(
        expect.arrayContaining([
          "audit_system_no_update",
          "audit_system_no_delete",
          "audit_system_no_replace",
        ]),
      );

      expect(Object.keys(systemAuditCatalog)).toEqual(systemAuditEvents);
      for (const event of systemAuditEvents) {
        const { category, severity } = systemAuditCatalog[event];
        expect(["authentication", "session", "identity", "security"]).toContain(category);
        expect(["info", "warning", "high"]).toContain(severity);
        await recordSystemAudit(db, { event, actorId: null, requestId: "new" });
      }
      expect(systemAuditCatalog.platform_admin_access_denied).toMatchObject({
        category: "security",
        severity: "warning",
      });
      expect(systemAuditCatalog.brute_force_detected).toMatchObject({
        category: "security",
        severity: "high",
      });
      await expect(
        client.execute(
          "INSERT INTO audit_log_system VALUES ('invalid', 'unknown', NULL, 'new', 0)",
        ),
      ).rejects.toThrow(/audit_system_event/);
      const events = () =>
        db.select().from(schema.auditLogSystem).orderBy(schema.auditLogSystem.id);
      const original = await events();
      expect(original).toHaveLength(1 + systemAuditEvents.length);
      expect(original).toContainEqual(
        expect.objectContaining({ event: "bootstrap", actorId: null, requestId: "new" }),
      );
      const target = before[2][0].id;
      const values =
        "audit_log_system(id,event,request_id,created_at) VALUES(?,'bootstrap','changed',0)";
      for (const recursive of [0, 1]) {
        await client.execute("PRAGMA recursive_triggers=" + recursive);
        for (const sql of [
          "UPDATE audit_log_system SET event='bootstrap' WHERE id=?",
          "DELETE FROM audit_log_system WHERE id=?",
          "INSERT OR REPLACE INTO " + values,
          "REPLACE INTO " + values,
          "INSERT INTO " + values + " ON CONFLICT(id) DO UPDATE SET request_id=excluded.request_id",
          "INSERT OR REPLACE INTO audit_log_system(id,event,request_id,created_at) VALUES('fresh','logout','new',0),(?,'logout','changed',0)",
        ]) {
          await expect(client.execute({ sql, args: [target] })).rejects.toThrow(/append-only/);
          expect(await events()).toEqual(original);
        }
      }
      await expect(
        client.execute(
          "REPLACE INTO audit_log_system(rowid,id,event,request_id,created_at) VALUES(1,'other','logout','changed',0)",
        ),
      ).rejects.toThrow(/rowid/i);
      expect(await events()).toEqual(original);
    } finally {
      client.close();
      await rm(dir, { recursive: true, force: true });
    }
  },
);

it("revierte una reconstrucción interrumpida y permite reintentar la migración", async () => {
  const dir = await mkdtemp(path.join(tmpdir(), "audit-rollback-"));
  const client = createClient({ url: "file:" + path.join(dir, "auth.db") });
  try {
    const db = drizzle(client, { schema });
    await migrate(db, { migrationsFolder: await copyAuditMigrations(path.join(dir, "before"), 2) });
    await recordSystemAudit(db, { event: "bootstrap", actorId: null, requestId: "original" });
    const entries = () => db.select().from(schema.auditLogSystem);
    const auditSchema = async () =>
      (
        await client.execute(
          "SELECT name, sql FROM sqlite_schema WHERE tbl_name IN ('audit_log_system', 'audit_log_system_new') ORDER BY name",
        )
      ).rows;
    const before = await entries();
    const beforeSchema = await auditSchema();
    const beforeHistory = await migrationHistory(client);

    const brokenFolder = await copyAuditMigrations(path.join(dir, "broken"), 3);
    const filename = path.join(brokenFolder, "0002_audit_append_only.sql");
    const migration = await readFile(filename, "utf8");
    const drop = "DROP TABLE audit_log_system;";
    expect(migration).toContain(drop);
    await writeFile(
      filename,
      migration.replace(drop, drop + "\n--> statement-breakpoint\nDROP TABLE audit_test_missing;"),
    );
    await expect(migrate(db, { migrationsFolder: brokenFolder })).rejects.toThrow(
      /no such table: (?:main\.)?audit_test_missing/,
    );
    expect(await entries()).toEqual(before);
    expect(await auditSchema()).toEqual(beforeSchema);
    expect(await migrationHistory(client)).toEqual(beforeHistory);

    const retryFolder = await copyAuditMigrations(path.join(dir, "retry"), 3);
    await migrate(db, { migrationsFolder: retryFolder });
    expect(await entries()).toEqual(before);
    const afterHistory = await migrationHistory(client);
    expect(afterHistory).toHaveLength(3);
    expect(afterHistory.slice(0, 2)).toEqual(beforeHistory);
    await expect(client.execute("DELETE FROM audit_log_system")).rejects.toThrow(/append-only/);
  } finally {
    client.close();
    await rm(dir, { recursive: true, force: true });
  }
});

it("preserva los datos desde 0002 y restringe la autoridad inicial a una cuenta activa", async () => {
  const dir = await mkdtemp(path.join(tmpdir(), "initial-admin-"));
  const url = "file:" + path.join(dir, "auth.db");
  const client = createClient({ url });
  try {
    const db = drizzle(client, { schema });
    await migrate(db, { migrationsFolder: await copyAuditMigrations(dir, 3) });
    const id = randomUUID();
    const adminId = randomUUID();
    const now = new Date();
    await db.insert(schema.users).values([
      { id, canonicalIdentifier: id, createdAt: now, updatedAt: now },
      { id: adminId, canonicalIdentifier: adminId, createdAt: now, updatedAt: now },
    ]);
    await db.insert(schema.sessions).values({
      sessionTokenHash: "a".repeat(64),
      userId: id,
      createdAt: now,
      lastActivityAt: now,
      idleExpiresAt: now,
    });
    await recordSystemAudit(db, { event: "logout", actorId: id, requestId: "before-0003" });
    const readData = () =>
      Promise.all([
        db.select().from(schema.users).orderBy(schema.users.id),
        db.select().from(schema.sessions),
        db.select().from(schema.auditLogSystem),
      ]);
    const before = await readData();
    const history = await migrationHistory(client);
    await migrate(db, { migrationsFolder: "drizzle" });
    expect(await readData()).toEqual(before);
    expect((await migrationHistory(client)).slice(0, 3)).toEqual(history);
    expect(await db.select().from(schema.initialAdministrator)).toEqual([]);

    const assign = (singleton, userId) =>
      client.execute({
        sql: "INSERT INTO initial_administrator(singleton,user_id) VALUES (?,?)",
        args: [singleton, userId],
      });
    await expect(assign(null, adminId)).rejects.toThrow(/NOT NULL/);
    await expect(assign("another", adminId)).rejects.toThrow(/CHECK/);
    await expect(assign("initial", randomUUID())).rejects.toThrow(/FOREIGN KEY/);
    await assign("initial", adminId);
    await expect(assign("initial", id)).rejects.toThrow(/UNIQUE/);
    const otherClient = createClient({ url });
    try {
      await expect(
        otherClient.execute({ sql: "DELETE FROM users WHERE id=?", args: [adminId] }),
      ).rejects.toThrow(/FOREIGN KEY/);
    } finally {
      otherClient.close();
    }
    await expect(isInitialAdministrator(db, adminId)).resolves.toBe(false);
    await client.execute({ sql: "UPDATE users SET status='active' WHERE id=?", args: [adminId] });
    await expect(isInitialAdministrator(db, adminId)).resolves.toBe(true);
    await expect(isInitialAdministrator(db, id)).resolves.toBe(false);
    await client.execute({ sql: "UPDATE users SET status='disabled' WHERE id=?", args: [adminId] });
    await expect(isInitialAdministrator(db, adminId)).resolves.toBe(false);
  } finally {
    client.close();
    await rm(dir, { recursive: true, force: true });
  }
});

it.each(["vacía", "desde 0003"])("activa la persistencia de tokens SQLite %s", async (scenario) => {
  const dir = await mkdtemp(path.join(tmpdir(), "activation-sqlite-"));
  const client = createClient({ url: "file:" + path.join(dir, "auth.db") });
  try {
    const db = drizzle(client, { schema });
    const userId = randomUUID();
    const issuedAt = new Date("2026-11-21T12:00:00Z");
    const expiresAt = new Date("2026-11-22T12:00:00Z");
    const seedUser = () =>
      db.insert(schema.users).values({
        id: userId,
        canonicalIdentifier: "activation@example.test",
        createdAt: issuedAt,
        updatedAt: issuedAt,
      });
    const readData = () =>
      Promise.all([
        db.select().from(schema.users),
        db.select().from(schema.sessions),
        db.select().from(schema.initialAdministrator),
        db.select().from(schema.auditLogSystem),
      ]);
    if (scenario === "desde 0003") {
      await migrate(db, { migrationsFolder: await copyAuditMigrations(dir, 4) });
      await seedUser();
      await db.insert(schema.sessions).values({
        userId,
        sessionTokenHash: "a".repeat(64),
        createdAt: issuedAt,
        lastActivityAt: issuedAt,
        idleExpiresAt: expiresAt,
      });
      await db.insert(schema.initialAdministrator).values({ singleton: "initial", userId });
      await recordSystemAudit(db, { event: "bootstrap", actorId: userId, requestId: "existing" });
    }
    const before = scenario === "desde 0003" ? await readData() : [[], [], [], []];
    const history = scenario === "desde 0003" ? await migrationHistory(client) : [];
    await migrate(db, { migrationsFolder: "drizzle" });
    const migrated = await migrationHistory(client);
    expect(migrated.slice(0, history.length)).toEqual(history);
    expect(migrated).toHaveLength(6);
    expect(await readData()).toEqual(before);
    await migrate(db, { migrationsFolder: "drizzle" });
    expect(await migrationHistory(client)).toEqual(migrated);
    if (scenario === "vacía") await seedUser();
    else {
      await expect(client.execute("DELETE FROM audit_log_system")).rejects.toThrow();
      expect(await readData()).toEqual(before);
    }

    const token = generateActivationToken();
    const tokenDigest = activationTokenDigest(token);
    if (tokenDigest === null) throw new Error("El token generado debe ser canónico");
    const values = { tokenDigest, userId, issuedAt, expiresAt };
    const insert = (overrides = {}) =>
      db.insert(schema.activationTokens).values({ ...values, ...overrides });
    await insert();
    expect(await db.select().from(schema.activationTokens)).toEqual([
      { ...values, status: "open", closedAt: null },
    ]);
    const other = "b".repeat(64);
    await expect(insert({ tokenDigest: other })).rejects.toThrow();
    const closed = { status: "revoked", closedAt: issuedAt };
    await expect(insert(closed)).rejects.toThrow();
    await insert({ tokenDigest: other, ...closed });
    await insert({ tokenDigest: "c".repeat(64), status: "expired", closedAt: expiresAt });
    await insert({ tokenDigest: "d".repeat(64), status: "consumed", closedAt: issuedAt });
    for (const invalid of [
      { tokenDigest: token },
      { tokenDigest: other.toUpperCase() },
      { tokenDigest: other + "\0" },
      { userId: randomUUID() },
      { expiresAt: issuedAt },
      { closedAt: issuedAt },
      { status: "revoked" },
      { status: "expired", closedAt: issuedAt },
      { status: "consumed", closedAt: expiresAt },
      { status: "revoked", closedAt: new Date(issuedAt.getTime() - 1) },
    ]) {
      await expect(insert({ tokenDigest: "e".repeat(64), ...invalid })).rejects.toThrow();
    }
    await expect(
      client.execute({
        sql: "INSERT INTO activation_tokens VALUES (?, ?, 'revoked', ?, ?, ?)",
        args: [
          Buffer.from(other),
          userId,
          issuedAt.getTime(),
          expiresAt.getTime(),
          issuedAt.getTime(),
        ],
      }),
    ).rejects.toThrow();
    await expect(
      client.execute({
        sql: "INSERT INTO activation_tokens VALUES (?, ?, 'unknown', ?, ?, ?)",
        args: ["f".repeat(64), userId, issuedAt.getTime(), expiresAt.getTime(), issuedAt.getTime()],
      }),
    ).rejects.toThrow();
    expect(await db.select().from(schema.activationTokens)).toHaveLength(4);
  } finally {
    client.close();
    await rm(dir, { recursive: true, force: true });
  }
});
