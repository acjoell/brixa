import { randomBytes, randomUUID } from "node:crypto";
import { once } from "node:events";
import { existsSync } from "node:fs";
import { mkdtemp, rm } from "node:fs/promises";
import type { AddressInfo } from "node:net";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createClient } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";
import { migrate } from "drizzle-orm/libsql/migrator";
import { expect, it, vi } from "vitest";
import { hashPassword } from "../src/auth/password-crypto.js";
import { sqliteActivationDatabase } from "../src/db/activation-write.js";
import { withSqliteAdministrator } from "../src/db/local-admin.js";
import * as schema from "../src/db/schema.js";
import { checkAuthLifecycle } from "./auth-lifecycle-contract.js";

it("completa el ciclo Auth con cookies y SQLite en archivo", async () => {
  const directory = await mkdtemp(join(tmpdir(), "brixa-auth-lifecycle-"));
  const url = "file:" + join(directory, "test.db");
  const client = createClient({ url });
  vi.resetModules();
  vi.stubEnv("DATABASE_URL", url);
  vi.stubEnv("ENABLE_API_DOCS", "true");
  vi.stubEnv("ARGON2_MAX_CONCURRENT", "2");
  vi.stubEnv("ARGON2_MAX_QUEUE", "8");
  const database = drizzle(client, { schema });
  try {
    await migrate(database, { migrationsFolder: "drizzle" });
    await checkAuthLifecycle(
      "cookie",
      database,
      sqliteActivationDatabase({ url }),
      withSqliteAdministrator,
    );
  } finally {
    client.close();
    vi.unstubAllEnvs();
    await rm(directory, { recursive: true, force: true });
  }
}, 15_000);

