import { z } from "zod";
import { randomUUID } from "node:crypto";
import { and, eq } from "drizzle-orm";
import {
  hasActivationAuthority,
  lockActivationUser,
  withActivationWrite,
} from "../db/activation-write.js";
import type { ActivationDatabase } from "../db/activation-write.js";
import type { db } from "../db/client.js";
import { activationTokens, users } from "../db/schema.js";
import { parseActivationExpiryHours } from "./activation-config.js";
import { activationTokenDigest, generateActivationToken } from "./activation-token.js";
import { emailSchema } from "./email.js";
import { recordSystemAudit, SystemAuditDenied, withSystemAudit } from "./system-audit.js";

// Contexto aportado por el llamador autenticado, separado de los datos del alta.
export type ActorContext = Readonly<{ userId: string; requestId: string }>;

type ActivationCode =
  "FORBIDDEN" | "INVALID_INPUT" | "ACCOUNT_NOT_PENDING" | "MANAGED_ACTIVATION_FAILED";
type Write = Pick<typeof db, "select" | "insert" | "update">;
type ClosedStatus = "revoked" | "expired";

export class ManagedActivationError extends Error {
  constructor(readonly code: ActivationCode) {
    super(code);
    this.name = "ManagedActivationError";
  }
}

const userIdSchema = z
  .string()
  .length(36)
  .regex(/^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$/);
const correlationSchema = z
  .string()
  .min(1)
  .max(128)
  .regex(/^[a-zA-Z0-9._:-]+$/);

export function createManagedActivationService(
  database: ActivationDatabase,
  env = process.env,
  clock = Date.now,
) {
  const expiryMs = parseActivationExpiryHours(env) * 3_600_000;

  async function write<T>(
    actor: ActorContext,
    operation: (tx: Write, audit: { actorId: string; requestId: string }) => Promise<T>,
  ): Promise<T> {
    try {
      const actorId = actor?.userId;
      const requestId = actor?.requestId;
      if (
        !userIdSchema.safeParse(actorId).success ||
        !correlationSchema.safeParse(requestId).success
      ) {
        throw new ManagedActivationError("INVALID_INPUT");
      }
      return await withSystemAudit(
        { transaction: (mutate) => withActivationWrite(database, mutate) },
        { actorId, requestId },
        async (tx) => {
          if (!(await hasActivationAuthority(tx, actorId))) {
            const [known] = await tx
              .select({ id: users.id })
              .from(users)
              .where(eq(users.id, actorId));
            throw new SystemAuditDenied("platform_admin_access_denied", known?.id ?? null);
          }
          return operation(tx, { actorId, requestId });
        },
      );
    } catch (error) {
      if (error instanceof ManagedActivationError) throw error;
      if (error instanceof SystemAuditDenied) throw new ManagedActivationError("FORBIDDEN");
      // SQL, parámetros y detalles del driver no forman parte del contrato.
      throw new ManagedActivationError("MANAGED_ACTIVATION_FAILED");
    }
  }

  async function issue(tx: Write, userId: string, issuedAt: Date) {
    const token = generateActivationToken();
    const tokenDigest = activationTokenDigest(token);
    if (tokenDigest === null) throw new ManagedActivationError("MANAGED_ACTIVATION_FAILED");
    const expiresAt = new Date(issuedAt.getTime() + expiryMs);
    await tx.insert(activationTokens).values({ tokenDigest, userId, issuedAt, expiresAt });
    return { token, expiresAt };
  }

  async function closeOpenToken(
    tx: Write,
    userId: string,
    now: Date,
  ): Promise<ClosedStatus | null> {
    const [open] = await tx
      .select({ digest: activationTokens.tokenDigest, expiresAt: activationTokens.expiresAt })
      .from(activationTokens)
      .where(and(eq(activationTokens.userId, userId), eq(activationTokens.status, "open")));
    if (!open) return null;

    const status = now >= open.expiresAt ? "expired" : "revoked";
    const [closed] = await tx
      .update(activationTokens)
      .set({ status, closedAt: now })
      .where(
        and(eq(activationTokens.tokenDigest, open.digest), eq(activationTokens.status, "open")),
      )
      .returning({ digest: activationTokens.tokenDigest });
    if (!closed) throw new ManagedActivationError("MANAGED_ACTIVATION_FAILED");
    return status;
  }

  function registerAccount(actor: ActorContext, identifier: unknown) {
    return write(actor, async (tx, audit) => {
      const parsed = emailSchema.safeParse(identifier);
      if (!parsed.success) throw new ManagedActivationError("INVALID_INPUT");
      const canonicalIdentifier = parsed.data;
      const now = new Date(clock());
      const [created] = await tx
        .insert(users)
        .values({ id: randomUUID(), canonicalIdentifier, createdAt: now, updatedAt: now })
        .onConflictDoNothing({ target: users.canonicalIdentifier })
        .returning({ id: users.id });
      if (!created) {
        const [existing] = await tx
          .select({ id: users.id })
          .from(users)
          .where(eq(users.canonicalIdentifier, canonicalIdentifier));
        if (!existing) throw new ManagedActivationError("MANAGED_ACTIVATION_FAILED");
        return { created: false as const, userId: existing.id };
      }
      const emission = await issue(tx, created.id, now);
      await recordSystemAudit(tx, { ...audit, event: "user_created" });
      await recordSystemAudit(tx, { ...audit, event: "activation_token_issued" });
      return { created: true as const, userId: created.id, ...emission };
    });
  }

  function changeToken(
    actor: ActorContext,
    userId: string,
    regenerate: true,
  ): Promise<{ closed: ClosedStatus | null; token: string; expiresAt: Date }>;
  function changeToken(
    actor: ActorContext,
    userId: string,
    regenerate: false,
  ): Promise<{ closed: ClosedStatus | null }>;
  function changeToken(actor: ActorContext, userId: string, regenerate: boolean) {
    return write(actor, async (tx, audit) => {
      if (!userIdSchema.safeParse(userId).success)
        throw new ManagedActivationError("INVALID_INPUT");
      const status = await lockActivationUser(tx, userId);
      if (regenerate && status !== "pending_activation") {
        throw new ManagedActivationError("ACCOUNT_NOT_PENDING");
      }
      const now = new Date(clock());
      const closed = await closeOpenToken(tx, userId, now);
      if (closed !== null) {
        await recordSystemAudit(tx, {
          ...audit,
          event: closed === "expired" ? "activation_token_expired" : "activation_token_revoked",
        });
      }
      if (!regenerate) return { closed } as const;

      const emission = await issue(tx, userId, now);
      await recordSystemAudit(tx, { ...audit, event: "activation_token_issued" });
      return { closed, ...emission };
    });
  }

  return {
    registerAccount,
    revokeActivationToken: (actor: ActorContext, userId: string) =>
      changeToken(actor, userId, false),
    regenerateActivationToken: (actor: ActorContext, userId: string) =>
      changeToken(actor, userId, true),
  };
}
