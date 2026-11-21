#!/usr/bin/env bash
# Desde la raíz, con las dependencias del backend PostgreSQL ya instaladas.
set -euo pipefail
mode=${1:-upgrade}
case "$mode" in fresh|upgrade|indirect|authority|bootstrap|bootstrap-tty|activation-fresh|activation-upgrade|managed-activation|account-activation|login|logout|change-password|admin-recovery) ;; *) exit 2 ;; esac
script_dir=$(dirname "$(realpath "$0")")
deps=$(realpath "${BRIXA_BACKEND_NODE_MODULES:?Directorio node_modules del backend generado}")
test -d "$deps/pg"
test -d "$deps/drizzle-orm"
work=$(mktemp -d)
container=
cleanup() {
  if [ -n "$container" ]; then docker rm -fv "$container" >/dev/null; fi
  rm -rf -- "$work"
}
trap cleanup EXIT
export DEST="$work/backend"
node --import tsx --input-type=module -e '
  import { generate } from "./src/generator/generate.ts";
  const r = await generate({outputDir: process.env.DEST, modality:"backend",language:"js",database:"postgres",auth:true});
  if (!r.ok) throw Error(JSON.stringify(r));'
cd "$DEST"
ln -s "$deps" node_modules
POSTGRES_PASSWORD=$(openssl rand -hex 24)
export POSTGRES_PASSWORD
container=$(docker run -d --pull=never --rm --tmpfs /var/lib/postgresql/data -p 127.0.0.1::5432 -e POSTGRES_PASSWORD -e POSTGRES_DB=app postgres:17.4-alpine)
for _ in {1..60}; do
  if docker exec "$container" pg_isready -h 127.0.0.1 -q; then break; fi
  sleep 0.5
done
port=$(docker port "$container" 5432/tcp | cut -d: -f2)
admin() { docker exec -i "$container" psql -X -v ON_ERROR_STOP=1 -U postgres -d app "$@"; }
provision() { admin -v target=app < ops/provision.sql >/dev/null; }
provision
owner_password=$(openssl rand -hex 24)
runtime_password=$(openssl rand -hex 24)
admin >/dev/null <<SQL
ALTER ROLE table_owner PASSWORD '$owner_password';
ALTER ROLE app_exec PASSWORD '$runtime_password';
SQL
provision
unset POSTGRES_PASSWORD
owner_url="postgresql://table_owner:$owner_password@127.0.0.1:$port/app"
export DATABASE_URL="postgresql://app_exec:$runtime_password@127.0.0.1:$port/app"
migrate() { MIGRATION_DATABASE_URL="$owner_url" node src/db/migrate.js; }
test "$(admin -Atc 'SHOW server_version_num')" = 170004
if [[ "$mode" == managed-activation || "$mode" == account-activation || "$mode" == login || "$mode" == logout || "$mode" == change-password || "$mode" == admin-recovery ]]; then
  if [[ "$mode" = managed-activation || "$mode" = admin-recovery ]]; then
    cp drizzle/meta/_journal.json "$work/journal"
    SCENARIO="$mode" node --input-type=module -e '
      import fs from "node:fs";
      const path="drizzle/meta/_journal.json", journal=JSON.parse(fs.readFileSync(path));
      journal.entries=journal.entries.slice(0,process.env.SCENARIO === "admin-recovery" ? 6 : 5); fs.writeFileSync(path,JSON.stringify(journal));'
  fi
  migrate
  BRIXA_TEST_OWNER_URL="$owner_url" FULL_JOURNAL="$work/journal" ACTIVATION_SCENARIO="$mode" node --input-type=module <<'JS'
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { copyFile } from "node:fs/promises";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import { checkRuntimeIdentity, pool } from "./src/db/client.js";
import { SystemAuditDenied, withSystemAudit } from "./src/auth/system-audit.js";
import { setImmediate } from "node:timers/promises";
import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";
import * as schema from "./src/db/schema.js";
import { checkAdminRecovery } from "./tests/admin-recovery-contract.js";
import { withPostgresAdministrator } from "./src/db/bootstrap.js";
import { checkPasswordChange } from "./tests/change-password-contract.js";
import { checkLogout } from "./tests/logout-contract.js";
import { checkLogin, pauseLoginLookup } from "./tests/login-contract.js";
import { checkAccountActivation, checkAccountActivationRaces } from "./tests/account-activation-contract.js";
import {
  checkManagedActivation,
  checkManagedActivationRace,
  holdActivationCommit,
  managedActivationFixture,
} from "./tests/managed-activation-contract.js";

