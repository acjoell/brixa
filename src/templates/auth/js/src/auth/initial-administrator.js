import { and, eq } from "drizzle-orm";

import { initialAdministrator, users } from "../db/schema.js";

export async function isInitialAdministrator(database, userId) {
  const [assignment] = await database
    .select({ userId: initialAdministrator.userId })
    .from(initialAdministrator)
    .innerJoin(users, eq(users.id, initialAdministrator.userId))
    .where(and(eq(initialAdministrator.userId, userId), eq(users.status, "active")))
    .limit(1);
  return assignment !== undefined;
}
