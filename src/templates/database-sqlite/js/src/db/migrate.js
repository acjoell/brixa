import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createClient } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";
import { migrate } from "drizzle-orm/libsql/migrator";

try {
  process.loadEnvFile();
} catch (err) {
  if (err.code !== "ENOENT") {
    throw err;
  }
}

function ensureDirectory(url) {
  if (!url.startsWith("file:")) return;
  const filePath = url.slice("file:".length);
  if (filePath === ":memory:" || filePath === "") return;
  const dir = path.dirname(path.resolve(process.cwd(), filePath));
  if (dir && !fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

function getDatabaseUrl() {
  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new Error("Variable de entorno DATABASE_URL no configurada.");
  }
  if (url === ":memory:") {
    return url;
  }
  if (
    !url.startsWith("file:") &&
    !url.startsWith("libsql:") &&
    !url.startsWith("http:") &&
    !url.startsWith("https:")
  ) {
    throw new Error(
      "Variable de entorno DATABASE_URL inválida. Debe ser una URL de conexión válida para SQLite (ej. file:./data/app.db o :memory:).",
    );
  }
  ensureDirectory(url);
  return url;
}

async function runMigrations() {
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
  const client = createClient({ url });
  const db = drizzle(client);

  try {
    console.log("Aplicando migraciones en la base de datos...");
    await migrate(db, { migrationsFolder });
    console.log("Migraciones aplicadas con éxito.");
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    const cause =
      err instanceof Error && err.cause instanceof Error ? err.cause.message : undefined;
    const detail = cause ? `\n  Causa: ${cause}` : "";
    throw new Error(`Error al aplicar migraciones: ${msg}${detail}`, { cause: err });
  } finally {
    client.close();
  }
}

/** Elimina credenciales o tokens de una cadena para que no aparezcan en logs. */
export function redact(text) {
  return text.replace(/(?:authToken=|token=)[^&\s]+/gi, "token=***");
}

const isMain =
  process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1]);

if (isMain) {
  runMigrations().catch((err) => {
    const raw = err instanceof Error ? err.message : String(err);
    console.error("Error al ejecutar migraciones:", redact(raw));
    process.exitCode = 1;
  });
}
