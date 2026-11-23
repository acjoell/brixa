import express from "express";
import type { RequestHandler } from "express";
import type { db } from "../db/client.js";
import type { ActivationDatabase } from "../db/activation-write.js";
import { createPasswordChangeService } from "./change-password.js";
import { createAuthHttpApp } from "./http.js";
import { createAuthHttpTransport } from "./http-transport.js";
import { createLoginService } from "./login.js";
import { createSessionService } from "./sessions.js";

export const authRoutes = express();
let docsGuard: RequestHandler | undefined;

export const protectApiDocs: RequestHandler = (req, res, next) => {
  if (docsGuard) return docsGuard(req, res, next);
  res.set("Cache-Control", "no-store").status(503).json({ error: "Service Unavailable" });
};

export async function initializeAuthHttp(
  mode: "cookie" | "bearer",
  cookieName: string,
  database: typeof db,
  writer: ActivationDatabase,
  env = process.env,
) {
  const transport = createAuthHttpTransport(mode, cookieName, env);
  const sessions = createSessionService(database, env);
  const login = await createLoginService(writer, env);
  const changePassword = createPasswordChangeService(writer, env);
  authRoutes.use(createAuthHttpApp({ login, sessions, changePassword }, transport, env));
  docsGuard = express.Router().use(
    (_req, res, next) => {
      res.set("Cache-Control", "no-store");
      next();
    },
    transport.protect,
    async (req, res, next) => {
      try {
        if (!(await sessions.validateSession(transport.readToken(req)))) {
          res.status(401).json({ error: "Unauthorized" });
          return;
        }
      } catch {
        res.status(500).json({ error: "Internal Server Error" });
        return;
      }
      next();
    },
  );
}
