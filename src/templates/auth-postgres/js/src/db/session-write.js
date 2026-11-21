import { eq } from "drizzle-orm";
import { users, sessions, initialAdministrator } from "./schema.js";

export function withSessionWrite(database, userId, hash, operation) {
  return database.transaction(async (tx) => {
    await tx.select({ id: users.id }).from(users).where(eq(users.id, userId)).for("share");
    if (hash !== null) await lockSession(tx, hash);
    return operation(tx);
  });
}

export async function lockSession(connection, hash) {
  await connection
    .select({ hash: sessions.sessionTokenHash })
    .from(sessions)
    .where(eq(sessions.sessionTokenHash, hash))
    .for("update");
}

export async function lockInitialAdministrator(tx, userId) {
  const [assignment] = await tx
    .select({ userId: initialAdministrator.userId })
    .from(initialAdministrator)
    .where(eq(initialAdministrator.userId, userId))
    .for("share");
  return assignment !== undefined;
}
