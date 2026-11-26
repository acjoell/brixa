import { eq } from "drizzle-orm";
import { lockAccount } from "../db/activation-write.js";

import { initialAdministrator, users } from "../db/schema.js";
import { lockInitialAdministrator } from "../db/session-write.js";
import { Argon2SaturatedError } from "./argon2-limiter.js";
import { hashPassword } from "./password-crypto.js";
import { isPasswordWithinLimits } from "./password-limits.js";
import { acceptsNewPassword, parsePasswordPolicy } from "./password-policy.js";
import { revokeUserSessions } from "./sessions.js";
import { recordSystemAudit } from "./system-audit.js";

export class AdminRecoveryError extends Error {
  code = "ADMIN_RECOVERY_FAILED";

  constructor() {
    super("ADMIN_RECOVERY_FAILED");
    this.name = "AdminRecoveryError";
  }
}

export async function recoverInitialAdministrator(database, password, requestId) {
  if (password === "" || !isPasswordWithinLimits(password)) return false;
  const policy = parsePasswordPolicy();
  try {
    const [candidate] = await database
      .select({ id: users.id, email: users.canonicalIdentifier })
      .from(initialAdministrator)
      .innerJoin(users, eq(initialAdministrator.userId, users.id))
      .where(eq(users.status, "active"));
    if (!candidate || !acceptsNewPassword(password, candidate.email, policy)) return false;

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
