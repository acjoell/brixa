import { eq } from "drizzle-orm";
import { lockAccount } from "../db/activation-write.js";
import type { db } from "../db/client.js";
import { initialAdministrator, users } from "../db/schema.js";
import { lockInitialAdministrator } from "../db/session-write.js";
import { Argon2SaturatedError } from "./argon2-limiter.js";
import { hashPassword } from "./password-crypto.js";
import { isPasswordWithinLimits } from "./password-limits.js";
import { revokeUserSessions } from "./sessions.js";
import { recordSystemAudit } from "./system-audit.js";

export class AdminRecoveryError extends Error {
  readonly code = "ADMIN_RECOVERY_FAILED";

  constructor() {
    super("ADMIN_RECOVERY_FAILED");
    this.name = "AdminRecoveryError";
  }
}

export async function recoverInitialAdministrator(
  database: typeof db,
  password: unknown,
  requestId: string,
): Promise<boolean> {
  if (password === "" || !isPasswordWithinLimits(password)) return false;
  try {
    const [candidate] = await database
      .select({ id: users.id })
      .from(initialAdministrator)
      .innerJoin(users, eq(initialAdministrator.userId, users.id))
      .where(eq(users.status, "active"));
    if (!candidate) return false;

    const passwordHash = await hashPassword(password);
    return await database.transaction(async (tx) => {
      const account = await lockAccount(tx, candidate.id);
      if (account?.status !== "active" || !(await lockInitialAdministrator(tx, candidate.id)))
        return false;

      const timestamp = new Date();
      await tx
        .update(users)
        .set({ passwordHash, updatedAt: timestamp })
        .where(eq(users.id, candidate.id));
      await revokeUserSessions(tx, candidate.id, timestamp);
      await recordSystemAudit(tx, {
        event: "initial_admin_password_recovered",
        actorId: null,
        requestId,
      });
      return true;
    });
  } catch (error) {
    if (error instanceof Argon2SaturatedError) throw error;
    throw new AdminRecoveryError();
  }
}
