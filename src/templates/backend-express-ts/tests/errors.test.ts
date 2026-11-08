import { describe, it, expect, beforeAll, afterAll, vi } from "vitest";
import type { Server } from "node:http";
import type { AddressInfo } from "node:net";
import express, { type Request, type Response, type NextFunction } from "express";
import { z } from "zod";
import { app } from "../src/app.js";
import { ValidationError, parseInput, notFoundHandler, errorHandler } from "../src/errors.js";

describe("Contrato de errores centralizado y validación", () => {
  let mainServer: Server;
  let mainBaseUrl: string;

  let testServer: Server;
  let testBaseUrl: string;

  beforeAll(async () => {
    // 1. Servidor con la app principal
    await new Promise<void>((resolve) => {
      mainServer = app.listen(0, () => {
        const address = mainServer.address() as AddressInfo;
        mainBaseUrl = `http://127.0.0.1:${address.port}`;
        resolve();
      });
    });

    // 2. Servidor auxiliar para probar errores específicos de ruta
    const testApp = express();
    testApp.use(express.json());

    testApp.get("/error-generico", () => {
      throw new Error("Fallo interno con postgresql://usuario:clave_secreta@localhost:5432/bd");
    });

    testApp.get("/error-validation", () => {
      throw new ValidationError([{ path: "email", code: "invalid_type" }]);
    });

    testApp.get("/error-zod-interno", () => {
      z.string().parse(123);
    });

    testApp.get("/error-401", (_req: Request, _res: Response, next: NextFunction) => {
      const err = new Error("No autenticado") as Error & { status: number };
      err.status = 401;
      next(err);
    });

    testApp.get("/error-403", (_req: Request, _res: Response, next: NextFunction) => {
      const err = new Error("No permitido") as Error & { status: number };
      err.status = 403;
      next(err);
    });

    testApp.use(notFoundHandler);
    testApp.use(errorHandler);

    await new Promise<void>((resolve) => {
      testServer = testApp.listen(0, () => {
        const address = testServer.address() as AddressInfo;
        testBaseUrl = `http://127.0.0.1:${address.port}`;
        resolve();
      });
    });
  });

  afterAll(async () => {
    await new Promise<void>((resolve, reject) => {
      mainServer.close((err) => (err ? reject(err) : resolve()));
    });
    await new Promise<void>((resolve, reject) => {
      testServer.close((err) => (err ? reject(err) : resolve()));
    });
  });

  it("JSON roto en el body → 400 sin err.message", async () => {
    const res = await fetch(`${mainBaseUrl}/health`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: "{\ninvalid json",
    });

    expect(res.status).toBe(400);
    const body = (await res.json()) as { error: string; message?: string };
    expect(body).toEqual({ error: "Bad Request" });
    expect(body.message).toBeUndefined();
  });

  it("body demasiado grande → 413 con texto fijo", async () => {
    const largePayload = JSON.stringify({ data: "a".repeat(110 * 1024) });
    const res = await fetch(`${mainBaseUrl}/health`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: largePayload,
    });

    expect(res.status).toBe(413);
    const body = (await res.json()) as { error: string };
    expect(body).toEqual({ error: "Payload Too Large" });
  });

  it("ruta inexistente → 404 JSON", async () => {
    const res = await fetch(`${mainBaseUrl}/ruta-que-no-existe`);
    expect(res.status).toBe(404);
    expect(res.headers.get("content-type")).toContain("application/json");
    const body = (await res.json()) as { error: string };
    expect(body).toEqual({ error: "Not Found" });
  });

  it("error genérico → 500 sin detalles", async () => {
    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    try {
      const res = await fetch(`${testBaseUrl}/error-generico`);
      expect(res.status).toBe(500);
      const body = (await res.json()) as { error: string; message?: string };
      expect(body).toEqual({ error: "Internal Server Error" });
      expect(body.message).toBeUndefined();
    } finally {
      consoleSpy.mockRestore();
    }
  });

  it("ValidationError → 400 con path y code y sin valores", async () => {
    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    try {
      const res = await fetch(`${testBaseUrl}/error-validation`);
      expect(res.status).toBe(400);
      const body = (await res.json()) as {
        error: string;
        details: Array<{ path: string; code: string }>;
      };
      expect(body).toEqual({
        error: "Bad Request",
        details: [{ path: "email", code: "invalid_type" }],
      });
      expect(body.details[0]).toHaveProperty("path", "email");
      expect(body.details[0]).toHaveProperty("code", "invalid_type");
      expect(body.details[0]).not.toHaveProperty("value");
    } finally {
      consoleSpy.mockRestore();
    }
  });

  it("ZodError interno → 500, no 400", async () => {
    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    try {
      const res = await fetch(`${testBaseUrl}/error-zod-interno`);
      expect(res.status).toBe(500);
      const body = (await res.json()) as { error: string };
      expect(body).toEqual({ error: "Internal Server Error" });
    } finally {
      consoleSpy.mockRestore();
    }
  });

  it("errores 401 y 403 conservan su código y usan texto fijo", async () => {
    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    try {
      const res401 = await fetch(`${testBaseUrl}/error-401`);
      expect(res401.status).toBe(401);
      expect(await res401.json()).toEqual({ error: "Unauthorized" });

      const res403 = await fetch(`${testBaseUrl}/error-403`);
      expect(res403.status).toBe(403);
      expect(await res403.json()).toEqual({ error: "Forbidden" });
    } finally {
      consoleSpy.mockRestore();
    }
  });

  it("redacción: credenciales sensibles no aparecen en la respuesta ni en console.error", async () => {
    let capturedLog = "";
    const consoleSpy = vi.spyOn(console, "error").mockImplementation((msg) => {
      capturedLog += String(msg);
    });

    try {
      const res = await fetch(`${testBaseUrl}/error-generico`);
      const bodyText = await res.text();

      expect(bodyText).not.toContain("clave_secreta");
      expect(capturedLog).not.toContain("clave_secreta");
      expect(capturedLog).toContain("***:***@");
    } finally {
      consoleSpy.mockRestore();
    }
  });

  it("propiedades desconocidas: strictObject rechaza y query descarta", () => {
    // 1. body/params con z.strictObject rechaza propiedades desconocidas
    const bodySchema = z.strictObject({
      username: z.string(),
    });

    expect(() => parseInput(bodySchema, { username: "ada", extraProp: "secreto123" })).toThrow(
      ValidationError,
    );

    try {
      parseInput(bodySchema, { username: "ada", extraProp: "secreto123" });
    } catch (err) {
      const valErr = err as ValidationError;
      expect(valErr.details).toEqual([{ path: "extraProp", code: "unrecognized_keys" }]);
      expect(JSON.stringify(valErr.details)).not.toContain("secreto123");
    }

    // 2. query con z.object descarta propiedades desconocidas
    const querySchema = z.object({
      filter: z.string().optional(),
    });

    const parsedQuery = parseInput(querySchema, {
      filter: "active",
      unexpectedParam: "ignored",
    });

    expect(parsedQuery).toEqual({ filter: "active" });
    expect(parsedQuery).not.toHaveProperty("unexpectedParam");
  });

  it("si res.headersSent es true delega con next(err) antes de responder", () => {
    const nextSpy = vi.fn();
    const mockRes = {
      headersSent: true,
      status: vi.fn(),
      json: vi.fn(),
    } as unknown as Response;
    const err = new Error("Cabeceras ya enviadas");

    errorHandler(err, {} as Request, mockRes, nextSpy);

    expect(nextSpy).toHaveBeenCalledWith(err);
    expect(mockRes.status).not.toHaveBeenCalled();
  });
});
