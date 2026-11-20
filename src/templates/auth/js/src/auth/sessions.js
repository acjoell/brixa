import { Buffer } from "node:buffer";
import { createHash, randomBytes } from "node:crypto";
import { and, eq, isNull } from "drizzle-orm";

import { sessions, users } from "../db/schema.js";
import { withSessionWrite } from "../db/session-write.js";
import { parseSessionConfig } from "./session-config.js";

function digest(token) {
  return createHash("sha256").update(token).digest("hex");
}

function tokenDigest(token) {
  if (typeof token !== "string" || token.length !== 64 || /[^0-9a-f]/.test(token)) return null;
  return digest(Buffer.from(token, "hex"));
}

export function createSessionService(database, env = process.env, clock = Date.now) {
  const { idleMs, lifetimeMs } = parseSessionConfig(env);

  function read(connection, hash) {
    return connection
      .select({ session: sessions })
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

  function valid(session, now) {
    return (
      session !== undefined &&
      now < session.idleExpiresAt.getTime() &&
      now - session.createdAt.getTime() < lifetimeMs &&
      now - session.lastActivityAt.getTime() < idleMs
    );
  }

  function expiry(now, created) {
    return new Date(Math.min(now + idleMs, created + lifetimeMs, 8.64e15));
  }

  async function createSession(userId) {
    return withSessionWrite(database, userId, null, async (tx) => {
      const [active] = await tx
        .select({ id: users.id })
        .from(users)
        .where(and(eq(users.id, userId), eq(users.status, "active")));
      if (!active) return null;
      const now = clock();
      const token = randomBytes(32);
      await tx.insert(sessions).values({
        sessionTokenHash: digest(token),
        userId,
        createdAt: new Date(now),
        lastActivityAt: new Date(now),
        idleExpiresAt: expiry(now, now),
      });
      return token.toString("hex");
    });
  }

  async function validateSession(token, intentionalActivity = false) {
    const hash = tokenDigest(token);
    if (!hash) return null;
    const session = (await read(database, hash))[0]?.session;
    const now = clock();
    if (!valid(session, now)) return null;
    if (intentionalActivity !== true || now - session.lastActivityAt.getTime() < 60_000)
      return session.userId;

    return withSessionWrite(database, session.userId, hash, async (tx) => {
      const current = (await read(tx, hash))[0]?.session;
      const at = clock();
      if (!valid(current, at)) return null;
      if (at - current.lastActivityAt.getTime() >= 60_000) {
        const updated = await tx
          .update(sessions)
          .set({
            lastActivityAt: new Date(at),
            idleExpiresAt: expiry(at, current.createdAt.getTime()),
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

  async function revokeSession(token) {
    const hash = tokenDigest(token);
    if (!hash) return false;
    const rows = await database
      .update(sessions)
      .set({ revokedAt: new Date(clock()) })
      .where(and(eq(sessions.sessionTokenHash, hash), isNull(sessions.revokedAt)))
      .returning({ userId: sessions.userId });
    return rows.length === 1;
  }

  return { createSession, validateSession, revokeSession };
}
