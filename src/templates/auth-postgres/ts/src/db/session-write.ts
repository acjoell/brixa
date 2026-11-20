import { eq } from "drizzle-orm";
import { users, sessions } from "./schema.js";
import type { db } from "./client.js";

export function withSessionWrite<T>(
  database: typeof db,
  userId: string,
  hash: string | null,
  operation: (tx: Pick<typeof db, "select" | "insert" | "update">) => Promise<T>,
) {
  return database.transaction(async (tx) => {
    await tx.select({ id: users.id }).from(users).where(eq(users.id, userId)).for("share");
    if (hash !== null) {
      await tx
        .select({ hash: sessions.sessionTokenHash })
        .from(sessions)
        .where(eq(sessions.sessionTokenHash, hash))
        .for("update");
    }
    return operation(tx);
  });
}