const owner = new pg.Client({ connectionString: process.env.BRIXA_TEST_OWNER_URL });
const runtime = () => new pg.Client({
  connectionString: process.env.DATABASE_URL,
  lock_timeout: 5000,
  statement_timeout: 6000,
});
const first = runtime();
const second = runtime();
try {
  await Promise.all([owner.connect(), first.connect(), second.connect()]);
  const identity = async (connection, role) => {
    const row = (await connection.query("SELECT session_user, pg_backend_pid() AS pid")).rows[0];
    assert.equal(row.session_user, role);
    return row.pid;
  };
  await identity(owner, "table_owner");
  const firstPid = await identity(first, "app_exec");
  const secondPid = await identity(second, "app_exec");
  assert.notEqual(firstPid, secondPid);
  const database = drizzle(first, { schema });
  const other = drizzle(second, { schema });
  const privileged = drizzle(owner, { schema });
  if (process.env.ACTIVATION_SCENARIO === "admin-recovery") {
    const history = async () => (await owner.query("SELECT * FROM drizzle.__drizzle_migrations ORDER BY created_at")).rows;
    const permissions = async () => (await owner.query(
      "SELECT grantee, privilege_type FROM information_schema.table_privileges WHERE table_schema='public' AND table_name='audit_log_system' ORDER BY 1,2",
    )).rows;
    const oldHistory = await history();
    const oldPermissions = await permissions();
    assert.equal(oldHistory.length, 6);
    await withPostgresAdministrator((anotherOwner) => checkAdminRecovery(
      privileged, anotherOwner, database, database, (gate) => gate(other),
      async () => {
        await copyFile(process.env.FULL_JOURNAL, "drizzle/meta/_journal.json");
        const migrateAudit = () => migrate(privileged, { migrationsFolder: "drizzle" });
        await migrateAudit();
        const after = await history();
        assert.equal(after.length, 7);
        assert.deepEqual(after.slice(0, 6), oldHistory);
        assert.deepEqual(await permissions(), oldPermissions);
        await migrateAudit();
        assert.deepEqual(await history(), after);
        await checkRuntimeIdentity();
        for (const sql of [
          "UPDATE audit_log_system SET request_id='changed'", "DELETE FROM audit_log_system",
          "TRUNCATE audit_log_system", "ALTER TABLE audit_log_system ADD COLUMN escape text",
          "DROP TABLE audit_log_system",
        ]) await assert.rejects(first.query(sql), { code: "42501" });
      },
      (enabled) => owner.query(enabled
        ? "ALTER TABLE audit_log_system ADD CONSTRAINT reject_recovery CHECK (event <> 'initial_admin_password_recovered') NOT VALID"
        : "ALTER TABLE audit_log_system DROP CONSTRAINT reject_recovery"),
    ), { MIGRATION_DATABASE_URL: process.env.BRIXA_TEST_OWNER_URL });
    console.log("PostgreSQL 17.4: recuperación privilegiada, carreras y migración 0005 → 0006 comprobadas.");
  } else if (process.env.ACTIVATION_SCENARIO === "change-password") {
    await checkRuntimeIdentity();
    await checkPasswordChange(privileged, database, other, database, other, (connection, gate) => gate(connection), (enabled) =>
      owner.query(enabled
        ? "ALTER TABLE audit_log_system ADD CONSTRAINT reject_password_change CHECK (event <> 'password_changed') NOT VALID"
        : "ALTER TABLE audit_log_system DROP CONSTRAINT reject_password_change"),
    );
    console.log("PostgreSQL 17.4: cambio de contraseña comprobado con app_exec.");
  } else if (process.env.ACTIVATION_SCENARIO === "logout") {
    await checkRuntimeIdentity();
    await checkLogout(privileged, database, other, database, (enabled) =>
      owner.query(enabled
        ? "ALTER TABLE audit_log_system ADD CONSTRAINT reject_logout CHECK (event <> 'logout') NOT VALID"
        : "ALTER TABLE audit_log_system DROP CONSTRAINT reject_logout"),
    );
    console.log("PostgreSQL 17.4: validación y logout auditado comprobados con app_exec.");
  } else if (process.env.ACTIVATION_SCENARIO === "login") {
    await checkRuntimeIdentity();
    await checkLogin(privileged, database, database, other, pauseLoginLookup, (enabled) =>
      owner.query(enabled
        ? "ALTER TABLE audit_log_system ADD CONSTRAINT reject_login CHECK (event <> 'login_succeeded') NOT VALID"
        : "ALTER TABLE audit_log_system DROP CONSTRAINT reject_login"),
    );
    console.log("PostgreSQL 17.4: login con app_exec, auditoría, rollback y concurrencia comprobados.");
  } else {
  const fixture = await managedActivationFixture(privileged);
  const race = async (start, contend, onBlocked) => {
    const { gated, ready, release } = holdActivationCommit(database);
    const firstWork = Promise.allSettled([start(gated, gated)]);
    try {
      await Promise.race([
        ready,
        firstWork.then(() => { throw new Error("Primera transacción terminó antes de la barrera"); }),
      ]);
      let settled = false;
      const secondWork = Promise.allSettled([contend(other, other)]).then((result) => {
        settled = true;
        return result;
      });
      try {
        const deadline = Date.now() + 4000;
        while (true) {
          const { rows } = await owner.query(
            "SELECT state, wait_event_type, pg_blocking_pids(pid) AS blockers FROM pg_stat_activity WHERE pid=$1",
            [secondPid],
          );
          if (!settled && rows[0]?.blockers.includes(firstPid)) break;
          if (settled || Date.now() >= deadline) {
            throw new Error(JSON.stringify({ settled, activity: rows }));
          }
          await setImmediate();
        }
        onBlocked?.();
      } finally {
        release();
        await secondWork;
      }
      const [[winner], [contender]] = await Promise.all([firstWork, secondWork]);
      if (winner.status === "rejected") throw winner.reason;
      return [winner.value, contender];
    } finally {
      release();
      await firstWork;
    }
  };
  if (process.env.ACTIVATION_SCENARIO === "account-activation") {
    await checkRuntimeIdentity();
    await checkAccountActivation(fixture, database, (event, enabled) =>
      owner.query(enabled
        ? "ALTER TABLE audit_log_system ADD CONSTRAINT reject_consumption CHECK (event <> '" + event + "') NOT VALID"
        : "ALTER TABLE audit_log_system DROP CONSTRAINT reject_consumption"),
    );
    await checkAccountActivationRaces(fixture, database, race);
    console.log("PostgreSQL 17.4: consumo de activación, rollback y cinco carreras comprobados con app_exec.");
  } else {
    await owner.query("INSERT INTO audit_log_system VALUES ($1, 'logout', $2, 'before-0005', now())", [randomUUID(), fixture.admin]);
    const read = async (sql) => (await owner.query(sql)).rows;
    const historySql = "SELECT * FROM drizzle.__drizzle_migrations ORDER BY created_at";
    const rowsSql = "SELECT * FROM audit_log_system ORDER BY id";
    const permissionsSql = "SELECT oid, relowner, relacl FROM pg_class WHERE oid='public.audit_log_system'::regclass";
    const before = await read(rowsSql);
    const history = await read(historySql);
    const permissions = await read(permissionsSql);
    assert.equal(history.length, 5);
    await copyFile(process.env.FULL_JOURNAL, "drizzle/meta/_journal.json");
    const migrateAudit = () => migrate(privileged, { migrationsFolder: "drizzle" });
    await migrateAudit();
    assert.deepEqual(await read(rowsSql), before);
    assert.deepEqual(await read(permissionsSql), permissions);
    const after = await read(historySql);
    assert.equal(after.length, 7);
    assert.deepEqual(after.slice(0, 5), history);
    await migrateAudit();
    assert.deepEqual(await read(historySql), after);
    await checkRuntimeIdentity();
    for (const sql of [
      "SELECT * FROM audit_log_system",
      "UPDATE audit_log_system SET request_id='bad'",
      "DELETE FROM audit_log_system",
      "TRUNCATE audit_log_system",
      "ALTER TABLE audit_log_system DROP COLUMN event",
    ]) await assert.rejects(first.query(sql), { code: "42501" });
    await assert.rejects(
      first.query("INSERT INTO audit_log_system VALUES ($1, 'bogus', NULL, 'after-0005', now())", [randomUUID()]),
      { code: "23514", constraint: "audit_system_event" },
    );
    const denial = "platform_admin_access_denied";
    let called = false;
    await assert.rejects(withSystemAudit(database, { actorId: fixture.admin, requestId: "invalid-success", event: denial }, async () => {
      called = true;
    }), /transacción independiente/);
    assert.equal(called, false);
    const deniedInsert = randomUUID();
    await assert.rejects(withSystemAudit(database, { actorId: deniedInsert, requestId: "rolled-back" }, async (tx) => {
      const now = new Date();
      await tx.insert(schema.users).values({ id: deniedInsert, canonicalIdentifier: deniedInsert, createdAt: now, updatedAt: now });
      throw new SystemAuditDenied(denial);
    }), (error) => error.cause?.code === "23503");
    await fixture.audit("invalid-success", []);
    await fixture.audit("rolled-back", []);
    assert(!(await fixture.accounts()).some(({ id }) => id === deniedInsert));
    assert.deepEqual(await read(rowsSql), before);

    await checkManagedActivation(fixture, database, (event, enabled) =>
      owner.query(enabled
        ? "ALTER TABLE audit_log_system ADD CONSTRAINT reject_audit CHECK (event <> '" + event + "') NOT VALID"
        : "ALTER TABLE audit_log_system DROP CONSTRAINT reject_audit"),
    );
    await checkManagedActivationRace(fixture, race);
    console.log("PostgreSQL 17.4: flujo, rollback y carreras de activación comprobados con app_exec.");
  }
  }
} finally {
  await Promise.all([first.end(), second.end(), owner.end(), pool.end()]);
}
JS
  if [ "$mode" = admin-recovery ]; then
    BRIXA_TEST_BOOTSTRAP_OWNER_URL="$owner_url" python3 "$script_dir/test-bootstrap-tty.py" "$DEST" postgres recover
  fi
  exit 0
