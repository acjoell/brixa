import express from "express";
import helmet from "helmet";
import cors from "cors";
import { parseConfig } from "./config.js";
// @@INSERT:imports@@
import { errorHandler, notFoundHandler } from "./errors.js";

try {
  process.loadEnvFile();
} catch (err) {
  if (err.code !== "ENOENT") {
    throw err;
  }
}

export const app = express();

app.disable("x-powered-by");

app.use(
  helmet({
    contentSecurityPolicy: {
      useDefaults: false,
      directives: {
        defaultSrc: ["'none'"],
        baseUri: ["'none'"],
        frameAncestors: ["'none'"],
        formAction: ["'none'"],
      },
    },
    hsts: false,
  }),
);

let cachedCorsRaw = Symbol("initial");
let cachedCorsMiddleware = null;

function getCorsMiddleware() {
  const raw = process.env.CORS_ALLOWED_ORIGINS;
  if (raw === cachedCorsRaw) {
    return cachedCorsMiddleware;
  }
  cachedCorsRaw = raw;
  const config = parseConfig(process.env);
  if (config.corsAllowedOrigins.length === 0) {
    cachedCorsMiddleware = null;
    return null;
  }
  cachedCorsMiddleware = cors({ origin: config.corsAllowedOrigins });
  return cachedCorsMiddleware;
}

app.use((req, res, next) => {
  const corsMiddleware = getCorsMiddleware();
  if (!corsMiddleware) {
    return next();
  }
  return corsMiddleware(req, res, next);
});

app.use(express.json({ limit: "100kb" }));

app.get("/health", (_req, res) => {
  res.status(200).json({ status: "ok" });
});

// @@INSERT:routes@@
app.use(notFoundHandler);
app.use(errorHandler);
