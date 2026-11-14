import helmet from "helmet";
import swaggerUi from "swagger-ui-express";
import spec from "./openapi.json" with { type: "json" };

export const openapiSpec = spec;

if (!openapiSpec.openapi || !openapiSpec.info || !openapiSpec.paths) {
  throw new Error(
    "Especificación OpenAPI inválida: faltan campos obligatorios (openapi, info, paths).",
  );
}

export function setupApiDocs(app) {
  if (process.env.ENABLE_API_DOCS === "true") {
    const swaggerCsp = helmet.contentSecurityPolicy({
      useDefaults: false,
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'"],
        imgSrc: ["'self'", "data:"],
        connectSrc: ["'self'"],
        fontSrc: ["'self'", "data:"],
        baseUri: ["'self'"],
        formAction: ["'self'"],
        frameAncestors: ["'none'"],
      },
    });

    app.use("/docs", swaggerCsp);

    // Redirección relativa para /docs sin barra final (compatible con localhost, proxy Vite y nginx)
    app.get("/docs", (req, res, next) => {
      if (!req.path.endsWith("/")) {
        const qIndex = req.originalUrl.indexOf("?");
        const query = qIndex !== -1 ? req.originalUrl.slice(qIndex) : "";
        return res.redirect(301, "docs/" + query);
      }
      next();
    });
    app.use(
      "/docs",
      swaggerUi.serve,
      swaggerUi.setup(openapiSpec, {
        swaggerOptions: { validatorUrl: null },
      }),
    );
  }
}
