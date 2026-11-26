import { checkAuditTransactions } from "./system-audit-contract.js";
import { checkBusinessAuth } from "./require-auth-contract.js";
import { recordSystemAudit } from "../src/auth/system-audit.js";
import { URL } from "node:url";
import { Buffer } from "node:buffer";
import { createHash, randomUUID } from "node:crypto";
import { copyFile, mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { setImmediate } from "node:timers/promises";
import pg from "pg";
import { drizzle } from "drizzle-orm/node-postgres";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import * as schema from "../src/db/schema.js";
import { createSessionService } from "../src/auth/sessions.js";

// Activación explícita independiente de DATABASE_URL y de archivos .env.
function barrier() {
  let resolve;
  const promise = new Promise((done) => {
    resolve = done;
  });
  return { promise, resolve };
}

const adminUrl = process.env.BRIXA_TEST_POSTGRES_ADMIN_URL;
const enabled = process.env.BRIXA_TEST_POSTGRES === "1" && Boolean(adminUrl);

describe.runIf(enabled)("sesiones PostgreSQL aisladas", () => {
  const name = "brixa_auth_test_" + randomUUID().replaceAll("-", "");
  let created = false;
  let admin;
  let first;
  let second;
  let observer;
  let database;
  let otherDatabase;
  let service;
  let other;
  let now;
  let id;
  let token;
  let initial;
  const preMigrationUserId = randomUUID();

  const digest = (value) => createHash("sha256").update(Buffer.from(value, "hex")).digest("hex");
  const row = async () =>
    (await first.query("SELECT * FROM sessions WHERE session_token_hash=$1", [digest(token)]))
      .rows[0];

  function pinnedDatabase(client) {
    // El servicio usa la API Drizzle, no $client. Reservar el cliente evita
    // reconexiones o transferencia de la transacción a otro backend en estas pruebas.
    return drizzle(client, { schema });
  }

  function track(promise) {
    const state = { status: "pending", code: undefined };
    const settled = promise.then(
      () => {
        state.status = "completed";
      },
      (error) => {
        state.status = "rejected";
        // Mensajes nativos pueden incluir SQL o parámetros: registrar solo código.
        const cause = error instanceof Error ? error.cause : undefined;
        const value = cause ?? error;
        if (
          value &&
          typeof value === "object" &&
          "code" in value &&
          typeof value.code === "string" &&
          /^[A-Z0-9_]{1,32}$/.test(value.code)
        ) {
          state.code = value.code;
        }
      },
    );
    return { state, settled };
  }

  async function blockedBy(waiter, blocker, operation) {
    const deadline = Date.now() + 4000;
    while (true) {
      const result = await admin.query(
        `SELECT pid, state, wait_event_type, wait_event,
                xact_start IS NOT NULL AS transaction_open,
                pg_blocking_pids(pid) AS blockers
         FROM pg_stat_activity WHERE datname=$1 AND pid = ANY($2::int[])`,
        [name, [waiter, blocker]],
      );
      const waiting = result.rows.find((row) => row.pid === waiter);
      if (operation.state.status === "pending" && waiting?.blockers.includes(blocker)) return;
      if (operation.state.status !== "pending" || Date.now() >= deadline) {
        throw new Error(
          JSON.stringify({
            barrier:
              operation.state.status === "pending" ? "observation_timeout" : operation.state.status,
            waiter,
            blocker,
            operation: operation.state,
            activity: result.rows,
          }),
        );
      }
      await setImmediate();
    }
  }

  async function raceConnections(operation) {
    const clients = [];
    try {
      for (const pool of [first, second, observer]) clients.push(await pool.connect());
      const pids = await Promise.all(
        clients.map(
          async (client) => (await client.query("SELECT pg_backend_pid() AS pid")).rows[0].pid,
        ),
      );
      await operation(clients[0], clients[1], clients[2], pids[0], pids[1], pids[2]);
    } finally {
      await Promise.all(
        clients.map(async (client) => {
          try {
            await client.query("ROLLBACK");
          } finally {
            client.release();
          }
        }),
      );
    }
  }

  beforeAll(async () => {
    admin = new pg.Client({ connectionString: adminUrl, connectionTimeoutMillis: 5000 });
    await admin.connect();
    // Nombre generado internamente. CREATE DATABASE falla si ya existe.
    await admin.query('CREATE DATABASE "' + name + '" TEMPLATE template0');
    created = true;
    const url = new URL(adminUrl);
    url.pathname = "/" + name;
    for (const key of ["database", "dbname"]) url.searchParams.delete(key);
    const config = {
      max: 1,
      connectionString: url.toString(),
      connectionTimeoutMillis: 5000,
      statement_timeout: 6000,
      lock_timeout: 5000,
      idle_in_transaction_session_timeout: 10000,
    };
    first = new pg.Pool(config);
    second = new pg.Pool(config);
    observer = new pg.Pool(config);
    await Promise.all([
      first.query("SELECT 1"),
      second.query("SELECT 1"),
      observer.query("SELECT 1"),
    ]);
    // Verifica aislamiento antes de ejecutar SQL de esquema o datos.
    for (const client of [first, second, observer]) {
      expect((await client.query("SELECT current_database() AS name")).rows[0].name).toBe(name);
    }
    database = drizzle(first, { schema });
    otherDatabase = drizzle(second, { schema });
    expect(
      (await first.query("SELECT tablename FROM pg_tables WHERE schemaname='public'")).rows,
    ).toEqual([]);
    const migrationsFolder = await mkdtemp(join(tmpdir(), "brixa-postgres-auth-"));
    try {
      const journal = JSON.parse(await readFile("drizzle/meta/_journal.json", "utf8"));

      expect(journal.entries.slice(0, 2).map((entry) => entry.tag)).toEqual([
        "0000_auth",
        "0001_system_audit",
      ]);
      await mkdir(join(migrationsFolder, "meta"));
      await copyFile("drizzle/0000_auth.sql", join(migrationsFolder, "0000_auth.sql"));
      await writeFile(
        join(migrationsFolder, "meta", "_journal.json"),
        JSON.stringify({ ...journal, entries: journal.entries.slice(0, 1) }),
      );
      await migrate(database, { migrationsFolder });
      const history = async () =>
        (await first.query("SELECT * FROM drizzle.__drizzle_migrations ORDER BY id")).rows;
      const authMigration = await history();
      expect(authMigration).toHaveLength(1);
      expect(
        (await first.query("SELECT to_regclass('public.audit_log_system') AS relation")).rows,
      ).toEqual([{ relation: null }]);

      const issuedAt = 1_700_000_000_123;
      await database.insert(schema.users).values({
        id: preMigrationUserId,
        canonicalIdentifier: "upgrade-" + preMigrationUserId,
        status: "active",
        createdAt: new Date(issuedAt - 1000),
        updatedAt: new Date(issuedAt),
      });
      const preMigrationSession = await createSessionService(
        database,
        {},
        () => issuedAt,
      ).createSession(preMigrationUserId);
      expect(preMigrationSession).not.toBeNull();
      const users = async () => (await first.query("SELECT * FROM users")).rows;
      const sessions = async () => (await first.query("SELECT * FROM sessions")).rows;
      const usersBefore = await users();
      const sessionsBefore = await sessions();
      expect(usersBefore).toHaveLength(1);
      expect(sessionsBefore).toHaveLength(1);

      await copyFile(
        "drizzle/0001_system_audit.sql",
        join(migrationsFolder, "0001_system_audit.sql"),
      );
      await writeFile(
        join(migrationsFolder, "meta", "_journal.json"),
        JSON.stringify({ ...journal, entries: journal.entries.slice(0, 2) }),
      );
      await migrate(database, { migrationsFolder });
      expect(await users()).toEqual(usersBefore);
      expect(await sessions()).toEqual(sessionsBefore);
      const upgraded = await history();
      expect(upgraded).toHaveLength(2);
      expect(upgraded[0]).toEqual(authMigration[0]);
      await migrate(database, { migrationsFolder });
      expect(await history()).toEqual(upgraded);
      // El contrato de auditoría actual escribe una denegación administrativa.
      // Esta fixture histórica usa el rol de prueba, sin las ACL del proyecto real.
      const platformAudit = journal.entries.find(
        (entry) => entry.tag === "0005_platform_admin_audit",
      );
      expect(platformAudit).toBeDefined();
      await copyFile(
        "drizzle/0005_platform_admin_audit.sql",
        join(migrationsFolder, "0005_platform_admin_audit.sql"),
      );
      await writeFile(
        join(migrationsFolder, "meta", "_journal.json"),
        JSON.stringify({ ...journal, entries: [...journal.entries.slice(0, 2), platformAudit] }),
      );
      await migrate(database, { migrationsFolder });
    } finally {
      await rm(migrationsFolder, { recursive: true, force: true });
    }
  }, 20000);

  afterAll(async () => {
    await Promise.allSettled([first?.end(), second?.end(), observer?.end()]);
    try {
      if (created) await admin.query('DROP DATABASE "' + name + '"');
    } finally {
      await admin?.end();
    }
  }, 15000);

  beforeEach(async () => {
    now = initial = 1_700_000_000_000;
    id = randomUUID();
    service = createSessionService(database, {}, () => now);
    other = createSessionService(otherDatabase, {}, () => now);
    await database.insert(schema.users).values({
      id,
      canonicalIdentifier: id,
      status: "active",
      createdAt: new Date(now),
      updatedAt: new Date(now),
    });
    token = await service.createSession(id);
  });

  it.each(["cookie", "bearer"])("protege rutas de negocio PostgreSQL con %s", async (mode) => {
    await checkBusinessAuth(mode, database, database);
  });

  it("atomicidad de auditoría ante escrituras concurrentes", async () => {
    const observing = drizzle(observer, { schema });
    const ids = await Promise.all([
      checkAuditTransactions(database, observing),
      checkAuditTransactions(otherDatabase, observing),
    ]);
    (await observer.connect()).release(true);
    const reader = await observer.connect();
    try {
      const rows = await reader.query(
        "SELECT request_id FROM audit_log_system WHERE event='login_failed' AND request_id=ANY($1::text[])",
        [ids],
      );
      expect(rows.rows.map((row) => row.request_id).sort()).toEqual(ids.sort());
    } finally {
      reader.release();
    }
  });

  it("persiste auditoría global con y sin actor y exige correlación y actor válido", async () => {
    const requestId = randomUUID();
    await recordSystemAudit(database, { event: "login_failed", actorId: null, requestId });
    await recordSystemAudit(database, { event: "logout", actorId: preMigrationUserId, requestId });
    const result = await first.query("SELECT actor_id FROM audit_log_system WHERE request_id=$1", [
      requestId,
    ]);
    expect(result.rows.map((row) => row.actor_id)).toEqual(
      expect.arrayContaining([preMigrationUserId, null]),
    );
    await expect(
      first.query("UPDATE audit_log_system SET request_id='' WHERE request_id=$1", [requestId]),
    ).rejects.toMatchObject({ code: "23514" });
    await expect(
      recordSystemAudit(database, { event: "logout", actorId: randomUUID(), requestId }),
    ).rejects.toMatchObject({ cause: { code: "23503" } });
  });

  it("migra desde vacío dos veces y aplica PK, UNIQUE, FK, estados, digest y fechas", async () => {
    const duplicate = "INSERT INTO users SELECT * FROM users WHERE id=$1";
    await expect(first.query(duplicate, [id])).rejects.toMatchObject({ code: "23505" });
    await expect(
      first.query(
        "INSERT INTO users (id,canonical_identifier,created_at,updated_at) VALUES ($1,$2,now(),now())",
        [randomUUID(), id],
      ),
    ).rejects.toMatchObject({ code: "23505" });
    await expect(
      first.query("UPDATE users SET status='invalid' WHERE id=$1", [id]),
    ).rejects.toMatchObject({ code: "23514" });
    await expect(
      first.query("UPDATE sessions SET user_id=$1 WHERE session_token_hash=$2", [
        randomUUID(),
        digest(token),
      ]),
    ).rejects.toMatchObject({ code: "23503" });
    for (const value of ["invalid", "A".repeat(64), "0".repeat(63), "0".repeat(65)]) {
      await expect(
        first.query("UPDATE sessions SET session_token_hash=$1 WHERE session_token_hash=$2", [
          value,
          digest(token),
        ]),
      ).rejects.toMatchObject({ code: "23514" });
    }
    await expect(
      first.query("INSERT INTO sessions SELECT * FROM sessions WHERE session_token_hash=$1", [
        digest(token),
      ]),
    ).rejects.toMatchObject({ code: "23505" });
    const record = await row();
    expect(record.created_at.getTime()).toBe(initial);
    expect(record.last_activity_at.getTime()).toBe(initial);
    expect(record.idle_expires_at.getTime()).toBe(initial + 1_800_000);
    expect(record.revoked_at).toBeNull();
  });

  it("persiste solo el digest y consulta tokens válidos o manipulados", async () => {
    const another = await service.createSession(id);
    expect(another).not.toBe(token);
    expect(token).toMatch(/^[0-9a-f]{64}$/);
    expect(another).toMatch(/^[0-9a-f]{64}$/);
    expect(await row()).toEqual({
      session_token_hash: digest(token),
      user_id: id,
      created_at: new Date(initial),
      last_activity_at: new Date(initial),
      idle_expires_at: new Date(initial + 1_800_000),
      revoked_at: null,
    });
    expect(await other.validateSession(token)).toBe(id);
    expect(await other.validateSession((token[0] === "0" ? "1" : "0") + token.slice(1))).toBeNull();
    expect(await other.validateSession("bad")).toBeNull();
  });

  it("respeta 60 s y 30 min y excluye polling", async () => {
    now += 59_999;
    expect(await service.validateSession(token, true)).toBe(id);
    expect((await row()).last_activity_at.getTime()).toBe(initial);
    now++;
    expect(await other.validateSession(token)).toBe(id);
    expect((await row()).last_activity_at.getTime()).toBe(initial);
    expect(await service.validateSession(token, true)).toBe(id);
    expect((await row()).last_activity_at.getTime()).toBe(now);
    expect((await row()).idle_expires_at.getTime()).toBe(now + 1_800_000);
    now += 1_799_999;
    expect(await other.validateSession(token)).toBe(id);
    now++;
    expect(await other.validateSession(token, true)).toBeNull();
  });

  it("acota la actividad a 12 h exactas", async () => {
    for (let i = 0; i < 24; i++) {
      now += 29 * 60_000;
      expect(await service.validateSession(token, true)).toBe(id);
    }
    now = initial + 43_200_000 - 1;
    expect(await other.validateSession(token, true)).toBe(id);
    expect((await row()).idle_expires_at.getTime()).toBe(initial + 43_200_000);
    now++;
    expect(await service.validateSession(token, true)).toBeNull();
  });

  it.each(["revocación", "deshabilitación"])(
    "observa %s entre conexiones y antes de renovar una lectura anterior",
    async (change) => {
      now += 60_000;
      const entered = barrier();
      const proceed = barrier();
      const transaction = database.transaction.bind(database);
      const spy = vi.spyOn(database, "transaction").mockImplementationOnce(async (operation) => {
        entered.resolve();
        await proceed.promise;
        return transaction(operation);
      });
      const pending = service.validateSession(token, true);
      const outcome = pending.then(
        (value) => ({ value }),
        (error) => ({ error }),
      );
      try {
        await Promise.race([
          entered.promise,
          outcome.then(() => {
            throw new Error("Renovación finalizó antes de la barrera.");
          }),
        ]);
        if (change === "revocación") {
          expect(await other.revokeSession(token)).toBe(true);
        } else {
          await second.query("UPDATE users SET status='disabled' WHERE id=$1", [id]);
        }
      } finally {
        proceed.resolve();
        spy.mockRestore();
        await outcome;
      }
      expect(await pending).toBeNull();
      expect(await service.validateSession(token)).toBeNull();
      expect((await row()).last_activity_at.getTime()).toBe(initial);
      if (change === "deshabilitación") expect(await service.createSession(id)).toBeNull();
      else expect(await other.revokeSession(token)).toBe(false);
    },
  );

  it.each(["revocación", "deshabilitación"])(
    "espera el bloqueo de %s y relee después de su COMMIT",
    async (change) =>
      raceConnections(async (a, b, _c, aPid, bPid) => {
        now += 60_000;
        const local = createSessionService(pinnedDatabase(a), {}, () => now);
        await b.query("BEGIN");
        let pending;
        let outcome;
        try {
          if (change === "revocación") {
            await b.query("UPDATE sessions SET revoked_at=$1 WHERE session_token_hash=$2", [
              new Date(now),
              digest(token),
            ]);
          } else {
            await b.query("UPDATE users SET status='disabled' WHERE id=$1", [id]);
          }
          pending = local.validateSession(token, true);
          outcome = track(pending);
          await blockedBy(aPid, bPid, outcome);
          await b.query("COMMIT");
          expect(await pending).toBeNull();
          expect(
            (
              await a.query("SELECT last_activity_at FROM sessions WHERE session_token_hash=$1", [
                digest(token),
              ])
            ).rows[0].last_activity_at.getTime(),
          ).toBe(initial);
        } finally {
          await b.query("ROLLBACK");
          await outcome?.settled;
        }
      }),
  );

  it.each(["revocación", "deshabilitación"])(
    "la renovación adquiere usuario y sesión antes de %s",
    async (change) =>
      raceConnections(async (a, b, c, aPid, bPid, cPid) => {
        now += 60_000;
        const local = createSessionService(pinnedDatabase(a), {}, () => now);
        const remote = createSessionService(pinnedDatabase(b), {}, () => now);
        await c.query("BEGIN");
        let renewal;
        let renewalOutcome;
        let mutationOutcome;
        try {
          await c.query("SELECT 1 FROM sessions WHERE session_token_hash=$1 FOR UPDATE", [
            digest(token),
          ]);
          renewal = local.validateSession(token, true);
          renewalOutcome = track(renewal);
          await blockedBy(aPid, cPid, renewalOutcome);
          const mutation =
            change === "revocación"
              ? remote.revokeSession(token)
              : b.query("UPDATE users SET status='disabled' WHERE id=$1", [id]);
          mutationOutcome = track(mutation);
          await blockedBy(bPid, aPid, mutationOutcome);
          await c.query("COMMIT");
          expect(await renewal).toBe(id);
          await mutation;
          expect(await local.validateSession(token, true)).toBeNull();
        } finally {
          await c.query("ROLLBACK");
          await Promise.all([renewalOutcome?.settled, mutationOutcome?.settled]);
        }
      }),
  );
});
