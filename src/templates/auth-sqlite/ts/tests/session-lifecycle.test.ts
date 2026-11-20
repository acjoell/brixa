import { createHash, randomUUID } from "node:crypto";
import { Buffer } from "node:buffer";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { createClient } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";
import { migrate } from "drizzle-orm/libsql/migrator";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import * as schema from "../src/db/schema.js";
import { createSessionService } from "../src/auth/sessions.js";

async function fixture() {
  const directory = await mkdtemp(path.join(tmpdir(), "auth-sessions-"));
  const url = "file:" + path.join(directory, "sessions.db");
  const writer = createClient({ url });
  const reader = createClient({ url });
  const db = drizzle(writer, { schema });
  const second = drizzle(reader, { schema });
  let now = 1_700_000_000_000;
  const clock = () => now;
  const service = createSessionService(db, {}, clock);
  const other = createSessionService(second, {}, clock);
  const id = randomUUID();
  await migrate(db, { migrationsFolder: "drizzle" });
  await db.insert(schema.users).values({
    id,
    canonicalIdentifier: "persona",
    status: "active",
    createdAt: new Date(now),
    updatedAt: new Date(now),
  });
  const token = await service.createSession(id);
  if (!token) throw new Error("Sesión inicial ausente.");
  return {
    db,
    service,
    other,
    id,
    token,
    clock,
    advance: (ms: number) => {
      now += ms;
    },
    close: async () => {
      reader.close();
      writer.close();
      await rm(directory, { recursive: true });
    },
  };
}

let f: Awaited<ReturnType<typeof fixture>>;
beforeEach(async () => {
  f = await fixture();
});
afterEach(async () => {
  await f.close();
});

it("emite 32 bytes aleatorios y solo conserva su SHA-256", async () => {
  const second = await f.service.createSession(f.id);
  expect(second).toMatch(/^[0-9a-f]{64}$/);
  expect(second).not.toBe(f.token);
  expect(f.token).toMatch(/^[0-9a-f]{64}$/);
  const rows = await f.db.select().from(schema.sessions);
  expect(rows.map((row) => row.sessionTokenHash).sort()).toEqual(
    [f.token, second!]
      .map((token) => createHash("sha256").update(Buffer.from(token, "hex")).digest("hex"))
      .sort(),
  );
  expect(await f.other.validateSession(f.token)).toBe(f.id);
  const changed = (f.token[0] === "0" ? "1" : "0") + f.token.slice(1);
  expect(await f.other.validateSession(changed, true)).toBeNull();
  expect(await f.service.revokeSession(changed)).toBe(false);
});

it("solo actualiza al cumplir 60 s de actividad intencional", async () => {
  const start = f.clock();
  f.advance(59_999);
  expect(await f.service.validateSession(f.token, true)).toBe(f.id);
  f.advance(1);
  expect(await f.service.validateSession(f.token)).toBe(f.id);
  expect((await f.db.select().from(schema.sessions))[0].lastActivityAt.getTime()).toBe(start);
  expect(await f.service.validateSession(f.token, true)).toBe(f.id);
  const [row] = await f.db.select().from(schema.sessions);
  expect(row.lastActivityAt.getTime()).toBe(f.clock());
  expect(row.idleExpiresAt.getTime()).toBe(f.clock() + 1_800_000);
  f.advance(1_799_999);
  expect(await f.other.validateSession(f.token)).toBe(f.id);
  f.advance(1);
  expect(await f.other.validateSession(f.token, true)).toBeNull();
});

it("acota la renovación a las 12 h desde la creación", async () => {
  const start = f.clock();
  for (let i = 0; i < 24; i++) {
    f.advance(29 * 60_000);
    expect(await f.other.validateSession(f.token, true)).toBe(f.id);
  }
  f.advance(24 * 60_000 - 1);
  expect(await f.service.validateSession(f.token, true)).toBe(f.id);
  expect((await f.db.select().from(schema.sessions))[0].idleExpiresAt.getTime()).toBe(
    start + 43_200_000,
  );
  f.advance(1);
  expect(await f.service.validateSession(f.token, true)).toBeNull();
});

it("rechaza sesiones y altas de un usuario deshabilitado", async () => {
  f.advance(60_000);
  await f.db.update(schema.users).set({ status: "disabled" });
  expect(await f.other.validateSession(f.token, true)).toBeNull();
  expect(await f.service.createSession(f.id)).toBeNull();
});

it("una revocación concurrente sigue visible desde otra conexión", async () => {
  f.advance(60_000);
  const [, revoked] = await Promise.all([
    f.service.validateSession(f.token, true),
    f.other.revokeSession(f.token),
  ]);
  expect(revoked).toBe(true);
  expect(await f.service.validateSession(f.token, true)).toBeNull();
  expect(await f.service.revokeSession(f.token)).toBe(false);
});

it.each(["revocada", "deshabilitada", "expirada"])(
  "descarta la lectura inicial si al renovar la sesión está %s",
  async (change) => {
    const start = f.clock();
    f.advance(60_000);
    const transaction = f.db.transaction.bind(f.db);
    vi.spyOn(f.db, "transaction").mockImplementationOnce(async (operation) => {
      if (change === "revocada") await f.other.revokeSession(f.token);
      if (change === "deshabilitada") await f.db.update(schema.users).set({ status: "disabled" });
      if (change === "expirada") f.advance(1_740_000);
      return transaction(operation);
    });
    expect(await f.service.validateSession(f.token, true)).toBeNull();
    expect((await f.db.select().from(schema.sessions))[0].lastActivityAt.getTime()).toBe(start);
  },
);

it("valida ambos plazos y aplica sus valores configurados", async () => {
  for (const key of ["SESSION_IDLE_TIMEOUT_MINUTES", "SESSION_MAX_LIFETIME_HOURS"]) {
    for (const value of ["", "0", "-1", "1.5", "abc"]) {
      expect(() => createSessionService(f.db, { [key]: value })).toThrow(key);
    }
  }
  const short = createSessionService(
    f.db,
    { SESSION_IDLE_TIMEOUT_MINUTES: "1", SESSION_MAX_LIFETIME_HOURS: "1" },
    f.clock,
  );
  f.advance(60_000);
  expect(await short.validateSession(f.token, true)).toBeNull();
  const capped = createSessionService(
    f.db,
    { SESSION_IDLE_TIMEOUT_MINUTES: "120", SESSION_MAX_LIFETIME_HOURS: "1" },
    f.clock,
  );
  const token = await capped.createSession(f.id);
  f.advance(3_600_000);
  expect(await capped.validateSession(token)).toBeNull();
});
