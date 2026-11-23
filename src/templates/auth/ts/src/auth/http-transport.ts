import { BlockList } from "node:net";
import { TLSSocket } from "node:tls";
import { URL } from "node:url";
import type { Request } from "express";
import { z } from "zod";
import { corsAllowedOriginsSchema, formatConfigError } from "../config.js";
import { trustProxy } from "./http.js";
import type { AuthHttpTransport } from "./http.js";
import { parseSessionConfig } from "./session-config.js";

const loopback = new Set(["localhost", "127.0.0.1"]);
const localPeers = new BlockList();
localPeers.addAddress("127.0.0.1");
localPeers.addAddress("::1", "ipv6");
const configSchema = z
  .object({
    AUTH_PUBLIC_ORIGIN: corsAllowedOriginsSchema.pipe(z.array(z.string()).max(1)),
    CORS_ALLOWED_ORIGINS: corsAllowedOriginsSchema,
    NODE_ENV: z.string().optional(),
  })
  .superRefine(({ AUTH_PUBLIC_ORIGIN: [origin], NODE_ENV }, ctx) => {
    if (
      origin?.startsWith("http:") &&
      (NODE_ENV !== "development" || !loopback.has(new URL(origin).hostname))
    ) {
      ctx.addIssue({
        code: "custom",
        path: ["AUTH_PUBLIC_ORIGIN"],
        message: "HTTP solo se admite sobre localhost o 127.0.0.1 en development.",
      });
    }
  });

function header(req: Request, name: string): string | null | undefined {
  const values = req.headersDistinct[name];
  return values?.length === 1 ? values[0] : values ? null : undefined;
}

function refererOrigin(referer: string | null | undefined) {
  try {
    return referer ? new URL(referer).origin : undefined;
  } catch {
    return undefined;
  }
}

function checkCsrf(req: Request, origins: ReadonlySet<string>) {
  const suppliedOrigin = header(req, "origin");
  const origin =
    suppliedOrigin === undefined ? refererOrigin(header(req, "referer")) : suppliedOrigin;
  const site = header(req, "sec-fetch-site");
  const mode = header(req, "sec-fetch-mode");
  const destination = header(req, "sec-fetch-dest");
  return (
    typeof origin === "string" &&
    origins.has(origin) &&
    header(req, "x-requested-with") === "XMLHttpRequest" &&
    (site === undefined || site === "same-origin" || site === "same-site") &&
    (mode === undefined || mode === "cors" || mode === "same-origin") &&
    (destination === undefined || destination === "empty")
  );
}

export function createAuthHttpTransport(
  mode: "cookie" | "bearer",
  cookieName: string,
  env: NodeJS.ProcessEnv,
): AuthHttpTransport & { protect: NonNullable<AuthHttpTransport["protect"]> } {
  const result = configSchema.safeParse(env);
  if (!result.success) {
    throw formatConfigError(String(result.error.issues[0].path[0]), result.error);
  }
  const origin = result.data.AUTH_PUBLIC_ORIGIN.at(0);
  if (mode === "cookie" && !origin)
    throw new Error("AUTH_PUBLIC_ORIGIN es obligatorio con cookies.");

  const localHttp = origin?.startsWith("http:") ?? false;
  if (localHttp) console.warn("Auth: HTTP local habilitado para desarrollo.");
  const trusted = trustProxy(env.AUTH_TRUSTED_PROXIES);
  const origins = new Set(result.data.CORS_ALLOWED_ORIGINS);
  if (origin) origins.add(origin);
  const cookieOptions = {
    httpOnly: true,
    secure: !localHttp,
    sameSite: "lax" as const,
    path: "/",
  };
  const name = localHttp ? cookieName : "__Host-" + cookieName;
  const maxAge = Math.min(parseSessionConfig(env).lifetimeMs, 8e15);

  function sessionCookies(req: Request) {
    return (req.headersDistinct.cookie ?? [])
      .flatMap((line) => line.split(";"))
      .map((part) => part.trim().split(/=(.*)/s, 2))
      .filter(([key]) => key?.trim() === cookieName || key?.trim() === "__Host-" + cookieName);
  }

  return {
    protect(req, res, next) {
      const socket = req.socket;
      const forwardedProto =
        socket.remoteAddress && trusted(socket.remoteAddress)
          ? header(req, "x-forwarded-proto")
          : undefined;
      const https = (socket instanceof TLSSocket && socket.encrypted) || forwardedProto === "https";
      // The loopback Host is checked independently of forwarded host/proto.
      const host = header(req, "host");
      const development =
        localHttp &&
        !https &&
        forwardedProto === undefined &&
        socket.remoteAddress &&
        localPeers.check(socket.remoteAddress, socket.remoteFamily === "IPv6" ? "ipv6" : "ipv4") &&
        typeof host === "string" &&
        /^(localhost|127\.0\.0\.1)(:[0-9]+)?$/.test(host);
      const mutable = !["GET", "HEAD", "OPTIONS"].includes(req.method);
      if (
        !(localHttp ? development : https) ||
        (mode === "cookie" && mutable && !checkCsrf(req, origins))
      ) {
        res.status(403).json({ error: "Forbidden" });
        return;
      }

      const authorization = header(req, "authorization");
      const cookies = sessionCookies(req);
      if (
        (mode === "cookie" && (authorization !== undefined || cookies.length > 1)) ||
        (mode === "bearer" &&
          (cookies.length > 0 ||
            (authorization !== undefined &&
              (authorization === null ||
                authorization.length !== 71 ||
                authorization.slice(0, 7).toLowerCase() !== "bearer " ||
                /[^0-9a-f]/.test(authorization.slice(7))))))
      ) {
        res.status(401).json({ error: "Unauthorized" });
        return;
      }
      next();
    },
    readToken(req) {
      if (mode === "bearer") return header(req, "authorization")?.slice(7);
      const cookies = sessionCookies(req);
      return cookies.length === 1 && cookies[0][0] === name ? cookies[0][1] : undefined;
    },
    establishSession(res, token) {
      if (mode === "cookie") {
        res
          .cookie(name, token, { ...cookieOptions, maxAge })
          .status(204)
          .end();
      } else {
        res.json({ token });
      }
    },
    clearSession(res) {
      if (mode === "cookie") res.clearCookie(name, cookieOptions);
    },
  };
}
