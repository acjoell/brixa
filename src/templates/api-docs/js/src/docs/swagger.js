import swaggerUi from "swagger-ui-express";
import spec from "./openapi.json" with { type: "json" };

export const openapiSpec = spec;

if (!openapiSpec.openapi || !openapiSpec.info || !openapiSpec.paths) {
  throw new Error("Especificación OpenAPI inválida: faltan campos obligatorios (openapi, info, paths).");
}

export function setupApiDocs(app) {
  if (process.env.ENABLE_API_DOCS === "true") {
    // Redirección relativa para /docs sin barra final (compatible con localhost, proxy Vite y nginx)
    app.get("/docs", (_req, res) => {
      res.redirect(301, "docs/");
    });
    app.use("/docs", swaggerUi.serve, swaggerUi.setup(openapiSpec));
  }
}