fi
if [[ "$mode" == activation-* ]]; then
  cp drizzle/meta/_journal.json "$work/journal"
  if [ "$mode" = activation-upgrade ]; then
    node --input-type=module -e '
      import fs from "node:fs";
      const file = "drizzle/meta/_journal.json";
      const journal = JSON.parse(fs.readFileSync(file));
      journal.entries = journal.entries.slice(0, 4);
      fs.writeFileSync(file, JSON.stringify(journal));'
    migrate
  fi
  BRIXA_TEST_OWNER_URL="$owner_url" FULL_JOURNAL="$work/journal" SCENARIO="$mode" node --input-type=module <<'JS'
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { copyFile } from "node:fs/promises";
import { drizzle } from "drizzle-orm/node-postgres";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import pg from "pg";
import { activationTokenDigest, generateActivationToken } from "./src/auth/activation-token.js";
import { checkRuntimeIdentity, pool } from "./src/db/client.js";

const owner = new pg.Pool({ connectionString: process.env.BRIXA_TEST_OWNER_URL });
try {
  const user = randomUUID();
  const userSql = "INSERT INTO users(id,canonical_identifier,created_at,updated_at) VALUES ($1,$1::uuid::text,now(),now())";
  const read = async (table) => (await owner.query("SELECT * FROM " + table + " ORDER BY 1")).rows;
  const tables = ["users", "sessions", "audit_log_system", "initial_administrator"];
  const journal = "drizzle.__drizzle_migrations";
  const upgrade = process.env.SCENARIO === "activation-upgrade";
  if (upgrade) {
    await owner.query(userSql, [user]);
    await owner.query("INSERT INTO sessions VALUES (repeat('a',64),$1,now(),now(),now(),NULL)", [user]);
    await owner.query("INSERT INTO audit_log_system VALUES ($1,'bootstrap',$2,'activation-test',now())", [randomUUID(), user]);
    await owner.query("INSERT INTO initial_administrator VALUES ('initial',$1)", [user]);
  }
  const before = upgrade ? await Promise.all(tables.map(read)) : [[], [], [], []];
  const history = upgrade ? await read(journal) : [];
  if (upgrade) assert.equal(history.length, 4);
  await copyFile(process.env.FULL_JOURNAL, "drizzle/meta/_journal.json");
  const run = () => migrate(drizzle(owner), { migrationsFolder: "drizzle" });
  await run();
  const after = await read(journal);
  assert.equal(after.length, 7);
  assert.deepEqual(after.slice(0, history.length), history);
  await run();
  assert.deepEqual(await read(journal), after);
  assert.deepEqual(await Promise.all(tables.map(read)), before);
  if (!upgrade) await owner.query(userSql, [user]);

  await checkRuntimeIdentity();
  assert.equal((await pool.query("SELECT session_user")).rows[0].session_user, "app_exec");
  const token = generateActivationToken();
  const digest = activationTokenDigest(token);
  const issued = new Date("2026-11-21T12:00:00Z");
  const expires = new Date("2026-11-22T12:00:00Z");
  const insert = (overrides = {}) => {
    const { hash, id, status, issuedAt, expiresAt, closed } = {
      hash: digest, id: user, status: "open", issuedAt: issued, expiresAt: expires, closed: null, ...overrides,
    };
    return pool.query("INSERT INTO activation_tokens VALUES ($1,$2,$3,$4,$5,$6)", [hash,id,status,issuedAt,expiresAt,closed]);
  };
  const rejects = (promise, code) => assert.rejects(promise, { code });
  await insert();
  assert.deepEqual((await pool.query("SELECT * FROM activation_tokens")).rows, [{
    token_digest: digest, user_id: user, status: "open", issued_at: issued, expires_at: expires, closed_at: null,
  }]);
  const other = "b".repeat(64);
  await rejects(insert({ hash: other }), "23505");
  await rejects(insert({ status: "revoked", closed: issued }), "23505");
  assert.equal((await pool.query("UPDATE activation_tokens SET status='revoked', closed_at=issued_at WHERE token_digest=$1", [digest])).rowCount, 1);
  await insert({ hash: other });
  await insert({ hash: "c".repeat(64), status: "expired", closed: expires });
  await insert({ hash: "d".repeat(64), status: "consumed", closed: issued });
  for (const values of [
    { hash: token },
    { hash: other.toUpperCase() },
    { hash: other + "\n" },
    { expiresAt: issued },
    { status: "open", closed: issued },
    { status: "revoked", closed: null },
    { status: "expired", closed: issued },
    { status: "consumed", closed: expires },
    { status: "bogus", closed: issued },
    { status: "revoked", closed: new Date(issued.getTime() - 1) },
  ]) await rejects(insert({ hash: "e".repeat(64), status: "revoked", closed: issued, ...values }), "23514");
  await rejects(insert({ hash: "e".repeat(64), id: randomUUID(), status: "revoked", closed: issued }), "23503");
  for (const sql of [
    "DELETE FROM activation_tokens",
    "TRUNCATE activation_tokens",
    "ALTER TABLE activation_tokens DROP COLUMN status",
    "UPDATE audit_log_system SET request_id=request_id",
    "DELETE FROM audit_log_system",
    "UPDATE initial_administrator SET user_id=user_id",
  ]) await rejects(pool.query(sql), "42501");
  assert.equal((await read("activation_tokens")).length, 4);
  assert.deepEqual(await read("audit_log_system"), before[2]);
  await owner.query("GRANT DELETE ON activation_tokens TO PUBLIC");
  await assert.rejects(checkRuntimeIdentity(), /insegura/);
} finally {
  await Promise.all([owner.end(), pool.end()]);
}
JS
  echo "PostgreSQL 17.4: $mode, historial, restricciones y privilegios efectivos comprobados."
  exit 0
