import { randomUUID } from "node:crypto";
import { once } from "node:events";

import express from "express";
import { expect, it, vi } from "vitest";
import { Argon2SaturatedError } from "../src/auth/argon2-limiter.js";
import { createAuthHttpApp } from "../src/auth/http.js";

import { LoginRateLimitedError } from "../src/auth/login.js";

function fixture() {
  const login = vi.fn();
  const transport = {
    readToken: () => null,
    establishSession: (res) => {
      res.status(204).end();
    },
    clearSession: () => {},
  };
  const services = {
    login,
    sessions: {
      validateSession: () => Promise.resolve(null),
      logout: () => Promise.resolve(false),
    },
    changePassword: () => Promise.resolve(false),
  };
  return { login, transport, services };
}

function post(body, headers = {}) {
  return {
    method: "POST",
    headers: { "Content-Type": "application/json", ...headers },
    body: JSON.stringify(body),
  };
}

const credentials = { email: "person@example.test", password: "test-password" };

it("sanea entradas, credenciales rechazadas y errores de ambos límites", async () => {
  const { login, transport, services } = fixture();
  const app = createAuthHttpApp(services, transport, {});
  const server = app.listen(0, "127.0.0.1");
  await once(server, "listening");
  const url = "http://127.0.0.1:" + server.address().port;
  try {
    for (const body of [
      null,
      [],
      {},
      { ...credentials, extra: "secret-field" },
      { ...credentials, email: "invalid" },
      { ...credentials, password: "\ud800" },
      { ...credentials, password: "a".repeat(129) },
      { ...credentials, password: "a".repeat(8192) },
    ]) {
      const response = await fetch(url + "/login", post(body));
      expect(response.status).toBe(400);
      expect(await response.json()).toEqual({ error: "Bad Request" });
    }
    const broken = await fetch(url + "/login", {
      ...post(credentials),
      body: '{"password":"secret',
    });
    expect(broken.status).toBe(400);
    expect(await broken.json()).toEqual({ error: "Bad Request" });
    expect(
      (await fetch(url + "/login", post(credentials, { "Content-Type": "text/plain" }))).status,
    ).toBe(400);
    const logout = await fetch(url + "/logout", post({ unexpected: "secret-field" }));
    expect(logout.status).toBe(400);
    expect(await logout.json()).toEqual({ error: "Bad Request" });
    expect(login).not.toHaveBeenCalled();

    login.mockResolvedValueOnce("a".repeat(64));
    const successful = await fetch(
      url + "/login",
      post({ ...credentials, email: " PERSON@EXAMPLE.TEST " }),
    );
    expect(successful.status).toBe(204);
    expect(successful.headers.get("Cache-Control")).toBe("no-store");
    const id = successful.headers.get("X-Request-Id");
    expect(id).toMatch(/^[\da-f-]{36}$/);
    expect(login).toHaveBeenLastCalledWith(
      credentials.email,
      credentials.password,
      id,
      "127.0.0.1",
    );

    login.mockResolvedValue(null);
    const responses = await Promise.all([
      fetch(url + "/login", post(credentials)),
      fetch(url + "/login", post({ ...credentials, email: "absent@example.test" })),
    ]);
    for (const response of responses) {
      expect(response.status).toBe(401);
      expect(await response.json()).toEqual({ error: "Unauthorized" });
    }

    for (const [error, status, retryAfter, message] of [
      [new LoginRateLimitedError(1001), 429, "2", "Too Many Requests"],
      [new Argon2SaturatedError(), 503, "5", "Service Unavailable"],
      [new Error("driver private token and password"), 500, null, "Internal Server Error"],
    ]) {
      login.mockRejectedValueOnce(error);
      const response = await fetch(url + "/login", post(credentials));
      expect(response.status).toBe(status);
      expect(response.headers.get("Retry-After")).toBe(retryAfter);
      expect(await response.json()).toEqual({ error: message });
    }
  } finally {
    await new Promise((resolve) => server.close(() => resolve()));
  }
});

it.each([
  ["", "127.0.0.1"],
  ["127.0.0.1, 192.0.2.22", "198.51.100.20"],
])("resuelve IP mediante lista explícita de proxies %s", async (proxies, expected) => {
  const { login, transport, services } = fixture();
  login.mockResolvedValue(null);
  const attackerId = randomUUID();
  const parent = express();
  parent.set("trust proxy", true);
  parent.use("/auth", createAuthHttpApp(services, transport, { AUTH_TRUSTED_PROXIES: proxies }));
  const server = parent.listen(0, "127.0.0.1");
  await once(server, "listening");
  try {
    const url = "http://127.0.0.1:" + server.address().port;
    const response = await fetch(
      url + "/auth/login",
      post(credentials, {
        "X-Forwarded-For": "203.0.113.111, 198.51.100.20, 192.0.2.22",
        "X-Real-IP": "203.0.113.222",
        Forwarded: "for=203.0.113.233",
        "X-Request-Id": attackerId,
      }),
    );
    const id = response.headers.get("X-Request-Id");
    expect(id).not.toBe(attackerId);
    expect(response.status).toBe(401);
    expect(login).toHaveBeenCalledWith(credentials.email, credentials.password, id, expected);
  } finally {
    await new Promise((resolve) => server.close(() => resolve()));
  }
});

it("rechaza proxies ambiguos o abiertos", () => {
  const { transport, services } = fixture();
  for (const value of ["true", "1", "*", "loopback", "0.0.0.0", "::", "0.0.0.0/0", "127.0.0.1,"]) {
    expect(() => createAuthHttpApp(services, transport, { AUTH_TRUSTED_PROXIES: value })).toThrow(
      "AUTH_TRUSTED_PROXIES",
    );
  }
});