for (const mode of ["cookie", "bearer"] as const) {
  it(`monta Auth con ${mode}, validación persistente y documentación condicionada`, async () => {
    vi.resetModules();
    vi.stubEnv("ENABLE_API_DOCS", "true");
    const directory = await mkdtemp(join(tmpdir(), "brixa-auth-http-"));
    const url = "file:" + join(directory, "test.db");
    const client = createClient({ url });
    const db = drizzle(client, { schema });
    let server: ReturnType<typeof import("../src/app.js").app.listen> | undefined;
    const env = {
      AUTH_PUBLIC_ORIGIN: "https://app.example.test",
      ACTIVATION_PAGE_URL: "https://app.example.test/activate",
      AUTH_TRUSTED_PROXIES: "127.0.0.1, 2001:db8::2",
      LOGIN_ABUSE_HMAC_KEY: randomBytes(32).toString("hex"),
      LOGIN_IP_REQUEST_LIMIT: "20",
    };
    const userId = randomUUID();
    const email = "user@example.test";
    const password = "test-password";
    const replacement = "replacement-password";
    const proxy = {
      "X-Forwarded-Proto": "https",
      "X-Forwarded-For": "2001:db8::3, 2001:db8::2",
    };
    const csrf = {
      Origin: env.AUTH_PUBLIC_ORIGIN,
      "X-Requested-With": "XMLHttpRequest",
      "Sec-Fetch-Site": "same-origin",
      "Sec-Fetch-Mode": "cors",
      "Sec-Fetch-Dest": "empty",
    };
    try {
      await migrate(db, { migrationsFolder: "drizzle" });
      await db.insert(schema.users).values({
        id: userId,
        canonicalIdentifier: email,
        status: "active",
        passwordHash: await hashPassword(password),
        createdAt: new Date(),
        updatedAt: new Date(),
      });
      const { app } = await import("../src/app.js");
      const { initializeAuthHttp } = await import("../src/auth/http-runtime.js");
      await initializeAuthHttp(mode, "brixa-example", db, sqliteActivationDatabase({ url }), env);
      server = app.listen(0, "127.0.0.1");
      await once(server, "listening");
      const base = "http://127.0.0.1:" + (server.address() as AddressInfo).port;
      const get = (path: string, auth: Record<string, string> = {}) =>
        fetch(base + path, { headers: { ...proxy, ...auth }, redirect: "manual" });
      const post = (
        path: string,
        body?: unknown,
        auth: Record<string, string> = {},
        origin: Record<string, string> = csrf,
      ) =>
        fetch(base + "/auth" + path, {
          method: "POST",
          headers: {
            ...proxy,
            ...origin,
            ...auth,
            ...(body ? { "Content-Type": "application/json" } : {}),
          },
          ...(body ? { body: JSON.stringify(body) } : {}),
        });

      const docs = existsSync("src/docs/openapi.json");
      for (const path of [
        "/docs",
        "/docs/",
        "/docs/swagger-ui-init.js",
        "/docs/swagger-ui.css",
        "/DOCS/swagger-ui-bundle.js",
      ]) {
        expect((await get(path)).status).toBe(docs ? 401 : 404);
      }
      expect((await get("/openapi.json")).status).toBe(404);
      expect((await fetch(base + "/auth/session")).status).toBe(403);
      expect((await get("/auth/session")).status).toBe(401);
      expect((await get("/auth/session", { Authorization: "Bearer x" })).status).toBe(401);
      expect((await post("/login", { email })).status).toBe(400);

      if (mode === "cookie") {
        for (const rejected of [
          {},
          { ...csrf, Origin: "https://foreign.example.test", Referer: env.AUTH_PUBLIC_ORIGIN },
          { ...csrf, Origin: "null", "X-Forwarded-Host": "null" },
          { ...csrf, "Sec-Fetch-Site": "cross-site" },
          { ...csrf, "X-Requested-With": "wrong" },
        ]) {
          expect((await post("/login", { email, password }, {}, rejected)).status).toBe(403);
        }
      }

      const absent = "absent@example.test";
      const incorrect = await post("/login", { email, password: "incorrect" });
      const missing = await post("/login", { email: absent, password });
      expect(incorrect.status).toBe(401);
      expect(missing.status).toBe(401);
      expect(await incorrect.text()).toBe(await missing.text());

      const { getArgon2Limiter: runtimeLimiter } = await import("../src/auth/argon2-limiter.js");
      const gate = Promise.withResolvers<void>();
      const tasks = Array.from({ length: 10 }, () => runtimeLimiter()(() => gate.promise));
      try {
        const saturated = await post("/login", { email, password });
        expect(saturated.status).toBe(503);
        expect(saturated.headers.get("Retry-After")).toBe("5");
      } finally {
        gate.resolve();
        await Promise.allSettled(tasks);
      }

      async function login(value: string) {
        const response = await post(
          "/login",
          { email, password: value },
          {},
          {
            Referer: env.AUTH_PUBLIC_ORIGIN + "/login",
            "X-Requested-With": "XMLHttpRequest",
          },
        );
        const cookie = response.headers.get("Set-Cookie");
        let auth: Record<string, string>;
        if (mode === "cookie") {
          expect(response.status).toBe(204);
          expect(await response.text()).toBe("");
          expect(cookie).toMatch(/^__Host-brixa-example=[a-f0-9]{64};/);
          expect(cookie).toContain("Max-Age=43200");
          for (const attr of ["HttpOnly", "Secure", "SameSite=Lax", "Path=/", "Expires="])
            expect(cookie).toContain(attr);
          expect(cookie).not.toContain("Domain=");
          auth = { Cookie: cookie!.split(";")[0] };
        } else {
          expect(response.status).toBe(200);
          expect(cookie).toBeNull();
          const { token } = (await response.json()) as { token: string };
          expect(token).toMatch(/^[a-f0-9]{64}$/);
          auth = { Authorization: "Bearer " + token };
        }
        return { auth, id: response.headers.get("X-Request-Id") };
      }

      const { auth: first, id } = await login(password);
      const session = await get("/auth/session", first);
      expect(await session.json()).toEqual({ userId });
      expect(session.headers.get("Cache-Control")).toBe("no-store");
      if (docs) {
        for (const path of ["/docs/", "/docs/swagger-ui-init.js", "/docs/swagger-ui.css"]) {
          const response = await get(path, first);
          expect(response.status).toBe(200);
          expect(response.headers.get("Cache-Control")).toBe("no-store");
        }
        const credential = (first.Cookie ?? first.Authorization).slice(-64);
        const redirect = await get("/docs?token=" + credential, first);
        expect(redirect.status).toBe(301);
        expect(redirect.headers.get("Location")).toBe("docs/");
        expect(await redirect.text()).not.toContain(credential);
        for (const path of ["/docs/", "/docs/swagger-ui-init.js"]) {
          expect(await (await get(path, first)).text()).not.toContain(credential);
        }
      }

      const mixed = {
        Authorization: "Bearer " + "a".repeat(64),
        Cookie: "__Host-brixa-example=" + "a".repeat(64),
        ...first,
      };
      expect((await get("/auth/session", mixed)).status).toBe(401);
      if (mode === "cookie") {
        expect((await post("/logout", undefined, first, {})).status).toBe(403);
        expect(
          (await get("/auth/session", { Cookie: first.Cookie + "; " + first.Cookie })).status,
        ).toBe(401);
      } else {
        expect(
          (
            await get("/auth/session", {
              Authorization: first.Authorization + ", " + first.Authorization,
            })
          ).status,
        ).toBe(401);
      }
      const logout = await post("/logout", undefined, first);
      expect(logout.status).toBe(204);
      if (mode === "cookie") {
        expect(logout.headers.get("Set-Cookie")).toMatch(
          /^__Host-brixa-example=; Path=\/; Expires=Thu, 01 Jan 1970 .*; HttpOnly; Secure; SameSite=Lax$/,
        );
      }
      expect((await get("/auth/session", first)).status).toBe(401);
      if (docs) expect((await get("/docs/swagger-ui-init.js", first)).status).toBe(401);

      const { auth: second } = await login(password);
      const changed = await post(
        "/password",
        {
          currentPassword: password,
          newPassword: replacement,
        },
        second,
      );
      expect(changed.status).toBe(204);
      expect((await get("/auth/session", second)).status).toBe(401);
      await login(replacement);
      for (let attempt = 0; attempt < 4; attempt++)
        expect((await post("/login", { email: absent, password })).status).toBe(401);
      const limited = await post("/login", { email: absent, password });
      expect(limited.status).toBe(429);
      expect(Number(limited.headers.get("Retry-After"))).toBeGreaterThan(0);

      const events = await db.select().from(schema.auditLogSystem);
      expect(events).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ event: "login_succeeded", requestId: id }),
          expect.objectContaining({
            event: "password_changed",
            requestId: changed.headers.get("X-Request-Id"),
          }),
        ]),
      );
      for (const secret of [
        password,
        replacement,
        ...Object.values(first),
        ...Object.values(second),
      ])
        expect(JSON.stringify(events)).not.toContain(secret.slice(-64));
    } finally {
      if (server) await new Promise<void>((resolve) => server?.close(() => resolve()));
      client.close();
      vi.unstubAllEnvs();
      await rm(directory, { recursive: true, force: true });
    }
  }, 15_000);
}
