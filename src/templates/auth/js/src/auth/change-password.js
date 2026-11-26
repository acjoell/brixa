import { and, eq } from "drizzle-orm";
import { lockAccount, readActivation, withActivationWrite } from "../db/activation-write.js";

import { users } from "../db/schema.js";
import { lockSession } from "../db/session-write.js";
import { Argon2SaturatedError } from "./argon2-limiter.js";
import { hashPassword, verifyPassword } from "./password-crypto.js";
import { isPasswordWithinLimits } from "./password-limits.js";
import { acceptsNewPassword, parsePasswordPolicy, PasswordPolicyError } from "./password-policy.js";
import { parseSessionConfig } from "./session-config.js";
import { isSessionValid, readSession, revokeUserSessions, tokenDigest } from "./sessions.js";
import { recordSystemAudit } from "./system-audit.js";

export class PasswordChangeError extends Error {
  code = "PASSWORD_CHANGE_FAILED";

  constructor() {
    super("PASSWORD_CHANGE_FAILED");
    this.name = "PasswordChangeError";
  }
}

export function createPasswordChangeService(database, env = process.env, clock = Date.now) {
  const config = parseSessionConfig(env);
  const policy = parsePasswordPolicy(env);

  return async function changePassword(token, currentPassword, newPassword, requestId) {
    const digest = tokenDigest(token);
    if (
      !digest ||
      currentPassword === "" ||
      newPassword === "" ||
      !isPasswordWithinLimits(currentPassword) ||
      !isPasswordWithinLimits(newPassword)
    )
      return false;

    try {
      const candidate = await readActivation(database, async (connection) => {
        const [session] = await readSession(connection, digest);
        if (!isSessionValid(config, session, clock())) return null;
        const [account] = await connection
          .select({ passwordHash: users.passwordHash, email: users.canonicalIdentifier })
          .from(users)
          .where(and(eq(users.id, session.userId), eq(users.status, "active")));
        return account?.passwordHash
          ? { userId: session.userId, phc: account.passwordHash, email: account.email }
          : null;
      });
      if (!candidate || !(await verifyPassword(currentPassword, candidate.phc))) return false;
      if (!acceptsNewPassword(newPassword, candidate.email, policy))
        throw new PasswordPolicyError();
      const replacement = await hashPassword(newPassword);

      const { userId } = candidate;
      return await withActivationWrite(database, async (tx) => {
        // Igual que login, tomar el bloqueo fuerte de la cuenta antes de bloquear sesiones.
        const account = await lockAccount(tx, userId);
        if (account?.status !== "active" || account.passwordHash !== candidate.phc) return false;
        await lockSession(tx, digest);
        const [session] = await readSession(tx, digest);
        const now = clock();
        if (!isSessionValid(config, session, now) || session.userId !== userId) return false;

        const timestamp = new Date(now);
        await tx
          .update(users)
          .set({ passwordHash: replacement, updatedAt: timestamp })
          .where(eq(users.id, userId));
        await revokeUserSessions(tx, userId, timestamp);
        await recordSystemAudit(tx, { event: "password_changed", actorId: userId, requestId });
        return true;
      });
    } catch (error) {
      if (error instanceof Argon2SaturatedError || error instanceof PasswordPolicyError)
        throw error;
      throw new PasswordChangeError();
    }
  };
}
