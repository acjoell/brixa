import { describe, it, expect, beforeAll, afterAll } from "vitest";
import type { Server } from "node:http";
import type { AddressInfo } from "node:net";
import { app } from "../src/app.js";

describe("GET /health", () => {
  let server: Server;
  let baseUrl: string;

  beforeAll(async () => {
    await new Promise<void>((resolve) => {
      server = app.listen(0, () => {
        const address = server.address() as AddressInfo;
        baseUrl = `http://127.0.0.1:${address.port}`;
        resolve();
      });
    });
  });

  afterAll(async () => {
    await new Promise<void>((resolve, reject) => {
      server.close((err) => (err ? reject(err) : resolve()));
    });
  });

  it("responde con código 200", async () => {
    const res = await fetch(`${baseUrl}/health`);
    expect(res.status).toBe(200);
  });

  it("responde con content-type application/json", async () => {
    const res = await fetch(`${baseUrl}/health`);
    expect(res.headers.get("content-type")).toContain("application/json");
  });

  it("devuelve el cuerpo { status: 'ok' }", async () => {
    const res = await fetch(`${baseUrl}/health`);
    const body = (await res.json()) as { status: string };
    expect(body).toEqual({ status: "ok" });
  });

  it("no incluye la cabecera x-powered-by", async () => {
    const res = await fetch(`${baseUrl}/health`);
    expect(res.headers.get("x-powered-by")).toBeNull();
  });

  it("emite cabeceras de seguridad de Helmet con CSP restrictiva y sin HSTS", async () => {
    const res = await fetch(`${baseUrl}/health`);
    expect(res.headers.get("content-security-policy")).toBe(
      "default-src 'none';base-uri 'none';frame-ancestors 'none';form-action 'none'",
    );
    expect(res.headers.get("content-security-policy")).not.toContain("upgrade-insecure-requests");
    expect(res.headers.get("strict-transport-security")).toBeNull();
    expect(res.headers.get("x-content-type-options")).toBe("nosniff");
    expect(res.headers.get("x-frame-options")).toBe("SAMEORIGIN");
    expect(res.headers.get("referrer-policy")).toBe("no-referrer");
  });
});
