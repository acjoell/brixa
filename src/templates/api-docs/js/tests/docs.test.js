import { describe, it, expect, beforeAll, afterAll } from "vitest";
import express from "express";
import { app } from "../src/app.js";
import { openapiSpec, setupApiDocs } from "../src/docs/swagger.js";

describe("Documentación de API", () => {
  let server;
  let baseUrl;

  beforeAll(async () => {
    await new Promise((resolve) => {
      server = app.listen(0, () => {
        const address = server.address();
        baseUrl = `http://127.0.0.1:${address.port}`;
        resolve();
      });
    });
  });

  afterAll(async () => {
    await new Promise((resolve, reject) => {
      server.close((err) => (err ? reject(err) : resolve()));
    });
  });

  // Nota: app.router.stack (o app._router.stack) es una propiedad interna de Express para inspeccionar capas de enrutamiento.
  it("las rutas registradas en Express coinciden con las documentadas en la especificación", () => {
    const router = app.router;
    const stack = router?.stack ?? [];
    const registeredRoutes = [];

    for (const layer of stack) {
      if (layer.route && layer.route.path !== "/docs") {
        for (const method of Object.keys(layer.route.methods)) {
          registeredRoutes.push({ path: layer.route.path, method: method.toLowerCase() });
        }
      }
    }

    expect(registeredRoutes.length).toBeGreaterThan(0);
    for (const route of registeredRoutes) {
      const docPath = openapiSpec.paths[route.path];
      expect(docPath, `Ruta "${route.path}" no está documentada en openapi.json`).toBeDefined();
      expect(docPath?.[route.method], `Método "${route.method.toUpperCase()} ${route.path}" no está documentado en openapi.json`).toBeDefined();
    }
  });

  it("con ENABLE_API_DOCS sin definir devuelve 404, y con true responde con redirección relativa a docs/ y sirve la interfaz en /docs/", async () => {
    // 1. Sin variable definida: /docs y /docs/ devuelven 404
    const resNoVar = await fetch(`${baseUrl}/docs`);
    expect(resNoVar.status).toBe(404);
    const resNoVarSlash = await fetch(`${baseUrl}/docs/`);
    expect(resNoVarSlash.status).toBe(404);

    // 2. Con ENABLE_API_DOCS="true": /docs redirige relativamente a docs/ y /docs/ responde 200
    const prevEnv = process.env.ENABLE_API_DOCS;
    process.env.ENABLE_API_DOCS = "true";
    const testApp = express();
    setupApiDocs(testApp);
    const testServer = testApp.listen(0);
    const port = testServer.address().port;

    try {
      const resRedirect = await fetch(`http://127.0.0.1:${port}/docs`, { redirect: "manual" });
      expect(resRedirect.status).toBe(301);
      expect(resRedirect.headers.get("location")).toBe("docs/");

      const resDocsSlash = await fetch(`http://127.0.0.1:${port}/docs/`);
      expect(resDocsSlash.status).toBe(200);
      expect(await resDocsSlash.text()).toContain("swagger-ui");
    } finally {
      if (prevEnv !== undefined) {
        process.env.ENABLE_API_DOCS = prevEnv;
      } else {
        delete process.env.ENABLE_API_DOCS;
      }
      await new Promise((resolve) => testServer.close(() => resolve()));
    }
  });
});
