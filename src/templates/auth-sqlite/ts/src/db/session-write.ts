import { isInitialAdministrator } from "../auth/initial-administrator.js";
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

export const lockSession: (connection: Pick<typeof db, "select">, hash: string) => void = () => {
  // BEGIN IMMEDIATE ya reserva la escritura de la BD.
};

export { isInitialAdministrator as lockInitialAdministrator };
