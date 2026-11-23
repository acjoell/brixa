import { randomBytes, randomUUID } from "node:crypto";
import { once } from "node:events";
import { mkdtemp, rm } from "node:fs/promises";

import { tmpdir } from "node:os";
import { join } from "node:path";
import { URL, URLSearchParams } from "node:url";
import { createClient } from "@libsql/client";
import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/libsql";
import { migrate } from "drizzle-orm/libsql/migrator";
import { expect, it, vi } from "vitest";
import { activationTokenDigest, generateActivationToken } from "../src/auth/activation-token.js";
import { createLoginAbuseService } from "../src/auth/login-abuse.js";
import { createSessionService } from "../src/auth/sessions.js";
import { sqliteActivationDatabase } from "../src/db/activation-write.js";
import * as schema from "../src/db/schema.js";

it.each(["cookie", "bearer"])(
  "alta y activación HTTP con %s",
  async (mode) => {
    vi.resetModules();
    const dir = await mkdtemp(join(tmpdir(), "brixa-http-activation-"));
    const url = "file:" + join(dir, "auth.db");
    const client = createClient({ url });
    const database = drizzle(client, { schema });
    const writer = sqliteActivationDatabase({ url });
    const origin = "https://app.example.test";
    const env = {
      AUTH_PUBLIC_ORIGIN: origin,
      ACTIVATION_PAGE_URL: origin + "/complete",
      AUTH_TRUSTED_PROXIES: "127.0.0.1",
      LOGIN_ABUSE_HMAC_KEY: randomBytes(32).toString("hex"),
      LOGIN_IP_REQUEST_LIMIT: "1",
    };
    let server;
    try {
      await migrate(database, { migrationsFolder: "drizzle" });
      const adminId = randomUUID();
      const memberId = randomUUID();
      const now = new Date();
      await database.insert(schema.users).values(
        [adminId, memberId].map((id) => ({
          id,
          canonicalIdentifier: id + "@example.test",
          status: "active",
          createdAt: now,
          updatedAt: now,
        })),
      );
      await database
        .insert(schema.initialAdministrator)
        .values({ singleton: "initial", userId: adminId });
      const sessions = createSessionService(database, env);
      const adminToken = await sessions.createSession(adminId);
      const memberToken = await sessions.createSession(memberId);
      const expiredToken = await createSessionService(
        database,
        env,
        () => +now - 3_600_000,
      ).createSession(adminId);
      const revokedToken = await sessions.createSession(adminId);
      await sessions.revokeSession(revokedToken);

      const { app } = await import("../src/app.js");
      const { initializeAuthHttp } = await import("../src/auth/http-runtime.js");
      for (const page of [
        "",
        "http://public.example/complete",
        origin + "/complete?token=ignored",
        "https://user:secret@app.example.test/complete",
      ]) {
        await expect(
          initializeAuthHttp(mode, "brixa-example", database, writer, {
            ...env,
            ACTIVATION_PAGE_URL: page,
          }),
        ).rejects.toThrow("ACTIVATION_PAGE_URL");
      }
      await initializeAuthHttp(mode, "brixa-example", database, writer, env);
      server = app.listen(0, "127.0.0.1");
      await once(server, "listening");
      const base = "http://127.0.0.1:" + server.address().port + "/auth";
      const proof = (token) =>
        mode === "cookie"
          ? { Cookie: "__Host-brixa-example=" + token }
          : { Authorization: "Bearer " + token };
      const post = (route, body, headers = {}) =>
        fetch(base + route, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "X-Forwarded-Proto": "https",
            Origin: origin,
            "X-Requested-With": "XMLHttpRequest",
            ...headers,
          },
          body: JSON.stringify(body),
        });
      const password = "initial-test-password";
      const identifier = { email: "pending@example.test" };
      const readLink = (activationUrl) => {
        const link = new URL(activationUrl);
        expect(link.origin + link.pathname).toBe(env.ACTIVATION_PAGE_URL);
        expect(link.search).toBe("");
        const token = new URLSearchParams(link.hash.slice(1)).get("token");
        expect(activationTokenDigest(token)).not.toBeNull();
        return token;
      };

      for (const token of [null, expiredToken, revokedToken]) {
        expect((await post("/register", identifier, token ? proof(token) : {})).status).toBe(401);
      }
      const denied = await post("/register", identifier, proof(memberToken));
      expect(denied.status).toBe(403);
      expect(await denied.json()).toEqual({ error: "Forbidden" });
      const wrongTransport =
        mode === "cookie"
          ? { Authorization: "Bearer " + adminToken }
          : { Cookie: "__Host-brixa-example=" + adminToken };
      expect((await post("/register", identifier, wrongTransport)).status).toBe(401);
      if (mode === "cookie") {
        expect(
          (
            await post("/register", identifier, {
              ...proof(adminToken),
              Origin: "https://foreign.example.test",
            })
          ).status,
        ).toBe(403);
        expect(
          (
            await post(
              "/activate",
              { token: generateActivationToken(), password },
              { Origin: "null" },
            )
          ).status,
        ).toBe(403);
      }
      expect(
        (await post("/register", { ...identifier, userId: adminId }, proof(adminToken))).status,
      ).toBe(400);

      const registration = await post("/register", identifier, proof(adminToken));
      expect(registration.status).toBe(201);
      expect(registration.headers.get("Cache-Control")).toBe("no-store");
      const { userId, activationUrl, created } = await registration.json();

      expect(created).toBe(true);
      const token = readLink(activationUrl);
      const repeat = await post(
        "/register",
        { email: identifier.email.toUpperCase() },
        proof(adminToken),
      );
      expect(repeat.status).toBe(200);
      expect(await repeat.json()).toEqual({ created: false, userId });
      expect(
        (await database.select().from(schema.activationTokens)).map((row) => row.tokenDigest),
      ).toEqual([activationTokenDigest(token)]);

      expect(
        (
          await fetch(base + "/activate?token=unused", {
            headers: { "X-Forwarded-Proto": "https" },
          })
        ).status,
      ).toBe(404);
      const revoked = await post("/activation/revoke", { userId }, proof(adminToken));
      expect(revoked.status).toBe(204);
      const rejects = async (value) => {
        const response = await post("/activate", { token: value, password });
        expect(response.status).toBe(400);
        expect(await response.json()).toEqual({ error: "Bad Request" });
      };
      await rejects(token);
      await rejects(generateActivationToken());
      await rejects("bad token");

      const regenerate = async () => {
        const response = await post("/activation/regenerate", { userId }, proof(adminToken));
        expect(response.status).toBe(200);
        const body = await response.json();
        return readLink(body.activationUrl);
      };
      const expired = await regenerate();
      await database
        .update(schema.activationTokens)
        .set({ issuedAt: new Date(+now - 2000), expiresAt: new Date(+now - 1000) })
        .where(eq(schema.activationTokens.tokenDigest, activationTokenDigest(expired)));
      await rejects(expired);
      const usable = await regenerate();

      await client.execute(
        "CREATE TRIGGER reject_activation BEFORE INSERT ON audit_log_system WHEN NEW.event = 'account_activated' BEGIN SELECT RAISE(ABORT, 'fixture'); END",
      );
      const failed = await post("/activate", { token: usable, password });
      expect(failed.status).toBe(500);
      expect(await failed.json()).toEqual({ error: "Internal Server Error" });
      const [unchanged] = await database
        .select()
        .from(schema.users)
        .where(eq(schema.users.id, userId));
      expect(unchanged.status).toBe("pending_activation");
      expect(unchanged.passwordHash).toBeNull();
      await client.execute("DROP TRIGGER reject_activation");

      const successful = await post("/activate", { token: usable, password });
      expect(successful.status).toBe(204);
      expect(await successful.text()).toBe("");
      expect(successful.headers.get("Set-Cookie")).toBeNull();
      await rejects(usable);
      const [activated] = await database
        .select()
        .from(schema.users)
        .where(eq(schema.users.id, userId));
      expect(activated.status).toBe("active");
      expect(activated.passwordHash).toMatch(/^\$argon2id\$/);
      expect(
        await database.select().from(schema.sessions).where(eq(schema.sessions.userId, userId)),
      ).toEqual([]);

      // Seven confirmations were accounted for, including the operational failure.
      for (let i = 0; i < 3; i++) await rejects("invalid");
      const limited = await post("/activate", { token: usable, password });
      expect(limited.status).toBe(429);
      expect(Number(limited.headers.get("Retry-After"))).toBeGreaterThan(0);
      expect(await createLoginAbuseService(writer, env).ipStatus("127.0.0.1")).toEqual({
        blocked: false,
        retryAfterMs: 0,
      });

      const events = await database.select().from(schema.auditLogSystem);
      for (const [response, event, actorId] of [
        [denied, "platform_admin_access_denied", memberId],
        [registration, "user_created", adminId],
        [registration, "activation_token_issued", adminId],
        [revoked, "activation_token_revoked", adminId],
        [successful, "account_activated", null],
        [successful, "activation_token_consumed", null],
      ]) {
        expect(events).toContainEqual(
          expect.objectContaining({
            event,
            actorId,
            requestId: response.headers.get("X-Request-Id"),
          }),
        );
      }
      expect(events.some((event) => event.requestId === failed.headers.get("X-Request-Id"))).toBe(
        false,
      );
      for (const secret of [token, expired, usable, password])
        expect(JSON.stringify(events)).not.toContain(secret);
    } finally {
      if (server) await new Promise((resolve) => server?.close(() => resolve()));
      client.close();
      await rm(dir, { recursive: true, force: true });
    }
  },
  15_000,
);
