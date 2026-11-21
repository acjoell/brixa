import { eq } from "drizzle-orm";
import { lockAccount, readActivation, withActivationWrite } from "../db/activation-write.js";
import type { ActivationDatabase } from "../db/activation-write.js";
import { users } from "../db/schema.js";
import { Argon2SaturatedError } from "./argon2-limiter.js";
import { emailSchema } from "./email.js";
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
  readonly code = "LOGIN_FAILED";

  constructor() {
    super("LOGIN_FAILED");
    this.name = "LoginError";
  }
}

export async function createLoginService(
  database: ActivationDatabase,
  env = process.env,
  clock = Date.now,
) {
  const config = parseSessionConfig(env);
  const dummy = await prepareDummyVerification();
  const writer = {
    transaction: <T>(operation: Parameters<typeof withActivationWrite<T>>[1]) =>
      withActivationWrite(database, operation),
  };

  return async function login(
    email: unknown,
    password: unknown,
    requestId: string,
  ): Promise<string | null> {
    const identifier = emailSchema.safeParse(email);
    const failure = { event: "login_failed" as const, actorId: null, requestId };
    async function reject() {
      await writer.transaction((tx) => recordSystemAudit(tx, failure));
      return null;
    }

    try {
      if (!identifier.success || password === "" || !isPasswordWithinLimits(password))
        return await reject();

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
      let verified: boolean;
      try {
        verified = await verifyPassword(password, phc);
      } catch (error) {
        if (!(error instanceof PasswordCryptoError) || error.code !== "CORRUPT_PHC") throw error;
        await dummy(password);
        return await reject();
      }
      if (!verified) return await reject();

      const rehash = needsPasswordRehash(phc, verified) ? await hashPassword(password) : null;
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
      if (error instanceof Argon2SaturatedError) throw error;
      throw new LoginError();
    }
  };
}
