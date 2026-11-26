import { URL, URLSearchParams } from "node:url";
import express from "express";
import type { RequestHandler } from "express";
import type { db } from "../db/client.js";
import type { ActivationDatabase } from "../db/activation-write.js";
import {
  createAccountActivationService,
  createActivationValidationService,
} from "./activate-account.js";
import { createPasswordChangeService } from "./change-password.js";
import { createAuthHttpApp } from "./http.js";
import { createAuthHttpTransport, isMutableMethod } from "./http-transport.js";
import { createLoginService } from "./login.js";
import { createLoginAbuseService } from "./login-abuse.js";
import { createManagedActivationService } from "./managed-activation.js";
import { parsePasswordPolicy } from "./password-policy.js";
import { createSessionService } from "./sessions.js";

declare module "express-serve-static-core" {
  interface Request {
    auth?: Readonly<{ userId: string }>;
  }
}

export const authRoutes = express();
authRoutes.disable("x-powered-by");
let docsGuard: RequestHandler | undefined;
let businessAuth:
  | {
      transport: ReturnType<typeof createAuthHttpTransport>;
      sessions: ReturnType<typeof createSessionService>;
    }
  | undefined;

export function requireAuth({
  intentionalActivity = false,
}: { intentionalActivity?: boolean } = {}): RequestHandler {
  return (req, res, next) => {
    res.set("Cache-Control", "no-store");
    const runtime = businessAuth;
    if (!runtime) {
      res.status(503).json({ error: "Service Unavailable" });
      return;
    }

    const internalError = () => res.status(500).json({ error: "Internal Server Error" });
    const authenticate = async () => {
      let userId: string | null;
      try {
        userId = await runtime.sessions.validateSession(
          runtime.transport.readToken(req),
          intentionalActivity === true && isMutableMethod(req.method),
        );
      } catch {
        internalError();
        return;
      }
      if (!userId) {
        res.status(401).json({ error: "Unauthorized" });
        return;
      }
      req.auth = { userId };
      next();
    };

    try {
      runtime.transport.protect(req, res, (error?: unknown) => {
        if (error !== undefined) {
          internalError();
          return;
        }
        void authenticate();
      });
    } catch {
      internalError();
    }
  };
}

export const protectApiDocs: RequestHandler = (req, res, next) => {
  if (docsGuard) return docsGuard(req, res, next);
  res.set("Cache-Control", "no-store").status(503).json({ error: "Service Unavailable" });
};

function activationPage(raw: string | undefined, publicOrigin: string | undefined): URL {
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

export async function initializeAuthHttp(
  mode: "cookie" | "bearer",
  cookieName: string,
  database: typeof db,
  writer: ActivationDatabase,
  env = process.env,
) {
  const transport = createAuthHttpTransport(mode, cookieName, env);
  const passwordPolicy = parsePasswordPolicy(env);
  const page = activationPage(env.ACTIVATION_PAGE_URL, transport.publicOrigin);
  if (mode === "cookie" && page.origin !== transport.publicOrigin)
    throw new Error("ACTIVATION_PAGE_URL debe compartir el origen público en modo cookie.");
  const abuse = createLoginAbuseService(writer, env);
  const sessions = createSessionService(database, env);
  const login = await createLoginService(writer, env);
  const changePassword = createPasswordChangeService(writer, env);
  const activation = {
    managed: createManagedActivationService(writer, env),
    activateAccount: createAccountActivationService(writer, Date.now, passwordPolicy),
    validateToken: createActivationValidationService(writer),
    consumeIp: abuse.consumeActivationIp,
    consumeValidationIp: abuse.consumeActivationValidationIp,
    cleanupExpired: abuse.cleanupExpired,
    link(token: string) {
      const url = new URL(page);
      url.hash = new URLSearchParams({ token }).toString();
      return url.href;
    },
  };
  authRoutes.use(
    createAuthHttpApp(
      { login, sessions, changePassword, activation },
      transport,
      env,
      passwordPolicy,
    ),
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
  businessAuth = { transport, sessions };
}
