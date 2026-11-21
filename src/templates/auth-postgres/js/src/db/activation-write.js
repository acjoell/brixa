import { and, eq } from "drizzle-orm";

import { activationTokens, initialAdministrator, users } from "./schema.js";

export function withActivationWrite(database, operation) {
  return database.transaction(operation);
}

export async function hasActivationAuthority(tx, actorId) {
  // Bloquear la cuenta, cuya deshabilitación compite por la misma fila.
  // La asignación es de solo lectura para app_exec.
  const [actor] = await tx
    .select({ id: users.id })
    .from(users)
    .innerJoin(initialAdministrator, eq(initialAdministrator.userId, users.id))
    .where(and(eq(users.id, actorId), eq(users.status, "active")))
    .for("no key update", { of: users });
  return actor !== undefined;
}

export async function lockActivationUser(tx, userId) {
  const [user] = await tx
    .select({ status: users.status })
    .from(users)
    .where(eq(users.id, userId))
    .for("no key update");
  return user?.status;
}

export function readActivation(database, read) {
  return read(database);
}

export async function lockActivationToken(tx, userId, digest) {
  const [token] = await tx
    .select({ status: activationTokens.status, expiresAt: activationTokens.expiresAt })
    .from(activationTokens)
    .where(and(eq(activationTokens.userId, userId), eq(activationTokens.tokenDigest, digest)))
    .for("no key update");
  return token;
}
