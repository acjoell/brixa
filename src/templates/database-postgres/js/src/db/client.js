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
  try {
    const { rows } = await pool.query(`
      SELECT current_user = 'app_exec' AND session_user = current_user
        AND NOT (rolsuper OR rolcreaterole OR rolcreatedb OR rolbypassrls OR rolreplication)
        AND NOT EXISTS (SELECT FROM pg_auth_members WHERE member = pg_roles.oid)
        AND NOT EXISTS (SELECT FROM pg_database WHERE datname = current_database() AND datdba = pg_roles.oid)
        AND NOT has_database_privilege(current_database(), 'CREATE,TEMP,CONNECT WITH GRANT OPTION')
        AND has_schema_privilege('public', 'USAGE')
        AND NOT has_schema_privilege('drizzle', 'USAGE,CREATE')
        AND NOT EXISTS (
          SELECT FROM pg_namespace n
          WHERE n.nspname NOT IN ('pg_catalog','information_schema')
            AND (n.nspowner = pg_roles.oid OR has_schema_privilege(n.oid, 'CREATE,USAGE WITH GRANT OPTION'))
        )
        AND NOT EXISTS (
          SELECT FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
          WHERE n.nspname NOT IN ('pg_catalog','information_schema')
            AND (c.relowner = pg_roles.oid OR
              (c.relkind IN ('r','p','f') AND has_table_privilege(c.oid, 'TRUNCATE,TRIGGER,MAINTAIN')))
        )
        AND NOT EXISTS (SELECT FROM pg_proc WHERE proowner = pg_roles.oid)
        AS allowed
      FROM pg_roles WHERE rolname = current_user
    `);
    if (rows[0]?.allowed === true) return;
  } catch {
    // El error del driver puede contener datos de conexión.
  }
  throw new Error("Identidad PostgreSQL de ejecución insegura o conexión no disponible.");
}
