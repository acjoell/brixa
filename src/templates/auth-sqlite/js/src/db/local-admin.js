import { URL } from "node:url";
import { createClient } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";
import * as schema from "./schema.js";

export async function withSqliteAdministrator(operation) {
  try {
    process.loadEnvFile();
  } catch (error) {
    if (error.code !== "ENOENT") throw error;
  }

  const url = process.env.DATABASE_URL;
  if (!url?.startsWith("file:")) throw new Error("Se requiere SQLite en archivo.");
  const location = new URL(url);
  const filename = decodeURIComponent(location.pathname);
  if (
    !filename ||
    filename.endsWith("/:memory:") ||
    location.searchParams.get("mode") === "memory"
  ) {
    throw new Error("Se requiere SQLite en archivo.");
  }

  const client = createClient({ url, concurrency: 1 });
  try {
    await client.execute("PRAGMA foreign_keys=ON");
    return await operation(drizzle(client, { schema }));
  } finally {
    client.close();
  }
}