fi
if [ "$mode" = bootstrap-tty ]; then
  migrate
  BRIXA_TEST_BOOTSTRAP_OWNER_URL="$owner_url" python3 "$script_dir/test-bootstrap-tty.py" "$DEST" postgres
  exit 0
fi
if [ "$mode" = bootstrap ]; then
  migrate
  BRIXA_TEST_OWNER_URL="$owner_url" node --input-type=module <<'JS'
import assert from "node:assert/strict";
import pg from "pg";
import { drizzle } from "drizzle-orm/node-postgres";
import { checkRuntimeIdentity, pool } from "./src/db/client.js";
import { bootstrapPostgresAdministrator } from "./src/db/bootstrap.js";
import * as schema from "./src/db/schema.js";
import { checkBootstrap, checkBootstrapRace } from "./tests/bootstrap-contract.js";

const env = { MIGRATION_DATABASE_URL: process.env.BRIXA_TEST_OWNER_URL };
const owner = new pg.Pool({ connectionString: env.MIGRATION_DATABASE_URL, max: 1 });
const other = new pg.Pool({ connectionString: env.MIGRATION_DATABASE_URL, max: 1 });
try {
  await checkRuntimeIdentity();
  const credentials = { email: "bootstrap@example.test", password: "test-only password" };
  await assert.rejects(
    bootstrapPostgresAdministrator(credentials, { DATABASE_URL: process.env.DATABASE_URL }),
    /MIGRATION_DATABASE_URL no configurada/,
  );
  await assert.rejects(
    bootstrapPostgresAdministrator(credentials, { MIGRATION_DATABASE_URL: process.env.DATABASE_URL }),
    /Identidad o URL PostgreSQL inválida/,
  );
  const database = drizzle(owner, { schema });
  await checkBootstrap(
    database,
    (enabled) => owner.query(enabled
      ? "ALTER TABLE audit_log_system ADD CONSTRAINT bootstrap_test_failure CHECK (event <> 'bootstrap')"
      : "ALTER TABLE audit_log_system DROP CONSTRAINT bootstrap_test_failure"),
    (input) => bootstrapPostgresAdministrator(input, env),
  );
  await assert.rejects(pool.query("UPDATE audit_log_system SET request_id=request_id"), { code: "42501" });
  await assert.rejects(pool.query("DELETE FROM audit_log_system"), { code: "42501" });

  // Solo la base efímera del contenedor. Cada escenario comienza con un historial vacío.
  await owner.query("TRUNCATE initial_administrator, sessions, audit_log_system, users");
  await checkBootstrapRace(database, drizzle(other, { schema }));
} finally {
  await Promise.all([owner.end(), other.end(), pool.end()]);
}
JS
  echo 'PostgreSQL 17.4: bootstrap, rollback, separación de credenciales y carrera comprobados.'
  exit 0
