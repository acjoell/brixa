import { URL } from "node:url";
import { createClient } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";
import * as schema from "./schema.js";

export function requirePersistentSqliteUrl(url) {
  if (!url?.startsWith("file:")) throw new Error("Se requiere SQLite en archivo.");
  try {
    const location = new URL(url);
    const filename = decodeURIComponent(location.pathname);
    if (
      filename &&
      !filename.endsWith("/:memory:") &&
      location.searchParams.get("mode") !== "memory"
    )
      return url;
  } catch {
    // Do not expose the configured URL in an error.
  }
  throw new Error("Se requiere SQLite en archivo.");
}

export async function withSqliteAdministrator(operation) {
  try {
    process.loadEnvFile();
  } catch (error) {
    if (error.code !== "ENOENT") throw error;
  }

  const url = requirePersistentSqliteUrl(process.env.DATABASE_URL);
  const client = createClient({ url, concurrency: 1 });
  try {
    await client.execute("PRAGMA foreign_keys=ON");
    return await operation(drizzle(client, { schema }));
  } finally {
    client.close();
  }
}
