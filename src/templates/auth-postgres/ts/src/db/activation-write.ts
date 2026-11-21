import { and, eq } from "drizzle-orm";
import type { db } from "./client.js";
import { activationTokens, initialAdministrator, users } from "./schema.js";

export type ActivationDatabase = typeof db;

type Write = Pick<typeof db, "select" | "insert" | "update" | "delete">;

export function withActivationWrite<T>(
  database: ActivationDatabase,
  operation: (tx: Write) => Promise<T>,
) {
  return database.transaction(operation);
}

export async function hasActivationAuthority(
  tx: Pick<Write, "select">,
  actorId: string,
): Promise<boolean> {
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

export async function lockActivationUser(tx: Pick<Write, "select">, userId: string) {
  const [user] = await tx
    .select({ status: users.status })
    .from(users)
    .where(eq(users.id, userId))
    .for("no key update");
  return user?.status;
}

export function readActivation<T>(
  database: ActivationDatabase,
  read: (connection: Pick<Write, "select">) => Promise<T>,
) {
  return read(database);
}

export async function lockActivationToken(
  tx: Pick<Write, "select">,
  userId: string,
  digest: string,
) {
  const [token] = await tx
    .select({ status: activationTokens.status, expiresAt: activationTokens.expiresAt })
    .from(activationTokens)
    .where(and(eq(activationTokens.userId, userId), eq(activationTokens.tokenDigest, digest)))
    .for("no key update");
  return token;
}
