#!/usr/bin/env bash
# Desde la raíz, con las dependencias del backend PostgreSQL ya instaladas.
set -euo pipefail
mode=${1:-upgrade}
case "$mode" in fresh|upgrade|indirect) ;; *) exit 2 ;; esac
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
