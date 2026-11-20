import { connectionUrl } from "./connection-url.js";
import pg from "pg";
import { drizzle } from "drizzle-orm/node-postgres";
import * as schema from "./schema.js";

const { Pool } = pg;

try {
  process.loadEnvFile();
} catch (err) {
  if (err.code !== "ENOENT") {
    throw err;
  }
}

export const pool = new Pool({
  connectionString: connectionUrl("DATABASE_URL"),
});

export const db = drizzle(pool, { schema });

export async function checkRuntimeIdentity() {
  const { rows } = await pool.query(`
    SELECT current_user = 'app_exec' AND session_user = current_user
      AND NOT (rolsuper OR rolcreaterole OR rolcreatedb OR rolbypassrls OR rolreplication)
      AND NOT EXISTS (SELECT FROM pg_auth_members WHERE member = pg_roles.oid)
      AND NOT EXISTS (SELECT FROM pg_database WHERE datname = current_database() AND datdba = pg_roles.oid)
      AND NOT EXISTS (SELECT FROM pg_namespace WHERE nspname IN ('public','drizzle') AND nspowner = pg_roles.oid)
      AND NOT has_database_privilege(current_database(), 'CREATE,TEMP,CONNECT WITH GRANT OPTION')
      AND NOT has_schema_privilege('public', 'CREATE,USAGE WITH GRANT OPTION')
      AND NOT has_schema_privilege('drizzle', 'USAGE,CREATE')
      AND has_schema_privilege('public', 'USAGE')
      AND NOT EXISTS (
        SELECT FROM unnest(ARRAY['public.users','public.sessions','public.audit_log_system']) AS t(name)
        WHERE (SELECT relowner FROM pg_class WHERE oid = t.name::regclass) <> 'table_owner'::regrole
      )
      AND has_table_privilege('public.audit_log_system', 'INSERT')
      AND NOT has_table_privilege('public.audit_log_system', 'DELETE,TRUNCATE,TRIGGER,MAINTAIN,INSERT WITH GRANT OPTION')
      AND NOT has_any_column_privilege('public.audit_log_system', 'SELECT,UPDATE,REFERENCES,INSERT WITH GRANT OPTION')
      AND NOT EXISTS (
        SELECT FROM unnest(ARRAY['public.users','public.sessions']) AS t(name)
        WHERE NOT has_table_privilege(t.name, 'SELECT') OR NOT has_table_privilege(t.name, 'INSERT')
           OR NOT has_table_privilege(t.name, 'UPDATE')
           OR has_table_privilege(t.name, 'DELETE,TRUNCATE,TRIGGER,MAINTAIN')
           OR has_any_column_privilege(t.name, 'REFERENCES,SELECT WITH GRANT OPTION,INSERT WITH GRANT OPTION,UPDATE WITH GRANT OPTION')
      ) AS allowed
    FROM pg_roles WHERE rolname = current_user
  `);
  if (rows[0]?.allowed !== true) throw new Error("Identidad PostgreSQL de ejecución insegura.");

  // Una dependencia de vista se registra en la regla _RETURN, incluso entre vistas.
  const indirect = await pool.query(`
    WITH RECURSIVE audit_views(relid, owner_rights) AS (
      SELECT 'public.audit_log_system'::regclass::oid, false
      UNION
      SELECT r.ev_class, a.owner_rights OR NOT EXISTS (
        SELECT FROM pg_options_to_table(v.reloptions)
        WHERE option_name = 'security_invoker' AND option_value::boolean
      ) FROM audit_views a
      JOIN pg_depend d ON d.refclassid = 'pg_class'::regclass AND d.refobjid = a.relid
                      AND d.classid = 'pg_rewrite'::regclass
      JOIN pg_rewrite r ON r.oid = d.objid AND r.rulename = '_RETURN'
      JOIN pg_class v ON v.oid = r.ev_class AND v.relkind = 'v'
    ), privileged_routines AS (
      SELECT p.* FROM pg_proc p WHERE p.prosecdef AND p.oid >= 16384
        AND (has_table_privilege(p.proowner, 'public.audit_log_system', 'DELETE,TRUNCATE,TRIGGER')
          OR has_any_column_privilege(p.proowner, 'public.audit_log_system', 'UPDATE')
          OR pg_has_role(p.proowner, 'table_owner', 'USAGE'))
    )
    SELECT format('rutina %s', p.oid::regprocedure) AS object FROM privileged_routines p
      WHERE has_schema_privilege(p.pronamespace, 'USAGE') AND has_function_privilege(p.oid, 'EXECUTE')
        AND p.prorettype NOT IN ('trigger'::regtype, 'event_trigger'::regtype)
    UNION ALL
    SELECT format('trigger %I sobre %s', t.tgname, t.tgrelid::regclass)
      FROM pg_trigger t JOIN privileged_routines p ON p.oid = t.tgfoid
      WHERE NOT t.tgisinternal AND t.tgenabled <> 'D'
        AND t.tgrelid IN ('public.users'::regclass,'public.sessions'::regclass,'public.audit_log_system'::regclass)
        AND ((t.tgtype::int & 4) <> 0 OR ((t.tgtype::int & 16) <> 0 AND t.tgrelid <> 'public.audit_log_system'::regclass))
    UNION ALL
    SELECT format('vista %s', v.oid::regclass) FROM audit_views a
      JOIN pg_class v ON v.oid = a.relid AND v.relkind = 'v'
      WHERE a.owner_rights AND has_schema_privilege(v.relnamespace, 'USAGE')
        AND (((pg_relation_is_updatable(v.oid, true) & 4) <> 0 AND has_any_column_privilege(v.oid, 'UPDATE'))
          OR ((pg_relation_is_updatable(v.oid, true) & 16) <> 0 AND has_table_privilege(v.oid, 'DELETE')))
    ORDER BY object
  `);
  if (indirect.rows.length) {
    throw new Error(
      "Objetos PostgreSQL incompatibles con auditoría: " +
        indirect.rows.map((row) => row.object).join(", "),
    );
  }
}
