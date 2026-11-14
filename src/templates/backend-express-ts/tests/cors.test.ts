import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach } from "vitest";
import type { Server } from "node:http";
import type { AddressInfo } from "node:net";
import { app } from "../src/app.js";
import { parseConfig } from "../src/config.js";

describe("Middleware CORS", () => {
  let server: Server;
  let baseUrl: string;
  let prevEnv: string | undefined;

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

  beforeEach(() => {
    prevEnv = process.env.CORS_ALLOWED_ORIGINS;
  });

  afterEach(() => {
    if (prevEnv !== undefined) {
      process.env.CORS_ALLOWED_ORIGINS = prevEnv;
    } else {
      delete process.env.CORS_ALLOWED_ORIGINS;
    }
  });

  it("1. Sin configuración: no aparecen cabeceras CORS", async () => {
    delete process.env.CORS_ALLOWED_ORIGINS;
    const res = await fetch(`${baseUrl}/health`, {
      headers: { Origin: "http://localhost:5173" },
    });
    expect(res.status).toBe(200);
    expect(res.headers.get("access-control-allow-origin")).toBeNull();
    expect(res.headers.get("vary")).toBeNull();
  });

  it("2. Origen permitido: se emite Access-Control-Allow-Origin con el origen exacto", async () => {
    process.env.CORS_ALLOWED_ORIGINS = "http://localhost:5173, https://app.example.com";
    const res = await fetch(`${baseUrl}/health`, {
      headers: { Origin: "http://localhost:5173" },
    });
    expect(res.status).toBe(200);
    expect(res.headers.get("access-control-allow-origin")).toBe("http://localhost:5173");
  });

  it("3. Origen no permitido: no se emite Access-Control-Allow-Origin y el servidor procesa la respuesta", async () => {
    process.env.CORS_ALLOWED_ORIGINS = "http://localhost:5173";
    const res = await fetch(`${baseUrl}/health`, {
      headers: { Origin: "http://evil.com" },
    });
    expect(res.status).toBe(200);
    expect(res.headers.get("access-control-allow-origin")).toBeNull();
    const body = (await res.json()) as { status: string };
    expect(body).toEqual({ status: "ok" });
  });

  it("4. Origin: null rechazado: no emite Access-Control-Allow-Origin", async () => {
    process.env.CORS_ALLOWED_ORIGINS = "http://localhost:5173";
    const res = await fetch(`${baseUrl}/health`, {
      headers: { Origin: "null" },
    });
    expect(res.status).toBe(200);
    expect(res.headers.get("access-control-allow-origin")).toBeNull();
  });

  it("5. Preflight OPTIONS desde origen permitido: 204 con cabeceras CORS", async () => {
    process.env.CORS_ALLOWED_ORIGINS = "http://localhost:5173";
    const res = await fetch(`${baseUrl}/health`, {
      method: "OPTIONS",
      headers: {
        Origin: "http://localhost:5173",
        "Access-Control-Request-Method": "GET",
      },
    });
    expect(res.status).toBe(204);
    expect(res.headers.get("access-control-allow-origin")).toBe("http://localhost:5173");
    expect(res.headers.get("access-control-allow-methods")).toContain("GET");
  });

  it("6. Preflight OPTIONS desde origen no permitido: no emite Access-Control-Allow-Origin", async () => {
    process.env.CORS_ALLOWED_ORIGINS = "http://localhost:5173";
    const res = await fetch(`${baseUrl}/health`, {
      method: "OPTIONS",
      headers: {
        Origin: "http://evil.com",
        "Access-Control-Request-Method": "GET",
      },
    });
    expect(res.headers.get("access-control-allow-origin")).toBeNull();
  });

  it("7. Vary: Origin está presente cuando se responde a un origen permitido", async () => {
    process.env.CORS_ALLOWED_ORIGINS = "http://localhost:5173";
    const res = await fetch(`${baseUrl}/health`, {
      headers: { Origin: "http://localhost:5173" },
    });
    expect(res.headers.get("vary")).toContain("Origin");
  });

  it("8. Solicitud sin cabecera Origin se procesa normalmente sin cabecera Access-Control-Allow-Origin", async () => {
    process.env.CORS_ALLOWED_ORIGINS = "http://localhost:5173";
    const res = await fetch(`${baseUrl}/health`);
    expect(res.status).toBe(200);
    expect(res.headers.get("access-control-allow-origin")).toBeNull();
    const body = (await res.json()) as { status: string };
    expect(body).toEqual({ status: "ok" });
  });

  it("9. Rechazo de comodines en configuración", () => {
    expect(() => parseConfig({ CORS_ALLOWED_ORIGINS: "*" })).toThrow();
    expect(() => parseConfig({ CORS_ALLOWED_ORIGINS: "http://*" })).toThrow();
  });

  it("10. Ausencia de Access-Control-Allow-Credentials por defecto", async () => {
    process.env.CORS_ALLOWED_ORIGINS = "http://localhost:5173";
    const res = await fetch(`${baseUrl}/health`, {
      headers: { Origin: "http://localhost:5173" },
    });
    expect(res.headers.get("access-control-allow-credentials")).toBeNull();
  });
});
