import { Buffer } from "node:buffer";
import { expect, it } from "vitest";
import { parseActivationExpiryHours } from "../src/auth/activation-config.js";
import {
  activationTokenDigest,
  generateActivationToken,
  isCanonicalActivationToken,
} from "../src/auth/activation-token.js";

const canonical = Buffer.alloc(32).toString("base64url");

it("genera 32 bytes de token en Base64url canónico", () => {
  const token = generateActivationToken();
  expect(token).toHaveLength(43);
  expect(isCanonicalActivationToken(token)).toBe(true);
  expect(Buffer.from(token, "base64url")).toHaveLength(32);
  expect(generateActivationToken()).not.toBe(token);
});

it("rechaza aliases de Base64url y calcula el SHA-256 de la cadena canónica", () => {
  const alias = canonical.slice(0, -1) + "B";
  expect(Buffer.from(alias, "base64url")).toEqual(Buffer.alloc(32));
  const urlToken = Buffer.alloc(32, 255).toString("base64url");
  expect(isCanonicalActivationToken(urlToken)).toBe(true);
  for (const value of [
    alias,
    canonical + "=",
    canonical.slice(1),
    canonical.slice(1) + "\n",
    canonical.slice(1) + "\0",
    Buffer.alloc(32, 255).toString("base64").slice(0, -1),
    undefined,
    null,
    Buffer.alloc(32),
    { toString: () => canonical },
  ]) {
    expect(isCanonicalActivationToken(value)).toBe(false);
    expect(activationTokenDigest(value)).toBeNull();
  }
  expect(activationTokenDigest(canonical)).toBe(
    "0f007385b6f9d4b7eeb2748605afe1a984a0a3bfa3f014d09e2a784ce9e5cd1a",
  );
});

it("valida el intervalo entero de horas y usa 24 al omitir la variable", () => {
  const hours = (value) => parseActivationExpiryHours({ ACTIVATION_TOKEN_EXPIRY_HOURS: value });
  expect(parseActivationExpiryHours({})).toBe(24);
  expect(hours("1")).toBe(1);
  expect(hours("168")).toBe(168);
  for (const value of ["0", "169", "-1", "1.5", "1e2", "0x10", "", " 24", "24\n", "+1", 24]) {
    expect(() => hours(value)).toThrow("ACTIVATION_TOKEN_EXPIRY_HOURS");
  }
});
