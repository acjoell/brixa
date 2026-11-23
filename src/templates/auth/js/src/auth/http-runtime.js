import { URL, URLSearchParams } from "node:url";
import express from "express";

import { createAccountActivationService } from "./activate-account.js";
import { createPasswordChangeService } from "./change-password.js";
import { createAuthHttpApp } from "./http.js";
import { createAuthHttpTransport } from "./http-transport.js";
import { createLoginService } from "./login.js";
import { createLoginAbuseService } from "./login-abuse.js";
import { createManagedActivationService } from "./managed-activation.js";
import { createSessionService } from "./sessions.js";

export const authRoutes = express();
let docsGuard;

export const protectApiDocs = (req, res, next) => {
  if (docsGuard) return docsGuard(req, res, next);
  res.set("Cache-Control", "no-store").status(503).json({ error: "Service Unavailable" });
};

function activationPage(raw, publicOrigin) {
  try {
    if (raw && !raw.includes("?") && !raw.includes("#")) {
      const url = new URL(raw);
      if (
        !url.username &&
        !url.password &&
        (url.protocol === "https:" || (url.protocol === "http:" && url.origin === publicOrigin))
      )
        return url;
    }
  } catch {
    // Keep configuration errors free of URL contents.
  }
  throw new Error(
    "ACTIVATION_PAGE_URL debe indicar una URL HTTPS sin credenciales, query ni fragmento (HTTP solo en el origen local de desarrollo).",
  );
}

export async function initializeAuthHttp(mode, cookieName, database, writer, env = process.env) {
  const transport = createAuthHttpTransport(mode, cookieName, env);
  const page = activationPage(env.ACTIVATION_PAGE_URL, transport.publicOrigin);
  if (mode === "cookie" && page.origin !== transport.publicOrigin)
    throw new Error("ACTIVATION_PAGE_URL debe compartir el origen público en modo cookie.");
  const abuse = createLoginAbuseService(writer, env);
  const sessions = createSessionService(database, env);
  const login = await createLoginService(writer, env);
  const changePassword = createPasswordChangeService(writer, env);
  const activation = {
    managed: createManagedActivationService(writer, env),
    activateAccount: createAccountActivationService(writer),
    consumeIp: abuse.consumeActivationIp,
    cleanupExpired: abuse.cleanupExpired,
    link(token) {
      const url = new URL(page);
      url.hash = new URLSearchParams({ token }).toString();
      return url.href;
    },
  };
  authRoutes.use(
    createAuthHttpApp({ login, sessions, changePassword, activation }, transport, env),
  );
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
