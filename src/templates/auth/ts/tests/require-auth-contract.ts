import assert from "node:assert/strict";
import { randomBytes, randomUUID } from "node:crypto";
import { once } from "node:events";
import { request } from "node:http";
import type { IncomingMessage } from "node:http";
import type { AddressInfo } from "node:net";
import { eq } from "drizzle-orm";
import express from "express";
import { vi } from "vitest";
import { createSessionService, tokenDigest } from "../src/auth/sessions.js";
import type { ActivationDatabase } from "../src/db/activation-write.js";
import type { db } from "../src/db/client.js";
import { sessions, users } from "../src/db/schema.js";

const origin = "https://app.example.test";
const proxy = { "X-Forwarded-Proto": "https" };
const csrf = { Origin: origin, "X-Requested-With": "XMLHttpRequest" };
const cookieName = "business-test";
const config = {
  AUTH_PUBLIC_ORIGIN: origin,
  ACTIVATION_PAGE_URL: origin + "/activate",
  AUTH_TRUSTED_PROXIES: "127.0.0.1",
  LOGIN_ABUSE_HMAC_KEY: randomBytes(32).toString("hex"),
};

async function withBusinessRoutes(
  test: (fixture: {
    initialize: typeof import("../src/auth/http-runtime.js").initializeAuthHttp;
    send: (
      status: number,
      headers?: Record<string, string | string[]>,
      method?: string,
      path?: string,
    ) => Promise<unknown>;
  }) => Promise<void>,
) {
  vi.resetModules();
  const { initializeAuthHttp: initialize, requireAuth } =
    await import("../src/auth/http-runtime.js");
  const app = express();
  // La política de la app anfitriona no debe decidir si el transporte de Auth es seguro.
  app.set("trust proxy", true);
  let calls = 0;
  const business = express.Router();
  const respond: express.RequestHandler = (req, res) => {
    calls++;
    res.json(req.auth);
  };
  app.all("/identity", requireAuth(), respond);
  business.all("/identity", requireAuth(), respond);
  business.all("/activity", requireAuth({ intentionalActivity: true }), respond);
  app.use("/business", business);

  const server = app.listen(0, "127.0.0.1");
  try {
    await once(server, "listening");
    const base = "http://127.0.0.1:" + (server.address() as AddressInfo).port;
    await test({
      initialize,
      async send(status, headers = proxy, method = "GET", path = "/business/identity") {
        const previous = calls;
        const response = await new Promise<IncomingMessage>((resolve, reject) => {
          request(base + path, { method, headers }, resolve)
            .once("error", reject)
            .end();
        });
        assert.equal(response.statusCode, status, method + " " + path);
        assert.equal(response.headers["cache-control"], "no-store");
        assert.equal(calls, previous + (status === 200 ? 1 : 0));
        let body = "";
        for await (const chunk of response.setEncoding("utf8")) body += chunk;
        if (method === "HEAD") {
          assert.equal(body, "");
          return;
        }
        return JSON.parse(body);
      },
    });
  } finally {
    await new Promise<void>((resolve) => server.close(() => resolve()));
  }
}

