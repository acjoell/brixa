import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import { expect, vi } from "vitest";

import { auditLogSystem, users } from "../src/db/schema.js";
import { SystemAuditDenied, withSystemAudit } from "../src/auth/system-audit.js";

export async function checkAuditTransactions(database, observer) {
  const id = randomUUID();
  const input = {
    event: "user_created",
    requestId: randomUUID(),
    actorId: null,
    token: "secret-fixture",
  };
  const now = new Date();
  const user = { id, canonicalIdentifier: id, createdAt: now, updatedAt: now };
  const events = () =>
    database
      .select()
      .from(auditLogSystem)
      .where(eq(auditLogSystem.requestId, input.requestId))
      .orderBy(auditLogSystem.event);
  const readUser = () => database.select().from(users).where(eq(users.id, id));

  await expect(
    withSystemAudit(database, { ...input, actorId: randomUUID() }, async (tx) => {
      await tx.insert(users).values(user);
    }),
  ).rejects.toThrow();
  expect(await readUser()).toEqual([]);

  await expect(
    withSystemAudit(database, input, async (tx) => {
      await tx.insert(users).values(user);
      await tx.insert(users).values(user);
    }),
  ).rejects.toThrow();
  expect(await readUser()).toEqual([]);
  expect(await events()).toEqual([]);

  const denial = new SystemAuditDenied("login_failed");
  await expect(
    withSystemAudit(database, input, async (tx) => {
      await tx.insert(users).values(user);
      expect(await observer.select().from(users).where(eq(users.id, id))).toEqual([]);
      throw denial;
    }),
  ).rejects.toBe(denial);
  expect(await readUser()).toEqual([]);
  expect(await events()).toEqual([
    {
      id: expect.any(String),
      event: "login_failed",
      actorId: null,
      requestId: input.requestId,
      createdAt: expect.any(Date),
    },
  ]);

  const returnedDenial = new SystemAuditDenied("brute_force_detected");
  await expect(
    withSystemAudit(database, input, async (tx) => {
      await tx.insert(users).values(user);
      return returnedDenial;
    }),
  ).rejects.toBe(returnedDenial);
  expect(await readUser()).toEqual([]);
  expect((await events()).map((row) => row.event).sort()).toEqual([
    "brute_force_detected",
    "login_failed",
  ]);

  const platformDenial = new SystemAuditDenied("platform_admin_access_denied");
  await expect(
    withSystemAudit(database, { actorId: null, requestId: input.requestId }, async (tx) => {
      await tx.insert(users).values(user);
      throw platformDenial;
    }),
  ).rejects.toBe(platformDenial);
  expect(await readUser()).toEqual([]);
  expect((await events()).map((row) => row.event).sort()).toEqual([
    "brute_force_detected",
    "login_failed",
    "platform_admin_access_denied",
  ]);

  const deniedEvents = await events();
  for (const event of ["login_failed", "brute_force_detected", "platform_admin_access_denied"]) {
    const mutate = vi.fn(async (tx) => {
      await tx.insert(users).values(user);
    });
    await expect(
      // @ts-expect-error Los eventos de denegación también deben rechazarse en ejecución.
      withSystemAudit(database, { ...input, event }, mutate),
    ).rejects.toThrow("Un evento de denegación requiere una transacción independiente.");
    expect(mutate).not.toHaveBeenCalled();
    expect(await readUser()).toEqual([]);
  }
  expect(await events()).toEqual(deniedEvents);

  await expect(
    withSystemAudit(database, { ...input, actorId: id }, async (tx) => {
      await tx.insert(users).values(user);
      throw platformDenial;
    }),
  ).rejects.toMatchObject({ cause: { message: expect.stringMatching(/foreign key/i) } });
  expect(await readUser()).toEqual([]);
  expect(await events()).toEqual(deniedEvents);

  await expect(
    withSystemAudit(database, input, async (tx) => {
      await tx.insert(users).values(user);
      return id;
    }),
  ).resolves.toBe(id);
  expect(await readUser()).toHaveLength(1);
  expect((await events()).map((row) => row.event).sort()).toEqual([
    "brute_force_detected",
    "login_failed",
    "platform_admin_access_denied",
    "user_created",
  ]);
  return input.requestId;
}
