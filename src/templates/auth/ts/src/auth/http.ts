import { randomUUID } from "node:crypto";
import { BlockList, isIP } from "node:net";
import express from "express";
import type { ErrorRequestHandler, Request, Response } from "express";
import { z } from "zod";
import { notFoundHandler, parseInput, ValidationError } from "../errors.js";
import type { createAccountActivationService } from "./activate-account.js";
import { Argon2SaturatedError } from "./argon2-limiter.js";
import type { createPasswordChangeService } from "./change-password.js";
import { emailSchema } from "./email.js";
import { LoginRateLimitedError } from "./login.js";
import type { createLoginService } from "./login.js";
import type { createLoginAbuseService } from "./login-abuse.js";
import { ManagedActivationError } from "./managed-activation.js";
import type { createManagedActivationService } from "./managed-activation.js";
import { isPasswordWithinLimits } from "./password-limits.js";
import { tokenDigest } from "./sessions.js";
import type { createSessionService } from "./sessions.js";

type Services = {
  login: Awaited<ReturnType<typeof createLoginService>>;
  sessions: Pick<ReturnType<typeof createSessionService>, "validateSession" | "logout">;
  changePassword: ReturnType<typeof createPasswordChangeService>;
  activation: {
    managed: ReturnType<typeof createManagedActivationService>;
    activateAccount: ReturnType<typeof createAccountActivationService>;
    consumeIp: ReturnType<typeof createLoginAbuseService>["consumeActivationIp"];
    cleanupExpired: ReturnType<typeof createLoginAbuseService>["cleanupExpired"];
    link(token: string): string;
  };
};

export type AuthHttpTransport = {
  protect?: express.RequestHandler;
  readToken(req: Request): unknown;
  establishSession(res: Response, token: string): void | Promise<void>;
  clearSession(res: Response): void | Promise<void>;
};

const password = z.string().min(1).refine(isPasswordWithinLimits);
const credentials = z.strictObject({ email: emailSchema, password });
const registration = z.strictObject({ email: emailSchema });
const activationConfirmation = z.strictObject({ token: z.string(), password });
const activationTarget = z.strictObject({ userId: z.uuid() });
const passwordChange = z.strictObject({ currentPassword: password, newPassword: password });

export function trustProxy(raw: string | undefined) {
  const peers = new BlockList();
  const unspecified = new BlockList();
  unspecified.addAddress("0.0.0.0");
  unspecified.addAddress("::", "ipv6");
  for (const entry of raw === undefined || raw === "" ? [] : raw.split(",")) {
    const address = entry.trim();
    const version = address.includes("%") ? 0 : isIP(address);
    const family = version === 6 ? "ipv6" : "ipv4";
    if (version === 0 || unspecified.check(address, family))
      throw new Error("AUTH_TRUSTED_PROXIES debe contener solo direcciones IP explícitas.");
    peers.addAddress(address, family);
  }
  return (address: string) => {
    const version = isIP(address);
    return version !== 0 && peers.check(address, version === 6 ? "ipv6" : "ipv4");
  };
}

const badRequest = new Error("AUTH_BAD_REQUEST");

function unauthorized(res: Response) {
  res.status(401).json({ error: "Unauthorized" });
}

function clientIp(req: Request): string {
  if (!req.ip || isIP(req.ip) === 0 || req.ip.includes("%")) throw badRequest;
  return req.ip;
}

const handleError: ErrorRequestHandler = (error: unknown, _req, res, next) => {
  if (res.headersSent) {
    next(new Error("AUTH_HTTP_FAILED"));
    return;
  }
  if (
    error === badRequest ||
    error instanceof ValidationError ||
    (error instanceof ManagedActivationError && error.code === "INVALID_INPUT")
  ) {
    res.status(400).json({ error: "Bad Request" });
  } else if (error instanceof ManagedActivationError && error.code === "FORBIDDEN") {
    res.status(403).json({ error: "Forbidden" });
  } else if (error instanceof ManagedActivationError && error.code === "ACCOUNT_NOT_PENDING") {
    res.status(409).json({ error: "Conflict" });
  } else if (error instanceof LoginRateLimitedError) {
    res
      .set("Retry-After", String(error.retryAfterSeconds))
      .status(429)
      .json({ error: "Too Many Requests" });
  } else if (error instanceof Argon2SaturatedError) {
    res.set("Retry-After", "5").status(503).json({ error: "Service Unavailable" });
  } else {
    res.status(500).json({ error: "Internal Server Error" });
  }
};

