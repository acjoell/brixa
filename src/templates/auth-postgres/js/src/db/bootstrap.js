import pg from "pg";
import { drizzle } from "drizzle-orm/node-postgres";
import { BootstrapError, bootstrapInitialAdministrator } from "../auth/bootstrap.js";

import { connectionUrl } from "./connection-url.js";
import * as schema from "./schema.js";

export async function withPostgresAdministrator(operation, env = process.env) {
  const client = new pg.Pool({
    connectionString: connectionUrl("MIGRATION_DATABASE_URL", env),
    max: 1,
  });
  try {
    const { rows } = await client.query(
      "SELECT current_user = 'table_owner' AND session_user = current_user AS allowed",
    );
    if (rows[0]?.allowed !== true) throw new Error("Se requiere la identidad table_owner.");
    return await operation(drizzle(client, { schema }));
  } finally {
    await client.end().catch(() => {});
  }
}

export async function bootstrapPostgresAdministrator(credentials, env = process.env) {
  try {
    return await withPostgresAdministrator(
      (database) => bootstrapInitialAdministrator(database, credentials),
      env,
    );
  } catch (error) {
    if (error instanceof BootstrapError) throw error;
    throw new BootstrapError("BOOTSTRAP_FAILED");
  }
}
