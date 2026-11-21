import { eq } from "drizzle-orm";
import { users, sessions, initialAdministrator } from "./schema.js";
import type { db } from "./client.js";

export function withSessionWrite<T>(
  database: typeof db,
  userId: string,
  hash: string | null,
  operation: (tx: Pick<typeof db, "select" | "insert" | "update">) => Promise<T>,
) {
  return database.transaction(async (tx) => {
    await tx.select({ id: users.id }).from(users).where(eq(users.id, userId)).for("share");
    if (hash !== null) await lockSession(tx, hash);
    return operation(tx);
  });
}

export async function lockSession(connection: Pick<typeof db, "select">, hash: string) {
  await connection
    .select({ hash: sessions.sessionTokenHash })
    .from(sessions)
    .where(eq(sessions.sessionTokenHash, hash))
    .for("update");
}

export async function lockInitialAdministrator(tx: Pick<typeof db, "select">, userId: string) {
  const [assignment] = await tx
    .select({ userId: initialAdministrator.userId })
    .from(initialAdministrator)
    .where(eq(initialAdministrator.userId, userId))
    .for("share");
  return assignment !== undefined;
}
