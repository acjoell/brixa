import { Buffer } from "node:buffer";
import { createHash, randomBytes } from "node:crypto";
import { and, eq, isNull } from "drizzle-orm";
import type { db } from "../db/client.js";
import { sessions, users } from "../db/schema.js";
import { withSessionWrite } from "../db/session-write.js";
import { parseSessionConfig } from "./session-config.js";
import { recordSystemAudit } from "./system-audit.js";

export class SessionOperationError extends Error {
  readonly code = "SESSION_OPERATION_FAILED";

  constructor() {
    super("SESSION_OPERATION_FAILED");
    this.name = "SessionOperationError";
  }
}

type SessionState = Pick<
  typeof sessions.$inferSelect,
  "userId" | "createdAt" | "lastActivityAt" | "idleExpiresAt"
>;

function digest(token: Buffer) {
  return createHash("sha256").update(token).digest("hex");
}

export function tokenDigest(token: unknown) {
  if (typeof token !== "string" || token.length !== 64 || /[^0-9a-f]/.test(token)) return null;
  return digest(Buffer.from(token, "hex"));
}

type SessionConfig = ReturnType<typeof parseSessionConfig>;

function expiry({ idleMs, lifetimeMs }: SessionConfig, now: number, created: number) {
  return new Date(Math.min(now + idleMs, created + lifetimeMs, 8.64e15));
}

// El llamador comprueba que la cuenta está activa dentro de la misma transacción.
export async function insertSession(
  tx: Pick<typeof db, "insert">,
  userId: string,
  config: SessionConfig,
  now: number,
) {
  const token = randomBytes(32);
  await tx.insert(sessions).values({
    sessionTokenHash: digest(token),
    userId,
    createdAt: new Date(now),
    lastActivityAt: new Date(now),
    idleExpiresAt: expiry(config, now, now),
  });
  return token.toString("hex");
}

export function readSession(connection: Pick<typeof db, "select">, hash: string) {
  return connection
    .select({
      userId: sessions.userId,
      createdAt: sessions.createdAt,
      lastActivityAt: sessions.lastActivityAt,
      idleExpiresAt: sessions.idleExpiresAt,
    })
    .from(sessions)
    .innerJoin(users, eq(sessions.userId, users.id))
    .where(
      and(
        eq(sessions.sessionTokenHash, hash),
        isNull(sessions.revokedAt),
        eq(users.status, "active"),
      ),
    );
}

export function isSessionValid(
  { idleMs, lifetimeMs }: SessionConfig,
  session: SessionState | undefined,
  now: number,
): session is SessionState {
  return (
    session !== undefined &&
    now < session.idleExpiresAt.getTime() &&
    now - session.createdAt.getTime() < lifetimeMs &&
    now - session.lastActivityAt.getTime() < idleMs
  );
}

export async function revokeUserSessions(
  tx: Pick<typeof db, "update">,
  userId: string,
  timestamp: Date,
) {
  await tx
    .update(sessions)
    .set({ revokedAt: timestamp })
    .where(and(eq(sessions.userId, userId), isNull(sessions.revokedAt)));
}

export function createSessionService(database: typeof db, env = process.env, clock = Date.now) {
  const config = parseSessionConfig(env);

  async function createSession(userId: string) {
    return withSessionWrite(database, userId, null, async (tx) => {
      const [active] = await tx
        .select({ id: users.id })
        .from(users)
        .where(and(eq(users.id, userId), eq(users.status, "active")));
      if (!active) return null;
      return insertSession(tx, userId, config, clock());
    });
  }

  async function validate(hash: string, intentionalActivity: boolean) {
    const session = (await readSession(database, hash))[0];
    const now = clock();
    if (!isSessionValid(config, session, now)) return null;
    if (intentionalActivity !== true || now - session.lastActivityAt.getTime() < 60_000)
      return session.userId;

    return withSessionWrite(database, session.userId, hash, async (tx) => {
      const current = (await readSession(tx, hash))[0];
      const at = clock();
      if (!isSessionValid(config, current, at)) return null;
      if (at - current.lastActivityAt.getTime() >= 60_000) {
        const updated = await tx
          .update(sessions)
          .set({
            lastActivityAt: new Date(at),
            idleExpiresAt: expiry(config, at, current.createdAt.getTime()),
          })
          .where(
            and(
              eq(sessions.sessionTokenHash, hash),
              isNull(sessions.revokedAt),
              eq(sessions.lastActivityAt, current.lastActivityAt),
            ),
          )
          .returning({ userId: sessions.userId });
        return updated[0]?.userId ?? null;
      }
      return current.userId;
    });
  }

  async function validateSession(token: unknown, intentionalActivity = false) {
    const hash = tokenDigest(token);
    if (!hash) return null;
    try {
      return await validate(hash, intentionalActivity);
    } catch {
      throw new SessionOperationError();
    }
  }

  async function markRevoked(connection: Pick<typeof db, "update">, hash: string, now: number) {
    const [row] = await connection
      .update(sessions)
      .set({ revokedAt: new Date(now) })
      .where(and(eq(sessions.sessionTokenHash, hash), isNull(sessions.revokedAt)))
      .returning({ userId: sessions.userId });
    return row;
  }

  async function revokeSession(token: unknown) {
    const hash = tokenDigest(token);
    if (!hash) return false;
    try {
      return (await markRevoked(database, hash, clock())) !== undefined;
    } catch {
      throw new SessionOperationError();
    }
  }

  async function logout(token: unknown, requestId: string): Promise<boolean> {
    const hash = tokenDigest(token);
    if (!hash) return false;
    try {
      const [candidate] = await readSession(database, hash);
      if (!isSessionValid(config, candidate, clock())) return false;

      // Comparte el orden de renovación: usuario, después sesión.
      return await withSessionWrite(database, candidate.userId, hash, async (tx) => {
        const [current] = await readSession(tx, hash);
        const now = clock();
        if (!isSessionValid(config, current, now) || current.userId !== candidate.userId)
          return false;

        const revoked = await markRevoked(tx, hash, now);
        if (!revoked) return false;
        await recordSystemAudit(tx, { event: "logout", actorId: revoked.userId, requestId });
        return true;
      });
    } catch {
      // Los errores del driver pueden incluir el digest en los parámetros SQL.
      throw new SessionOperationError();
    }
  }

  return { createSession, validateSession, revokeSession, logout };
}
