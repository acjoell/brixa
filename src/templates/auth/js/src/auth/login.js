import { eq } from "drizzle-orm";
import { lockAccount, readActivation, withActivationWrite } from "../db/activation-write.js";

import { users } from "../db/schema.js";
import { Argon2SaturatedError } from "./argon2-limiter.js";
import { emailSchema } from "./email.js";
import { createLoginAbuseService } from "./login-abuse.js";
import {
  hashPassword,
  needsPasswordRehash,
  PasswordCryptoError,
  prepareDummyVerification,
  verifyPassword,
} from "./password-crypto.js";
import { isPasswordWithinLimits } from "./password-limits.js";
import { parseSessionConfig } from "./session-config.js";
import { insertSession } from "./sessions.js";
import { recordSystemAudit, SystemAuditDenied, withSystemAudit } from "./system-audit.js";

export class LoginError extends Error {
  code = "LOGIN_FAILED";

  constructor() {
    super("LOGIN_FAILED");
    this.name = "LoginError";
  }
}

export class LoginRateLimitedError extends Error {
  code = "LOGIN_RATE_LIMITED";

  constructor(retryAfterMs) {
    super("LOGIN_RATE_LIMITED");
    this.retryAfterSeconds = Math.max(1, Math.ceil(retryAfterMs / 1000));
  }
}

export async function createLoginService(database, env = process.env, clock = Date.now) {
  const abuse = createLoginAbuseService(database, env);
  const config = parseSessionConfig(env);
  const dummy = await prepareDummyVerification();
  const writer = {
    transaction: (operation) => withActivationWrite(database, operation),
  };

  return async function login(email, password, requestId, ip) {
    const identifier = emailSchema.safeParse(email);
    let reservation;
    async function finish(failed) {
      if (
        !reservation ||
        !(await abuse.finishIdentifier(reservation, failed ? { requestId } : null))
      )
        throw new LoginError();
      reservation = undefined;
    }

    async function reject() {
      await finish(true);
      return null;
    }

    try {
      const ipAdmission = await abuse.consumeIp(ip);
      if (!ipAdmission.accepted) throw new LoginRateLimitedError(ipAdmission.retryAfterMs);
      await abuse.cleanupExpired();

      if (!identifier.success) {
        await writer.transaction((tx) =>
          recordSystemAudit(tx, { event: "login_failed", actorId: null, requestId }),
        );
        return null;
      }
      const admission = await abuse.reserveIdentifier(identifier.data);
      if (!admission.accepted) throw new LoginRateLimitedError(admission.retryAfterMs);
      reservation = admission.reservation;

      if (password === "" || !isPasswordWithinLimits(password)) return await reject();

      const [candidate] = await readActivation(database, (connection) =>
        connection
          .select({ id: users.id, status: users.status, passwordHash: users.passwordHash })
          .from(users)
          .where(eq(users.canonicalIdentifier, identifier.data)),
      );
      if (candidate?.status !== "active" || candidate.passwordHash === null) {
        await dummy(password);
        return await reject();
      }

      const phc = candidate.passwordHash;
      let verified;
      try {
        verified = await verifyPassword(password, phc);
      } catch (error) {
        if (!(error instanceof PasswordCryptoError) || error.code !== "CORRUPT_PHC") throw error;
        await dummy(password);
        return await reject();
      }
      if (!verified) return await reject();

      const rehash = needsPasswordRehash(phc, verified) ? await hashPassword(password) : null;
      await finish(false);
      const userId = candidate.id;
      return await withSystemAudit(
        writer,
        { event: "login_succeeded", actorId: userId, requestId },
        async (tx) => {
          const current = await lockAccount(tx, userId);
          if (current?.status !== "active" || current.passwordHash !== phc)
            throw new SystemAuditDenied("login_failed", null);

          const now = clock();
          if (rehash !== null) {
            await tx
              .update(users)
              .set({ passwordHash: rehash, updatedAt: new Date(now) })
              .where(eq(users.id, userId));
          }
          return insertSession(tx, userId, config, now);
        },
      );
    } catch (error) {
      if (error instanceof SystemAuditDenied && error.event === "login_failed") return null;
      if (reservation) {
        try {
          await abuse.finishIdentifier(reservation, null);
        } catch {
          // No session can be issued here. The database expiry recovers the reservation.
        }
      }
      if (error instanceof Argon2SaturatedError || error instanceof LoginRateLimitedError)
        throw error;
      throw new LoginError();
    }
  };
}
