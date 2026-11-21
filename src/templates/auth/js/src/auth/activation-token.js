import { Buffer } from "node:buffer";
import { createHash, randomBytes } from "node:crypto";

export function generateActivationToken() {
  return randomBytes(32).toString("base64url");
}

export function isCanonicalActivationToken(value) {
  if (typeof value !== "string" || value.length !== 43 || /[^A-Za-z0-9_-]/.test(value)) {
    return false;
  }
  // Node also decodes inputs with nonzero unused bits. Require an exact round trip.
  const bytes = Buffer.from(value, "base64url");
  return bytes.length === 32 && bytes.toString("base64url") === value;
}

export function activationTokenDigest(token) {
  if (typeof token !== "string" || !isCanonicalActivationToken(token)) return null;
  return createHash("sha256").update(token, "utf8").digest("hex");
}
