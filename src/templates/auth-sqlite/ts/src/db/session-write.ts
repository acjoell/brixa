import type { db } from "./client.js";

export function withSessionWrite<T>(
  database: typeof db,
  _userId: string,
  _hash: string | null,
  operation: (tx: Pick<typeof db, "select" | "insert" | "update">) => Promise<T>,
) {
  // El cliente libSQL inicia por defecto una transacción de escritura (BEGIN IMMEDIATE).
  return database.transaction(operation);
}
