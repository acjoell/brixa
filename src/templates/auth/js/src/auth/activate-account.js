import { and, eq, gt, isNull, sql } from "drizzle-orm";
import {
  lockActivationToken,
  lockActivationUser,
  readActivation,
  withActivationWrite,
} from "../db/activation-write.js";

import { activationTokens, users } from "../db/schema.js";
import { activationTokenDigest } from "./activation-token.js";
import { Argon2SaturatedError } from "./argon2-limiter.js";
import { hashPassword } from "./password-crypto.js";
import { isPasswordWithinLimits } from "./password-limits.js";
import { recordSystemAudit, withSystemAudit } from "./system-audit.js";

export class AccountActivationError extends Error {
  code = "ACTIVATION_FAILED";

  constructor() {
    super("ACTIVATION_FAILED");
    this.name = "AccountActivationError";
  }
}

export function createAccountActivationService(database, clock = Date.now) {
  // requestId es correlación de confianza del llamador. Aún no existe sesión.
  return async function activateAccount(token, password, requestId) {
    const digest = activationTokenDigest(token);
    if (digest === null) return false;

    try {
      const [candidate] = await readActivation(database, (connection) =>
        connection
          .select({
            userId: activationTokens.userId,
            status: activationTokens.status,
            expiresAt: activationTokens.expiresAt,
            eligible:
              sql`${users.status} = 'pending_activation' AND ${users.passwordHash} IS NULL`.mapWith(
                Boolean,
              ),
          })
          .from(activationTokens)
          .innerJoin(users, eq(users.id, activationTokens.userId))
          .where(eq(activationTokens.tokenDigest, digest)),
      );
      if (candidate?.status !== "open") return false;

      let passwordHash = null;
      if (clock() < candidate.expiresAt.getTime()) {
        if (!candidate.eligible || password === "" || !isPasswordWithinLimits(password))
          return false;
        passwordHash = await hashPassword(password);
      }

      const audit = { actorId: null, requestId };
      const { userId } = candidate;
      return await withSystemAudit(
        { transaction: (mutate) => withActivationWrite(database, mutate) },
        audit,
        async (tx) => {
          // Mismo orden que revocación y regeneración en ④-B2.
          const status = await lockActivationUser(tx, userId);
          if (status === undefined) return false;
          const current = await lockActivationToken(tx, userId, digest);
          if (current?.status !== "open") return false;
          const now = new Date(clock());

          const open = and(
            eq(activationTokens.tokenDigest, digest),
            eq(activationTokens.userId, userId),
            eq(activationTokens.status, "open"),
          );
          if (now >= current.expiresAt) {
            const [expired] = await tx
              .update(activationTokens)
              .set({ status: "expired", closedAt: now })
              .where(open)
              .returning({ digest: activationTokens.tokenDigest });
            if (!expired) throw new AccountActivationError();
            await recordSystemAudit(tx, { ...audit, event: "activation_token_expired" });
            // Confirmar el cierre y su evento aunque se rechace la activación.
            return false;
          }
          if (status !== "pending_activation" || passwordHash === null) return false;

          const [activated] = await tx
            .update(users)
            .set({ status: "active", passwordHash, updatedAt: now })
            .where(
              and(
                eq(users.id, userId),
                eq(users.status, "pending_activation"),
                isNull(users.passwordHash),
              ),
            )
            .returning({ id: users.id });
          if (!activated) return false;

          const [consumed] = await tx
            .update(activationTokens)
            .set({ status: "consumed", closedAt: now })
            .where(and(open, gt(activationTokens.expiresAt, now)))
            .returning({ digest: activationTokens.tokenDigest });
          if (!consumed) throw new AccountActivationError();

          await recordSystemAudit(tx, { ...audit, event: "account_activated" });
          await recordSystemAudit(tx, { ...audit, event: "activation_token_consumed" });
          return true;
        },
      );
    } catch (error) {
      if (error instanceof Argon2SaturatedError) throw error;
      // Los errores del driver pueden contener parámetros de SQL, incluido el PHC.
      throw new AccountActivationError();
    }
  };
}
