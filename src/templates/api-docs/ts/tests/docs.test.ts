import { describe, it, expect } from "vitest";
import type { AddressInfo } from "node:net";
import express from "express";
import { app } from "../src/app.js";
import { openapiSpec, setupApiDocs } from "../src/docs/swagger.js";

describe("Documentación de API", () => {
  // Nota: app.router.stack (o app._router.stack) es una propiedad interna de Express para inspeccionar capas de enrutamiento.
  it("las rutas registradas en Express coinciden con las documentadas en la especificación", () => {
    const router = (
      app as unknown as {
        router?: { stack: Array<{ route?: { path: string; methods: Record<string, boolean> } }> };
      }
    ).router;
    const stack = router?.stack ?? [];
    const registeredRoutes: Array<{ path: string; method: string }> = [];

    for (const layer of stack) {
      if (layer.route && layer.route.path !== "/docs") {
        for (const method of Object.keys(layer.route.methods)) {
          registeredRoutes.push({ path: layer.route.path, method: method.toLowerCase() });
        }
      }
    }

    expect(registeredRoutes.length).toBeGreaterThan(0);
    for (const route of registeredRoutes) {
      const docPath = openapiSpec.paths[route.path] as Record<string, unknown> | undefined;
      expect(docPath, `Ruta "${route.path}" no está documentada en openapi.json`).toBeDefined();
      expect(
        docPath?.[route.method],
        `Método "${route.method.toUpperCase()} ${route.path}" no está documentado en openapi.json`,
      ).toBeDefined();
    }
  });

  it("con ENABLE_API_DOCS=false devuelve 404 en /docs y /docs/", async () => {
    const prevEnv = process.env.ENABLE_API_DOCS;
    process.env.ENABLE_API_DOCS = "false";
    const testApp = express();
    testApp.get("/health", (_req, res) => {
      res.status(200).json({ status: "ok" });
    });
    setupApiDocs(testApp);
    const testServer = testApp.listen(0);
    const port = (testServer.address() as AddressInfo).port;

    try {
      const resNoVar = await fetch(`http://127.0.0.1:${port}/docs`, { redirect: "manual" });
      expect(resNoVar.status).toBe(404);
      const resNoVarSlash = await fetch(`http://127.0.0.1:${port}/docs/`, { redirect: "manual" });
      expect(resNoVarSlash.status).toBe(404);
    } finally {
      if (prevEnv !== undefined) {
        process.env.ENABLE_API_DOCS = prevEnv;
      } else {
        delete process.env.ENABLE_API_DOCS;
      }
      await new Promise<void>((resolve) => testServer.close(() => resolve()));
    }
  });

  it("con ENABLE_API_DOCS=true: /docs devuelve 301 con Location docs/ y /docs/ devuelve 200 directo sin redirección", async () => {
    const prevEnv = process.env.ENABLE_API_DOCS;
    process.env.ENABLE_API_DOCS = "true";
    const testApp = express();
    testApp.get("/health", (_req, res) => {
      res.status(200).json({ status: "ok" });
    });
    setupApiDocs(testApp);
    const testServer = testApp.listen(0);
    const port = (testServer.address() as AddressInfo).port;

    try {
      const resRedirect = await fetch(`http://127.0.0.1:${port}/docs`, { redirect: "manual" });
      expect(resRedirect.status).toBe(301);
      expect(resRedirect.headers.get("location")).toBe("docs/");

      const resDocsSlash = await fetch(`http://127.0.0.1:${port}/docs/`, { redirect: "manual" });
      expect(resDocsSlash.status).toBe(200);
      expect(resDocsSlash.headers.get("location")).toBeNull();
      expect(await resDocsSlash.text()).toContain("swagger-ui");
    } finally {
      if (prevEnv !== undefined) {
        process.env.ENABLE_API_DOCS = prevEnv;
      } else {
        delete process.env.ENABLE_API_DOCS;
      }
      await new Promise<void>((resolve) => testServer.close(() => resolve()));
    }
  });

  it("validateApiDocsEnv acepta undefined, 'true' y 'false', y rechaza valores inválidos sin exponerlos", async () => {
    const { validateApiDocsEnv } = await import("../src/docs/validate-env.js");

    expect(() => validateApiDocsEnv(undefined)).not.toThrow();
    expect(() => validateApiDocsEnv("true")).not.toThrow();
    expect(() => validateApiDocsEnv("false")).not.toThrow();

    const secretVal = "supersecret123";
    let thrown: Error | undefined;
    try {
      validateApiDocsEnv(secretVal);
    } catch (e) {
      thrown = e as Error;
    }

    expect(thrown).toBeDefined();
    expect(thrown?.message).toContain("ENABLE_API_DOCS");
    expect(thrown?.message).not.toContain(secretVal);
  });
});
