import { expect, it } from "vitest";
import { acceptsNewPassword, parsePasswordPolicy } from "../src/auth/password-policy.js";

it("valida la configuración al arrancar y admite ambos extremos", () => {
  expect(parsePasswordPolicy({})).toEqual({ minLength: 10, maxLength: 64, maxBytes: 512 });
  expect(
    parsePasswordPolicy({ AUTH_PASSWORD_MIN_LENGTH: "8", AUTH_PASSWORD_MAX_LENGTH: "128" }),
  ).toEqual({ minLength: 8, maxLength: 128, maxBytes: 512 });
  for (const env of [
    { AUTH_PASSWORD_MIN_LENGTH: "7" },
    { AUTH_PASSWORD_MAX_LENGTH: "129" },
    { AUTH_PASSWORD_MIN_LENGTH: "10.5" },
    { AUTH_PASSWORD_MIN_LENGTH: "" },
    { AUTH_PASSWORD_MIN_LENGTH: "40", AUTH_PASSWORD_MAX_LENGTH: "39" },
  ])
    expect(() => parsePasswordPolicy(env)).toThrow(/AUTH_PASSWORD_MIN_LENGTH/);
});

it("cuenta puntos de código, admite espacios y rechaza sustitutos aislados", () => {
  const policy = parsePasswordPolicy({
    AUTH_PASSWORD_MIN_LENGTH: "8",
    AUTH_PASSWORD_MAX_LENGTH: "128",
  });
  const allows = (value: string) => acceptsNewPassword(value, "tester@example.test", policy);
  expect(allows("🧱".repeat(7))).toBe(false);
  expect(allows("🧱".repeat(8))).toBe(true);
  expect(allows("🧱".repeat(128))).toBe(true);
  expect(allows("🧱".repeat(129))).toBe(false);
  expect(allows("a".repeat(129))).toBe(false);
  expect(allows("  é漢🧱á  ")).toBe(true);
  expect(allows("  Unicode \ud800")).toBe(false);
  expect(allows("  Unicode \udfff")).toBe(false);
});

it("solo rechaza coincidencias completas de identidad, sin distinguir mayúsculas", () => {
  const policy = parsePasswordPolicy({});
  const allows = (value: string) =>
    acceptsNewPassword(value, "account.test+dev@example.test", policy);
  expect(allows("ACCOUNT.TEST+DEV@EXAMPLE.TEST")).toBe(false);
  expect(allows("ACCOUNT.TEST+DEV")).toBe(false);
  expect(allows(" account.test+dev ")).toBe(true);
  expect(allows("accountXtest+dev")).toBe(true);
});
