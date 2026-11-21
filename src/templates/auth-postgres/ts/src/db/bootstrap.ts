import pg from "pg";
import { drizzle } from "drizzle-orm/node-postgres";
import { BootstrapError, bootstrapInitialAdministrator } from "../auth/bootstrap.js";
import { connectionUrl } from "./connection-url.js";
import * as schema from "./schema.js";

export async function bootstrapPostgresAdministrator(
  credentials: Parameters<typeof bootstrapInitialAdministrator>[1],
  env = process.env,
) {
  const client = new pg.Pool({
    connectionString: connectionUrl("MIGRATION_DATABASE_URL", env),
    max: 1,
  });
  try {
    const { rows } = await client.query<{ allowed: boolean }>(
      "SELECT current_user = 'table_owner' AND session_user = current_user AS allowed",
    );
    if (rows[0]?.allowed !== true) throw new BootstrapError("BOOTSTRAP_FAILED");
    return await bootstrapInitialAdministrator(drizzle(client, { schema }), credentials);
  } catch (error) {
    if (error instanceof BootstrapError) throw error;
    throw new BootstrapError("BOOTSTRAP_FAILED");
  } finally {
    await client.end().catch(() => {});
  }
}
