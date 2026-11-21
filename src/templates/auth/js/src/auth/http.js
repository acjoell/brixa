import { randomUUID } from "node:crypto";
import { BlockList, isIP } from "node:net";
import express from "express";

import { z } from "zod";
import { notFoundHandler, parseInput, ValidationError } from "../errors.js";
import { Argon2SaturatedError } from "./argon2-limiter.js";

import { emailSchema } from "./email.js";
import { LoginRateLimitedError } from "./login.js";

import { isPasswordWithinLimits } from "./password-limits.js";
import { tokenDigest } from "./sessions.js";

// The selected transport supplies session delivery and proof extraction in ⑤-E.

const password = z.string().min(1).refine(isPasswordWithinLimits);
const credentials = z.strictObject({ email: emailSchema, password });
const passwordChange = z.strictObject({ currentPassword: password, newPassword: password });

function trustProxy(raw) {
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
  return (address) => {
    const version = isIP(address);
    return version !== 0 && peers.check(address, version === 6 ? "ipv6" : "ipv4");
  };
}

const badRequest = new Error("AUTH_BAD_REQUEST");

function unauthorized(res) {
  res.status(401).json({ error: "Unauthorized" });
}

const handleError = (error, _req, res, next) => {
  if (res.headersSent) {
    next(new Error("AUTH_HTTP_FAILED"));
    return;
  }
  if (error === badRequest || error instanceof ValidationError) {
    res.status(400).json({ error: "Bad Request" });
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

export function createAuthHttpApp(services, transport, env = process.env) {
  const app = express();
  app.disable("x-powered-by");
  // Explicit policy on the sub-app, independent of the parent app's trust setting.
  app.set("trust proxy", trustProxy(env.AUTH_TRUSTED_PROXIES));
  const parseJson = express.json({ limit: "8kb", inflate: false });
  const json = (req, res, next) => {
    if (!req.is("application/json") || req.body !== undefined) return next(badRequest);
    parseJson(req, res, (error) => next(error ? badRequest : undefined));
  };

  const noBody = (req, _res, next) => {
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

  const requestId = (res) => String(res.getHeader("X-Request-Id"));

  async function authenticated(req, res) {
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
    if (!req.ip || isIP(req.ip) === 0 || req.ip.includes("%")) throw badRequest;
    const token = await services.login(email, password, requestId(res), req.ip);
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

  app.use(notFoundHandler);
  app.use(handleError);
  return app;
}
