export function withSessionWrite(database, _userId, _hash, operation) {
  // El cliente libSQL inicia por defecto una transacción de escritura (BEGIN IMMEDIATE).
  return database.transaction(operation);
}
