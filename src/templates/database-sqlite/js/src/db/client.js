import fs from "node:fs";
import path from "node:path";
import { createClient } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";
import * as schema from "./schema.js";

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

export const client = createClient({
  url: getDatabaseUrl(),
});

export const db = drizzle(client, { schema });
