import type { Express, Request, Response } from "express";
import swaggerUi from "swagger-ui-express";
import spec from "./openapi.json" with { type: "json" };

export interface OpenApiSpec {
  openapi: string;
  info: { title: string; version: string; description?: string };
  paths: Record<string, Record<string, unknown>>;
  [key: string]: unknown;
}

export const openapiSpec: OpenApiSpec = spec as unknown as OpenApiSpec;

if (!openapiSpec.openapi || !openapiSpec.info || !openapiSpec.paths) {
  throw new Error("Especificación OpenAPI inválida: faltan campos obligatorios (openapi, info, paths).");
}

export function setupApiDocs(app: Express): void {
  if (process.env.ENABLE_API_DOCS === "true") {
    // Redirección relativa para /docs sin barra final (compatible con localhost, proxy Vite y nginx)
    app.get("/docs", (_req: Request, res: Response) => {
      res.redirect(301, "docs/");
    });
    app.use("/docs", swaggerUi.serve, swaggerUi.setup(openapiSpec));
  }
}