fi
if [ "$mode" = authority ]; then
  cp drizzle/meta/_journal.json "$work/journal"
  node --input-type=module -e '
    import fs from "node:fs";
    const path="drizzle/meta/_journal.json", journal=JSON.parse(fs.readFileSync(path));
    journal.entries=journal.entries.slice(0,3); fs.writeFileSync(path,JSON.stringify(journal));'
  migrate
  BRIXA_TEST_OWNER_URL="$owner_url" FULL_JOURNAL="$work/journal" node --input-type=module <<'JS'
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { copyFile } from "node:fs/promises";
import pg from "pg";
import { checkRuntimeIdentity, db, pool } from "./src/db/client.js";
import { isInitialAdministrator } from "./src/auth/initial-administrator.js";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import { drizzle } from "drizzle-orm/node-postgres";

const owner = new pg.Pool({ connectionString: process.env.BRIXA_TEST_OWNER_URL });
try {
  const user = randomUUID();
  const admin = randomUUID();
  await owner.query(
    "INSERT INTO users(id,canonical_identifier,status,created_at,updated_at) VALUES ($1,'user','active',now(),now()), ($2,'admin','active',now(),now())",
    [user, admin],
  );
  await owner.query(
    "INSERT INTO sessions(session_token_hash,user_id,created_at,last_activity_at,idle_expires_at) VALUES (repeat('a',64),$1,now(),now(),now())",
    [user],
  );
  await pool.query(
    "INSERT INTO audit_log_system(id,event,actor_id,request_id,created_at) VALUES ($1,'logout',$2,'authority-test',now())",
    [randomUUID(), user],
  );
  const read = async (table) => (await owner.query("SELECT * FROM " + table + " ORDER BY 1")).rows;
  const tables = ["users", "sessions", "audit_log_system"];
  const before = await Promise.all(tables.map(read));
  const journal = "drizzle.__drizzle_migrations";
  const history = await read(journal);
  assert.equal(history.length, 3);
  await copyFile(process.env.FULL_JOURNAL, "drizzle/meta/_journal.json");
  await migrate(drizzle(owner), { migrationsFolder: "drizzle" });
  assert.deepEqual(await Promise.all(tables.map(read)), before);
  const after = await read(journal);
  assert.equal(after.length, 7);
  assert.deepEqual(after.slice(0, 3), history);
  assert.deepEqual(await read("initial_administrator"), []);
  await checkRuntimeIdentity();
  const insert = "INSERT INTO initial_administrator(singleton,user_id) VALUES ($1,$2)";
  const rejects = (promise, code) => assert.rejects(promise, { code });
  await rejects(owner.query(insert, [null, admin]), "23502");
  await rejects(owner.query(insert, ["other", admin]), "23514");
  await rejects(owner.query(insert, ["initial", randomUUID()]), "23503");
  await rejects(pool.query(insert, ["initial", admin]), "42501");
  await owner.query(insert, ["initial", admin]);
  await rejects(owner.query(insert, ["initial", user]), "23505");
  await rejects(owner.query("DELETE FROM users WHERE id=$1", [admin]), "23503");
  assert.equal(await isInitialAdministrator(db, admin), true);
  assert.equal(await isInitialAdministrator(db, user), false);
  for (const sql of [
    "UPDATE initial_administrator SET user_id=user_id",
    "DELETE FROM initial_administrator",
    "TRUNCATE initial_administrator",
    "UPDATE audit_log_system SET request_id=request_id",
    "DELETE FROM audit_log_system",
  ]) await rejects(pool.query(sql), "42501");
  await owner.query("GRANT UPDATE (user_id) ON initial_administrator TO PUBLIC");
  await assert.rejects(checkRuntimeIdentity(), /insegura/);
  await owner.query("REVOKE UPDATE (user_id) ON initial_administrator FROM PUBLIC");
  await owner.query("CREATE VIEW authority_fixture AS SELECT * FROM initial_administrator");
  await owner.query("GRANT INSERT ON authority_fixture TO app_exec");
  await assert.rejects(checkRuntimeIdentity(), /vista authority_fixture/);
  await owner.query("DROP VIEW authority_fixture");
  await checkRuntimeIdentity();
  assert.deepEqual(await read("audit_log_system"), before[2]);
} finally {
  await Promise.all([owner.end(), pool.end()]);
}
JS
  echo 'PostgreSQL 17.4: actualización desde 0002, integridad, autoridad y privilegios comprobados.'
  exit 0
