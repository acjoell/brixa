import fs from "node:fs";
import path from "node:path";
import pg from "pg";
import { drizzle } from "drizzle-orm/node-postgres";
import { migrate } from "drizzle-orm/node-postgres/migrator";

const { Pool } = pg;

try {
  process.loadEnvFile();
} catch (err: unknown) {
  if ((err as NodeJS.ErrnoException).code !== "ENOENT") {
    throw err;
  }
}

function getDatabaseUrl(): string {
  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new Error("Variable de entorno DATABASE_URL no configurada.");
  }
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== "postgres:" && parsed.protocol !== "postgresql:") {
      throw new Error();
    }
  } catch {
    throw new Error(
      "Variable de entorno DATABASE_URL inválida. Debe ser una URL de conexión válida para PostgreSQL.",
    );
  }
  return url;
}

async function runMigrations(): Promise<void> {
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

  const url = getDatabaseUrl();
  const pool = new Pool({ connectionString: url });
  const db = drizzle(pool);

  try {
    console.log("Aplicando migraciones en la base de datos...");
    await migrate(db, { migrationsFolder });
    console.log("Migraciones aplicadas con éxito.");
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    const cause =
      err instanceof Error && err.cause instanceof Error ? err.cause.message : undefined;
    const detail = cause ? `\n  Causa: ${cause}` : "";
    throw new Error(`Error al aplicar migraciones: ${msg}${detail}`, { cause: err });
  } finally {
    await pool.end();
  }
}

/** Elimina credenciales de una cadena para que no aparezcan en logs. */
export function redact(text: string): string {
  return text.replace(/postgres(?:ql)?:\/\/[^/\s]*@/gi, "postgresql://***:***@");
}

runMigrations().catch((err: unknown) => {
  const raw = err instanceof Error ? err.message : String(err);
  console.error("Error al ejecutar migraciones:", redact(raw));
  process.exitCode = 1;
});
