import { randomUUID } from "node:crypto";
import { once } from "node:events";
import type { AddressInfo } from "node:net";
import express from "express";
import { expect, it, vi } from "vitest";
import { Argon2SaturatedError } from "../src/auth/argon2-limiter.js";
import { createAuthHttpApp } from "../src/auth/http.js";
import type { AuthHttpTransport } from "../src/auth/http.js";
import { LoginRateLimitedError } from "../src/auth/login.js";

function fixture() {
  const login = vi.fn<Parameters<typeof createAuthHttpApp>[0]["login"]>();
  const transport: AuthHttpTransport = {
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
    activation: {
      managed: {
        registerAccount: () => Promise.reject(new Error("unexpected registration")),
        revokeActivationToken: () => Promise.reject(new Error("unexpected revocation")),
        regenerateActivationToken: () => Promise.reject(new Error("unexpected regeneration")),
      },
      activateAccount: () => Promise.resolve(false),
      validateToken: () => Promise.resolve(false),
      consumeIp: () => Promise.resolve({ accepted: false, blocked: true, retryAfterMs: 1000 }),
      consumeValidationIp: () =>
        Promise.resolve({ accepted: false, blocked: true, retryAfterMs: 1000 }),
      cleanupExpired: () => Promise.resolve(0),
      link: () => "",
    },
  };
  return { login, transport, services };
}

function post(body: unknown, headers: Record<string, string> = {}) {
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
  const url = "http://127.0.0.1:" + (server.address() as AddressInfo).port;
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
    ] as const) {
      login.mockRejectedValueOnce(error);
      const response = await fetch(url + "/login", post(credentials));
      expect(response.status).toBe(status);
      expect(response.headers.get("Retry-After")).toBe(retryAfter);
      expect(await response.json()).toEqual({ error: message });
    }
  } finally {
    await new Promise<void>((resolve) => server.close(() => resolve()));
  }
});

it("sanea un fallo de persistencia durante la validación de activación", async () => {
  const { transport, services } = fixture();
  services.activation.consumeValidationIp = () =>
    Promise.resolve({ accepted: true, blocked: false, retryAfterMs: 0 });
  services.activation.validateToken = () => Promise.reject(new Error("fixture sensitive data"));
  const server = createAuthHttpApp(services, transport, {}).listen(0, "127.0.0.1");
  await once(server, "listening");
  try {
    const url = "http://127.0.0.1:" + (server.address() as AddressInfo).port;
    const response = await fetch(url + "/activate/validate", post({ token: "A".repeat(43) }));
    expect(response.status).toBe(500);
    expect(response.headers.get("Cache-Control")).toBe("no-store");
    expect(await response.json()).toEqual({ error: "Internal Server Error" });
  } finally {
    await new Promise<void>((resolve) => server.close(() => resolve()));
  }
});