fi
if [ "$mode" = fresh ]; then
  migrate
  migrate
  provision
  node --input-type=module -e 'import {checkRuntimeIdentity,pool} from "./src/db/client.js"; try { await checkRuntimeIdentity(); } finally { await pool.end(); }'
  echo 'PostgreSQL 17.4: instalación completa desde vacío y repetición comprobadas.'
  exit 0
fi
# Pausa en 0001 para verificar el upgrade con filas preexistentes.
cp drizzle/meta/_journal.json "$work/journal"
node --input-type=module -e '
  import fs from "node:fs";
  const path="drizzle/meta/_journal.json", j=JSON.parse(fs.readFileSync(path));
  j.entries=j.entries.slice(0,2); fs.writeFileSync(path,JSON.stringify(j));'
migrate
owner() { PGPASSWORD="$owner_password" docker exec -i -e PGPASSWORD "$container" psql -XAt -v ON_ERROR_STOP=1 -h 127.0.0.1 -U table_owner -d app "$@"; }
if [ "$mode" = indirect ]; then
  admin <<'SQL'
CREATE ROLE prior_grantor;
SET ROLE table_owner;
GRANT UPDATE (request_id) ON audit_log_system TO PUBLIC;
GRANT UPDATE (event) ON audit_log_system TO prior_grantor WITH GRANT OPTION;
RESET ROLE;
GRANT USAGE ON SCHEMA public TO prior_grantor;
SET ROLE prior_grantor;
GRANT UPDATE (event) ON audit_log_system TO app_exec;
SQL
  cp "$work/journal" drizzle/meta/_journal.json
  if migrate >"$work/migration" 2>&1; then exit 1; fi
  grep -Fq 'ACL residual en public.audit_log_system.event' "$work/migration"
  test "$(owner -c 'SELECT count(*) FROM drizzle.__drizzle_migrations')" = 2
  admin -c 'SET ROLE prior_grantor; REVOKE UPDATE(event) ON public.audit_log_system FROM app_exec'
  migrate
  test "$(owner -c "SELECT has_any_column_privilege('app_exec','public.audit_log_system','UPDATE')")" = f
  check_objects() {
    EXPECT_OBJECT="$1" node --input-type=module <<'JS'
import assert from "node:assert/strict";
import {pool,checkRuntimeIdentity} from "./src/db/client.js";
try {
  if (process.env.EXPECT_OBJECT) {
    await assert.rejects(checkRuntimeIdentity(), error => error.message.includes(process.env.EXPECT_OBJECT));
  } else {
    await checkRuntimeIdentity();
  }
} finally { await pool.end(); }
JS
  }
  check_objects ''
  owner <<'SQL'