export function createAuthHttpApp(
  services: Services,
  transport: AuthHttpTransport,
  env: Record<string, string | undefined> = process.env,
) {
  const app = express();
  app.disable("x-powered-by");
  // Explicit policy on the sub-app, independent of the parent app's trust setting.
  app.set("trust proxy", trustProxy(env.AUTH_TRUSTED_PROXIES));
  const parseJson = express.json({ limit: "8kb", inflate: false });
  const json: express.RequestHandler = (req, res, next) => {
    if (!req.is("application/json") || req.body !== undefined) return next(badRequest);
    parseJson(req, res, (error?: unknown) => next(error ? badRequest : undefined));
  };

  const noBody: express.RequestHandler = (req, _res, next) => {
    const length = req.get("Content-Length");
    next(
      req.get("Transfer-Encoding") || (length !== undefined && length !== "0")
        ? badRequest
        : undefined,
    );
  };

  app.use((_req, res, next) => {
    res.set("Cache-Control", "no-store").set("X-Request-Id", randomUUID());
    next();
  });

  if (transport.protect) app.use(transport.protect);

  const requestId = (res: Response) => String(res.getHeader("X-Request-Id"));

  async function authenticated(req: Request, res: Response) {
    const token = transport.readToken(req);
    const userId = tokenDigest(token) ? await services.sessions.validateSession(token) : null;
    if (!userId) {
      unauthorized(res);
      return null;
    }
    return { userId, token };
  }

  app.post("/login", json, async (req, res) => {
    const { email, password } = parseInput(credentials, req.body);
    const token = await services.login(email, password, requestId(res), clientIp(req));
    if (!token) return unauthorized(res);
    await transport.establishSession(res, token);
  });

  app.get("/session", noBody, async (req, res) => {
    const session = await authenticated(req, res);
    if (session) res.json({ userId: session.userId });
  });

  app.post("/logout", noBody, async (req, res) => {
    const session = await authenticated(req, res);
    if (!session) return;
    if (!(await services.sessions.logout(session.token, requestId(res)))) return unauthorized(res);
    await transport.clearSession(res);
    res.status(204).end();
  });

  app.post("/password", json, async (req, res) => {
    const { currentPassword, newPassword } = parseInput(passwordChange, req.body);
    const session = await authenticated(req, res);
    if (!session) return;
    if (
      !(await services.changePassword(session.token, currentPassword, newPassword, requestId(res)))
    )
      return unauthorized(res);
    await transport.clearSession(res);
    res.status(204).end();
  });

  const { activation } = services;

  app.post("/register", json, async (req, res) => {
    const session = await authenticated(req, res);
    if (!session) return;
    const { email } = parseInput(registration, req.body);
    const result = await activation.managed.registerAccount(
      { userId: session.userId, requestId: requestId(res) },
      email,
    );
    if (!result.created) {
      res.json({ created: false, userId: result.userId });
      return;
    }
    res.status(201).json({
      created: true,
      userId: result.userId,
      activationUrl: activation.link(result.token),
      expiresAt: result.expiresAt,
    });
  });

  app.post("/activation/revoke", json, async (req, res) => {
    const session = await authenticated(req, res);
    if (!session) return;
    const { userId } = parseInput(activationTarget, req.body);
    await activation.managed.revokeActivationToken(
      { userId: session.userId, requestId: requestId(res) },
      userId,
    );
    res.status(204).end();
  });

  app.post("/activation/regenerate", json, async (req, res) => {
    const session = await authenticated(req, res);
    if (!session) return;
    const { userId } = parseInput(activationTarget, req.body);
    const result = await activation.managed.regenerateActivationToken(
      { userId: session.userId, requestId: requestId(res) },
      userId,
    );
    res.json({ activationUrl: activation.link(result.token), expiresAt: result.expiresAt });
  });

  app.post(
    "/activate",
    async (req, res, next) => {
      const admission = await activation.consumeIp(clientIp(req));
      if (!admission.accepted) {
        res
          .set("Retry-After", String(Math.max(1, Math.ceil(admission.retryAfterMs / 1000))))
          .status(429)
          .json({ error: "Too Many Requests" });
        return;
      }
      await activation.cleanupExpired();
      next();
    },
    json,
    async (req, res) => {
      const { token, password } = parseInput(activationConfirmation, req.body);
      if (!(await activation.activateAccount(token, password, requestId(res)))) throw badRequest;
      res.status(204).end();
    },
  );

  app.use(notFoundHandler);
  app.use(handleError);
  return app;
}