export async function checkBusinessAuth(
  mode: "cookie" | "bearer",
  database: typeof db,
  writer: ActivationDatabase,
) {
  const initial = Date.now();
  let now = initial;
  const clock = vi.spyOn(Date, "now").mockImplementation(() => now);
  try {
    await withBusinessRoutes(async ({ initialize, send }) => {
      assert.deepEqual(await send(503), { error: "Service Unavailable" });
      await assert.rejects(
        initialize(mode, cookieName, database, writer, { ...config, ACTIVATION_PAGE_URL: "" }),
        /ACTIVATION_PAGE_URL/,
      );
      await send(503);
      await initialize(mode, cookieName, database, writer, config);
      const userId = randomUUID();
      await database.insert(users).values({
        id: userId,
        canonicalIdentifier: userId,
        status: "active",
        createdAt: new Date(now),
        updatedAt: new Date(now),
      });
      const service = createSessionService(database, config, () => now);
      const createProof = async () => {
        const token = await service.createSession(userId);
        const digest = tokenDigest(token);
        assert(token && digest);
        const Cookie = `__Host-${cookieName}=${token}`;
        const Authorization = "Bearer " + token;
        const header: Record<string, string> = mode === "cookie" ? { Cookie } : { Authorization };
        return { token, digest, Cookie, Authorization, headers: { ...proxy, ...header } };
      };
      const { digest, headers, Cookie, Authorization } = await createProof();
      const both = { ...headers, Cookie, Authorization };
      await send(401);
      await send(401, both);
      await send(
        401,
        mode === "cookie"
          ? { ...headers, Cookie: Cookie + "; " + Cookie }
          : { ...headers, Authorization: [Authorization, Authorization] },
      );
      await send(403, mode === "cookie" ? { Cookie } : { Authorization });
      await send(403, { ...headers, "X-Forwarded-Proto": "https, http" });
      for (const path of ["/identity", "/business/identity"])
        assert.deepEqual(await send(200, headers, "GET", path), { userId });

      for (const method of ["POST", "PUT", "PATCH", "DELETE"]) {
        if (mode === "cookie") {
          await send(403, headers, method);
          await send(403, { ...headers, ...csrf, Origin: "null", Referer: origin }, method);
        }
        assert.deepEqual(await send(200, { ...headers, ...csrf }, method), { userId });
      }

      const read = async () => {
        const [row] = await database
          .select()
          .from(sessions)
          .where(eq(sessions.sessionTokenHash, digest));
        return row;
      };
      const intentional = (status: number) =>
        send(status, { ...headers, ...csrf }, "POST", "/business/activity");
      now += 59_999;
      await intentional(200);
      assert.equal((await read()).lastActivityAt.getTime(), initial);
      now++;
      await send(200, { ...headers, ...csrf, "X-Intentional-Activity": "true" }, "POST");
      assert.equal((await read()).lastActivityAt.getTime(), initial);
      const beforeSafeRequests = await read();
      for (const method of ["GET", "HEAD", "OPTIONS"]) {
        await send(200, headers, method, "/business/activity");
        assert.deepEqual(await read(), beforeSafeRequests, method);
      }
      await intentional(200);
      const renewed = await read();
      assert.equal(renewed.lastActivityAt.getTime(), now);
      assert(renewed.idleExpiresAt > beforeSafeRequests.idleExpiresAt);
      assert.deepEqual(renewed.createdAt, beforeSafeRequests.createdAt);

      const limit = initial + 43_200_000;
      now = limit - 1;
      await database
        .update(sessions)
        .set({
          lastActivityAt: new Date(now - 60_000),
          idleExpiresAt: new Date(limit),
        })
        .where(eq(sessions.sessionTokenHash, digest));
      await intentional(200);
      assert.equal((await read()).lastActivityAt.getTime(), now);
      assert.equal((await read()).idleExpiresAt.getTime(), limit);
      now++;
      await intentional(401);

      const idle = await createProof();
      now += 1_800_000;
      await send(401, idle.headers);
      const current = await createProof();
      await database.update(users).set({ status: "disabled" }).where(eq(users.id, userId));
      await send(401, current.headers);
      await database.update(users).set({ status: "active" }).where(eq(users.id, userId));
      const storage = vi.spyOn(database, "select").mockImplementationOnce(() => {
        throw new Error("sensitive persistence fixture");
      });
      try {
        assert.deepEqual(await send(500, current.headers), { error: "Internal Server Error" });
      } finally {
        storage.mockRestore();
      }
      assert.deepEqual(await send(200, current.headers), { userId });
      assert(await service.revokeSession(current.token));
      await send(401, current.headers);
    });
  } finally {
    clock.mockRestore();
  }
}

export async function checkBusinessTransportBoundaries(
  database: typeof db,
  writer: ActivationDatabase,
) {
  await withBusinessRoutes(async ({ initialize, send }) => {
    await initialize("cookie", cookieName, database, writer, {
      ...config,
      AUTH_TRUSTED_PROXIES: "",
    });
    // Express acepta la cabecera reenviada por su política, mientras Auth la ignora.
    await send(403);
  });
  await withBusinessRoutes(async ({ initialize, send }) => {
    await initialize("cookie", cookieName, database, writer, {
      ...config,
      NODE_ENV: "development",
      AUTH_PUBLIC_ORIGIN: "http://localhost:3000",
      ACTIVATION_PAGE_URL: "http://localhost:3000/activate",
    });
    // El Host directo y el socket local satisfacen la excepción; falta la sesión.
    await send(401, { Host: "localhost:3000" });
    await send(403, { Host: "foreign.example.test", "X-Forwarded-Host": "localhost:3000" });
    await send(403, { Host: "localhost:3000", ...proxy });
  });
}