CREATE FUNCTION public.audit_fixture() RETURNS integer LANGUAGE sql SECURITY DEFINER SET search_path = pg_catalog AS 'SELECT 1';
SQL
  check_objects 'rutina audit_fixture()'
  owner -c 'REVOKE EXECUTE ON FUNCTION public.audit_fixture() FROM PUBLIC'
  check_objects ''
  owner -c 'CREATE VIEW public.audit_fixture_view AS SELECT request_id FROM public.audit_log_system; GRANT UPDATE(request_id) ON public.audit_fixture_view TO app_exec'
  check_objects 'vista audit_fixture_view'
  owner -c 'ALTER VIEW public.audit_fixture_view SET (security_invoker=true)'
  check_objects ''
  owner <<'SQL'
CREATE FUNCTION public.fixture_trigger() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog AS 'BEGIN RETURN NEW; END';
REVOKE EXECUTE ON FUNCTION public.fixture_trigger() FROM PUBLIC;
CREATE TRIGGER auth_fixture BEFORE UPDATE ON public.users FOR EACH ROW EXECUTE FUNCTION public.fixture_trigger();
SQL
  check_objects 'trigger auth_fixture sobre users'
  owner -c 'DROP TRIGGER auth_fixture ON public.users'
  check_objects ''
  echo 'PostgreSQL 17.4: ACL por otorgante, rollback, arranque limpio, rutina, vista y trigger comprobados.'
  exit 0
