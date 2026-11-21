-- psql -X -d <base dedicada> -v target=<base dedicada> -f ops/provision.sql
\set ON_ERROR_STOP on
BEGIN;
SET LOCAL search_path = pg_catalog;
SELECT set_config('brixa.target', :'target', true);
DO $provision$
DECLARE
  db_oid oid;
  marker text;
  role_name text;
  existing pg_roles%ROWTYPE;
  previous record;
BEGIN
  IF current_database() <> current_setting('brixa.target')
     OR current_database() IN ('template0', 'template1', 'postgres') THEN
    RAISE EXCEPTION 'Se requiere una base dedicada confirmada con target';
  END IF;
  SELECT oid INTO STRICT db_oid FROM pg_database WHERE datname = current_database();
  marker := 'Brixa Auth PostgreSQL / database oid ' || db_oid;
  FOR previous IN
    SELECT n.nspname, c.relname, pg_get_userbyid(c.relowner) AS owner_name
    FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE (n.nspname = 'public' AND c.relname IN ('users','sessions','audit_log_system','initial_administrator')
           OR n.nspname = 'drizzle') AND pg_get_userbyid(c.relowner) <> 'table_owner'
  LOOP
    RAISE EXCEPTION 'Revisar propietario anterior de %.%: %', previous.nspname, previous.relname, previous.owner_name;
  END LOOP;
  IF EXISTS (SELECT FROM pg_namespace WHERE nspname = 'drizzle' AND pg_get_userbyid(nspowner) <> 'table_owner') THEN
    RAISE EXCEPTION 'Revisar propietario anterior del esquema drizzle';
  END IF;
  FOREACH role_name IN ARRAY ARRAY['table_owner', 'app_exec'] LOOP
    SELECT * INTO existing FROM pg_roles WHERE rolname = role_name;
    IF FOUND THEN
      IF shobj_description(existing.oid, 'pg_authid') IS DISTINCT FROM marker OR
         NOT existing.rolcanlogin OR existing.rolsuper OR existing.rolcreaterole OR
         existing.rolcreatedb OR existing.rolreplication OR existing.rolbypassrls OR
         EXISTS (SELECT FROM pg_auth_members WHERE member = existing.oid) THEN
        RAISE EXCEPTION 'Rol preexistente incompatible: %. Revisar identidad, atributos y membresías.', role_name;
      END IF;
    ELSE
      EXECUTE format('CREATE ROLE %I LOGIN', role_name);
      EXECUTE format('COMMENT ON ROLE %I IS %L', role_name, marker);
    END IF;
  END LOOP;
  IF EXISTS (SELECT FROM pg_database WHERE oid = db_oid AND datdba = 'app_exec'::regrole)
     OR EXISTS (SELECT FROM pg_namespace WHERE nspname = 'public' AND nspowner = 'app_exec'::regrole) THEN
    RAISE EXCEPTION 'app_exec no puede ser propietario de la base o del esquema';
  END IF;
  EXECUTE format('REVOKE ALL ON DATABASE %I FROM PUBLIC, app_exec', current_database());
  EXECUTE format('GRANT CONNECT ON DATABASE %I TO table_owner, app_exec', current_database());
  EXECUTE format('GRANT CREATE ON DATABASE %I TO table_owner', current_database());
END
$provision$;
REVOKE ALL ON SCHEMA public FROM PUBLIC, app_exec;
GRANT USAGE, CREATE ON SCHEMA public TO table_owner;
GRANT USAGE ON SCHEMA public TO app_exec;
CREATE SCHEMA IF NOT EXISTS drizzle AUTHORIZATION table_owner;
REVOKE ALL ON SCHEMA drizzle FROM PUBLIC, app_exec;
COMMIT;
