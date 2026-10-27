import fs from "node:fs";
import path from "node:path";
import { createClient, type Client } from "@libsql/client";
import { drizzle, type LibSQLDatabase } from "drizzle-orm/libsql";
import * as schema from "./schema.js";

try {
  process.loadEnvFile();
} catch (err: unknown) {
  if ((err as NodeJS.ErrnoException).code !== "ENOENT") {
    throw err;
  }
}

function ensureDirectory(url: string): void {
  if (!url.startsWith("file:")) return;
  const filePath = url.slice("file:".length);
  if (filePath === ":memory:" || filePath === "") return;
  const dir = path.dirname(path.resolve(process.cwd(), filePath));
  if (dir && !fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

function getDatabaseUrl(): string {
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

export const client: Client = createClient({
  url: getDatabaseUrl(),
});

export const db: LibSQLDatabase<typeof schema> = drizzle(client, { schema });