fi
owner <<'SQL'
INSERT INTO users(id,canonical_identifier,status,created_at,updated_at) VALUES(gen_random_uuid(),'prior','active',now(),now());
INSERT INTO sessions SELECT repeat('1',64),id,now(),now(),now()+interval '30 minutes',NULL FROM users;
INSERT INTO audit_log_system VALUES(gen_random_uuid(),'logout',NULL,'prior',now());
SQL
baseline() { owner -c 'SELECT row_to_json(u),row_to_json(s),row_to_json(a) FROM users u,sessions s,audit_log_system a'; }
before=$(baseline)
admin -c 'ALTER TABLE users OWNER TO postgres'
if provision 2>"$work/conflict"; then exit 1; fi
grep -Fq 'public.users: postgres' "$work/conflict"
admin -c 'ALTER TABLE users OWNER TO table_owner'
provision
cp "$work/journal" drizzle/meta/_journal.json
migrate
migrate
test "$(baseline)" = "$before"
test "$(owner -c 'SELECT count(*) FROM drizzle.__drizzle_migrations')" = 3
node --input-type=module <<'JS'
import assert from "node:assert/strict";
import {pool,checkRuntimeIdentity} from "./src/db/client.js";
try {
  await checkRuntimeIdentity();
  assert.equal((await pool.query("SELECT session_user")).rows[0].session_user,"app_exec");
  await pool.query("INSERT INTO users(id,canonical_identifier,status,created_at,updated_at) VALUES(gen_random_uuid(),'runtime','active',now(),now())");
  await pool.query("INSERT INTO sessions SELECT repeat('2',64),id,now(),now(),now()+interval '30 minutes',NULL FROM users WHERE canonical_identifier='runtime'");
  assert.equal((await pool.query("UPDATE sessions SET revoked_at=now() WHERE session_token_hash=repeat('2',64)")).rowCount,1);
  assert.equal((await pool.query("UPDATE users SET status='disabled' WHERE canonical_identifier='runtime'")).rowCount,1);
  await pool.query("INSERT INTO audit_log_system VALUES(gen_random_uuid(),'login_failed',NULL,'runtime',now())");
} finally { await pool.end(); }
JS
audit() { owner -c 'SELECT row_to_json(a) FROM audit_log_system a ORDER BY id'; }
original=$(audit)
for sql in "SELECT * FROM audit_log_system" "UPDATE audit_log_system SET request_id='changed'" "DELETE FROM audit_log_system" "TRUNCATE audit_log_system" "ALTER TABLE audit_log_system ADD extra text" "DROP TABLE audit_log_system"; do
  DENIED_SQL="$sql" node --input-type=module <<'JS'
import assert from "node:assert/strict";
import {pool} from "./src/db/client.js";
try { await assert.rejects(pool.query(process.env.DENIED_SQL), {code:"42501"}); }
finally { await pool.end(); }
JS
  test "$(audit)" = "$original"
done
reject_start() {
  node --input-type=module <<'JS'
import assert from "node:assert/strict";
import {pool,checkRuntimeIdentity} from "./src/db/client.js";
try { await assert.rejects(checkRuntimeIdentity(), /insegura/); }
finally { await pool.end(); }
JS
}
admin -c 'GRANT UPDATE (request_id) ON audit_log_system TO PUBLIC'
reject_start
admin -c 'REVOKE UPDATE (request_id) ON audit_log_system FROM PUBLIC'
admin -c 'GRANT table_owner TO app_exec WITH INHERIT FALSE'
reject_start
admin -c 'REVOKE table_owner FROM app_exec'
admin -c 'ALTER ROLE app_exec SUPERUSER'
reject_start
admin -c 'ALTER ROLE app_exec NOSUPERUSER'
echo 'PostgreSQL 17.4: migración incremental, identidad, DML, 42501 e integridad comprobados.'
