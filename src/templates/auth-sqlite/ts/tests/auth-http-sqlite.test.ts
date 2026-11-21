import { randomBytes, randomUUID } from "node:crypto";
import { once } from "node:events";
import { mkdtemp, rm } from "node:fs/promises";
import type { AddressInfo } from "node:net";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createClient } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";
import { migrate } from "drizzle-orm/libsql/migrator";
import { expect, it } from "vitest";
import { app } from "../src/app.js";
import { getArgon2Limiter } from "../src/auth/argon2-limiter.js";
import { createPasswordChangeService } from "../src/auth/change-password.js";
import { createAuthHttpApp } from "../src/auth/http.js";
import { createLoginService } from "../src/auth/login.js";
import { hashPassword } from "../src/auth/password-crypto.js";
import { createSessionService } from "../src/auth/sessions.js";
import { sqliteActivationDatabase } from "../src/db/activation-write.js";
import * as schema from "../src/db/schema.js";

it("integra adaptadores con SQLite y un transporte interno de prueba", async () => {
  const directory = await mkdtemp(join(tmpdir(), "brixa-auth-http-"));
  const url = "file:" + join(directory, "test.db");
  const client = createClient({ url });
  const db = drizzle(client, { schema });
  const writer = sqliteActivationDatabase({ url });
  const env = {
    LOGIN_ABUSE_HMAC_KEY: randomBytes(32).toString("hex"),
    LOGIN_IP_REQUEST_LIMIT: "20",
  };
  const userId = randomUUID();
  const email = "user@example.test";
  const password = "test-password";
  const replacement = "replacement-password";
  let now = Date.now();
  const clock = () => now;
  let token: string | undefined;
  const servers: ReturnType<typeof app.listen>[] = [];
  const baseUrl = async (application: typeof app) => {
    const server = application.listen(0, "127.0.0.1");
    servers.push(server);
    await once(server, "listening");
    return "http://127.0.0.1:" + (server.address() as AddressInfo).port;
  };
  try {
    await migrate(db, { migrationsFolder: "drizzle" });
    await db.insert(schema.users).values({
      id: userId,
      canonicalIdentifier: email,
      status: "active",
      passwordHash: await hashPassword(password),
      createdAt: new Date(now),
      updatedAt: new Date(now),
    });
    const auth = createAuthHttpApp(
      {
        login: await createLoginService(writer, env, clock),
        sessions: createSessionService(db, env, clock),
        changePassword: createPasswordChangeService(writer, env, clock),
      },
      {
        // Simulated transport. Credentials never cross the HTTP wire in this fixture.
        readToken: () => token,
        establishSession: (res, value) => {
          token = value;
          res.status(204).end();
        },
        clearSession: () => {
          token = undefined;
        },
      },
      {},
    );
    const base = await baseUrl(auth);
    const post = (route: string, data?: unknown) =>
      fetch(
        base + route,
        data === undefined
          ? { method: "POST" }
          : {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify(data),
            },
      );
    const session = () => fetch(base + "/session");
    const wrong = await post("/login", { email, password: "incorrect" });
    const absent = "absent@example.test";
    const missing = await post("/login", { email: absent, password });
    expect(wrong.status).toBe(401);
    expect(missing.status).toBe(401);
    expect(await wrong.text()).toBe(await missing.text());

    const limiter = getArgon2Limiter();
    const gate = Promise.withResolvers<void>();
    const tasks = Array.from({ length: 10 }, () => limiter(() => gate.promise));
    try {
      const response = await post("/login", { email, password });
      expect(response.status).toBe(503);
      expect(response.headers.get("Retry-After")).toBe("5");
    } finally {
      gate.resolve();
      await Promise.allSettled(tasks);
    }

    const success = await post("/login", { email, password });
    expect(success.status).toBe(204);
    expect(await success.text()).toBe("");
    expect(token).toMatch(/^[a-f0-9]{64}$/);
    const first = token;
    expect(await (await session()).json()).toEqual({ userId });
    expect((await post("/logout")).status).toBe(204);
    expect(token).toBeUndefined();
    token = first;
    expect((await session()).status).toBe(401);
    token = "not-a-session";
    expect((await session()).status).toBe(401);

    expect((await post("/login", { email, password })).status).toBe(204);
    const second = token;
    const passwordChange = await post("/password", {
      currentPassword: password,
      newPassword: replacement,
    });
    expect(passwordChange.status).toBe(204);
    token = second;
    expect((await session()).status).toBe(401);

    expect((await post("/login", { email, password: replacement })).status).toBe(204);
    now += 30 * 60_000;
    expect((await session()).status).toBe(401);

    for (let attempt = 0; attempt < 4; attempt++) {
      expect((await post("/login", { email: absent, password })).status).toBe(401);
    }
    const limited = await post("/login", { email: absent, password });
    expect(limited.status).toBe(429);
    expect(Number(limited.headers.get("Retry-After"))).toBeGreaterThan(0);

    const events = await db.select().from(schema.auditLogSystem);
    expect(events).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          event: "login_succeeded",
          requestId: success.headers.get("X-Request-Id"),
        }),
        expect.objectContaining({
          event: "password_changed",
          requestId: passwordChange.headers.get("X-Request-Id"),
        }),
      ]),
    );
    const audit = JSON.stringify(events);
    for (const secret of [password, replacement, first, second])
      if (secret) expect(audit).not.toContain(secret);

    // The generated parent has no transport and does not mount Auth.
    const unmounted = await baseUrl(app);
    for (const route of ["login", "session", "logout", "password"]) {
      const response = await fetch(unmounted + "/auth/" + route, {
        method: route === "session" ? "GET" : "POST",
      });
      expect(response.status).toBe(404);
    }
  } finally {
    await Promise.all(
      servers.map((server) => new Promise<void>((resolve) => server.close(() => resolve()))),
    );
    client.close();
    await rm(directory, { recursive: true, force: true });
  }
}, 15_000);
