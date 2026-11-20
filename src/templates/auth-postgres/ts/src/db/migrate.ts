import fs from "node:fs";
import path from "node:path";
import { connectionUrl } from "./connection-url.js";
import pg from "pg";
import { drizzle } from "drizzle-orm/node-postgres";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import { redact } from "../redact.js";

const { Client } = pg;

async function runMigrations(): Promise<void> {
  const url = connectionUrl("MIGRATION_DATABASE_URL");
  const migrationsFolder = path.resolve(process.cwd(), "drizzle");
  if (!fs.existsSync(migrationsFolder)) {
    throw new Error(
      "No se encontró el directorio de migraciones (drizzle/). Define tablas en src/db/schema y ejecuta primero 'npm run db:generate'.",
    );
  }

  const entries = fs.readdirSync(migrationsFolder);
  const sqlFiles = entries.filter((file) => file.endsWith(".sql"));
  if (sqlFiles.length === 0) {
    console.log("No hay migraciones para aplicar en el directorio drizzle/.");
    return;
  }

  const client = new Client({ connectionString: url });
  await client.connect();

  try {
    console.log("Aplicando migraciones en la base de datos...");
    const { rows } = await client.query<{ allowed: boolean }>(
      "SELECT current_user = 'table_owner' AND session_user = current_user AS allowed",
    );
    if (rows[0]?.allowed !== true) throw new Error("Identidad PostgreSQL de migración insegura.");
    await migrate(drizzle(client), { migrationsFolder });
    console.log("Migraciones aplicadas con éxito.");
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    const cause =
      err instanceof Error && err.cause instanceof Error ? err.cause.message : undefined;
    const detail = cause ? `\n  Causa: ${cause}` : "";
    throw new Error(`Error al aplicar migraciones: ${msg}${detail}`, { cause: err });
  } finally {
    await client.end();
  }
}

runMigrations().catch((err: unknown) => {
  const raw = err instanceof Error ? err.message : String(err);
  console.error("Error al ejecutar migraciones:", redact(raw));
  process.exitCode = 1;
});
