import { and, eq } from "drizzle-orm";
import type { db } from "../db/client.js";
import { initialAdministrator, users } from "../db/schema.js";

export async function isInitialAdministrator(
  database: Pick<typeof db, "select">,
  userId: string,
): Promise<boolean> {
  const [assignment] = await database
    .select({ userId: initialAdministrator.userId })
    .from(initialAdministrator)
    .innerJoin(users, eq(users.id, initialAdministrator.userId))
    .where(and(eq(initialAdministrator.userId, userId), eq(users.status, "active")))
    .limit(1);
  return assignment !== undefined;
}
