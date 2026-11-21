import { isInitialAdministrator } from "../auth/initial-administrator.js";

export function withSessionWrite(database, _userId, _hash, operation) {
  // El cliente libSQL inicia por defecto una transacción de escritura (BEGIN IMMEDIATE).
  return database.transaction(operation);
}

export const lockSession = () => {
  // BEGIN IMMEDIATE ya reserva la escritura de la BD.
};
export { isInitialAdministrator as lockInitialAdministrator };