it.each([
  ["", "127.0.0.1"],
  ["127.0.0.1, 192.0.2.22", "198.51.100.20"],
] as const)("resuelve IP mediante lista explícita de proxies %s", async (proxies, expected) => {
  const { login, transport, services } = fixture();
  login.mockResolvedValue(null);
  const attackerId = randomUUID();
  const parent = express();
  parent.set("trust proxy", true);
  parent.use("/auth", createAuthHttpApp(services, transport, { AUTH_TRUSTED_PROXIES: proxies }));
  const server = parent.listen(0, "127.0.0.1");
  await once(server, "listening");
  try {
    const url = "http://127.0.0.1:" + (server.address() as AddressInfo).port;
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
    await new Promise<void>((resolve) => server.close(() => resolve()));
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

it("no acepta TLS de un proxy no declarado y toma el primer salto no confiable", async () => {
  const { createAuthHttpTransport } = await import("../src/auth/http-transport.js");
  const { login, services } = fixture();
  login.mockResolvedValue(null);
  const origin = "https://app.example.test";
  const env = { AUTH_PUBLIC_ORIGIN: origin, NODE_ENV: "production" };
  const parent = express();
  parent.set("trust proxy", true);
  for (const [path, AUTH_TRUSTED_PROXIES] of [
    ["/direct", ""],
    ["/proxy", "127.0.0.1, 2001:db8::3"],
  ] as const) {
    const config = { ...env, AUTH_TRUSTED_PROXIES };
    parent.use(
      path,
      createAuthHttpApp(services, createAuthHttpTransport("cookie", "test", config), config),
    );
  }
  const server = parent.listen(0, "127.0.0.1");
  await once(server, "listening");
  try {
    const base = "http://127.0.0.1:" + (server.address() as AddressInfo).port;
    const headers = {
      Origin: origin,
      "X-Requested-With": "XMLHttpRequest",
      "X-Forwarded-Proto": "https",
      "X-Forwarded-For": "203.0.113.9, 2001:db8::2, 2001:db8::3",
    };
    expect((await fetch(base + "/direct/login", post(credentials, headers))).status).toBe(403);
    expect(
      (
        await fetch(
          base + "/proxy/login",
          post(credentials, {
            ...headers,
            "X-Forwarded-Proto": "https, http",
          }),
        )
      ).status,
    ).toBe(403);
    expect(login).not.toHaveBeenCalled();
    const response = await fetch(base + "/proxy/login", post(credentials, headers));
    expect(response.status).toBe(401);
    expect(login).toHaveBeenLastCalledWith(
      credentials.email,
      credentials.password,
      response.headers.get("X-Request-Id"),
      "2001:db8::2",
    );
  } finally {
    await new Promise<void>((resolve) => server.close(() => resolve()));
  }
});

it("permite HTTP explícito solo para desarrollo local y emite la cookie sin prefijo seguro", async () => {
  const { createAuthHttpTransport } = await import("../src/auth/http-transport.js");
  const { login, services } = fixture();
  const config = {
    AUTH_PUBLIC_ORIGIN: "http://localhost:5173",
    AUTH_TRUSTED_PROXIES: "127.0.0.1",
    NODE_ENV: "development",
  };
  expect(() =>
    createAuthHttpTransport("cookie", "test", { ...config, NODE_ENV: "production" }),
  ).toThrow("AUTH_PUBLIC_ORIGIN");
  expect(() =>
    createAuthHttpTransport("cookie", "test", {
      ...config,
      AUTH_PUBLIC_ORIGIN: "http://app.example.test",
    }),
  ).toThrow("AUTH_PUBLIC_ORIGIN");
  const warning = vi.spyOn(console, "warn").mockImplementation(() => {});
  let transport;
  try {
    transport = createAuthHttpTransport("cookie", "test", config);
    expect(warning).toHaveBeenCalledOnce();
  } finally {
    warning.mockRestore();
  }
  login.mockResolvedValue("a".repeat(64));
  const server = createAuthHttpApp(services, transport, config).listen(0, "127.0.0.1");
  await once(server, "listening");
  try {
    const url = "http://127.0.0.1:" + (server.address() as AddressInfo).port;
    const response = await fetch(
      url + "/login",
      post(credentials, {
        Origin: config.AUTH_PUBLIC_ORIGIN,
        "X-Requested-With": "XMLHttpRequest",
      }),
    );
    expect(response.status).toBe(204);
    expect(response.headers.get("Set-Cookie")).toMatch(/^test=[a-f0-9]{64};/);
    expect(response.headers.get("Set-Cookie")).toContain("HttpOnly");
    expect(response.headers.get("Set-Cookie")).not.toContain("Secure");

    for (const protocol of ["https", "https, http"]) {
      const proxied = await fetch(
        url + "/login",
        post(credentials, {
          Origin: config.AUTH_PUBLIC_ORIGIN,
          "X-Requested-With": "XMLHttpRequest",
          "X-Forwarded-Proto": protocol,
        }),
      );
      expect(proxied.status).toBe(403);
      expect(proxied.headers.get("Set-Cookie")).toBeNull();
    }
    expect(login).toHaveBeenCalledOnce();
  } finally {
    await new Promise<void>((resolve) => server.close(() => resolve()));
  }
});
