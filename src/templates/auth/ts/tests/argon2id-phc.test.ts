import { Buffer } from "node:buffer";
import { describe, expect, expectTypeOf, it } from "vitest";
import { isValidArgon2idPhc } from "../src/auth/argon2id-phc.js";

function base64(bytes: number): string {
  return Buffer.alloc(bytes, 0xfb).toString("base64").replace(/=+$/, "");
}

const salt = base64(16);
const hash = base64(32);
function phc(params = "m=19456,t=2,p=1", encodedSalt = salt, encodedHash = hash): string {
  return `$argon2id$v=19$${params}$${encodedSalt}$${encodedHash}`;
}

describe("formato PHC de Argon2id", () => {
  it("permite que una cadena falle la validación sin excluir su tipo", () => {
    expectTypeOf(isValidArgon2idPhc).not.toExtend<(value: unknown) => value is string>();
  });

  it("acepta límites inclusivos e intermedios con Base64 convencional", () => {
    expect(isValidArgon2idPhc(phc())).toBe(true);
    expect(isValidArgon2idPhc(phc("m=32768,t=3,p=1", base64(21)))).toBe(true);
    expect(isValidArgon2idPhc(phc("m=65536,t=4,p=2", base64(32)))).toBe(true);
  });

  it.each([
    "m=19455,t=2,p=1",
    "m=65537,t=2,p=1",
    "m=19456,t=1,p=1",
    "m=19456,t=5,p=1",
    "m=19456,t=2,p=0",
    "m=19456,t=2,p=3",
    "m=019456,t=2,p=1",
    "m=19456,t=02,p=1",
    "m=19456,p=1,t=2",
    "m=19456,t=2,p=1,p=1",
  ])("rechaza parámetros fuera de contrato (%s)", (params) => {
    expect(isValidArgon2idPhc(phc(params))).toBe(false);
  });

  it("comprueba las longitudes decodificadas de salt y hash", () => {
    for (const size of [15, 33])
      expect(isValidArgon2idPhc(phc(undefined, base64(size)))).toBe(false);
    for (const size of [31, 33])
      expect(isValidArgon2idPhc(phc(undefined, salt, base64(size)))).toBe(false);
  });

  it("rechaza padding, Base64URL y bits sobrantes incluso si decodifican los mismos bytes", () => {
    expect(isValidArgon2idPhc(phc(undefined, salt + "=="))).toBe(false);
    expect(isValidArgon2idPhc(phc(undefined, salt.replaceAll("+", "-").replaceAll("/", "_")))).toBe(
      false,
    );
    // Para estos fixtures los últimos símbolos canónicos son w y s.
    expect(isValidArgon2idPhc(phc(undefined, salt.slice(0, -1) + "x"))).toBe(false);
    expect(isValidArgon2idPhc(phc(undefined, salt, hash.slice(0, -1) + "t"))).toBe(false);
  });

  it.each([
    null,
    19,
    "",
    phc().replace("argon2id", "argon2i"),
    phc().replace("v=19", "v=16"),
    phc(undefined, ""),
    phc(undefined, salt, ""),
    phc() + "\n",
    " " + phc(),
    phc() + "$extra",
    phc(undefined, "A".repeat(513)),
    phc(undefined, "é".repeat(256)),
  ])("rechaza entradas malformadas o demasiado largas (%#)", (value) => {
    expect(isValidArgon2idPhc(value)).toBe(false);
  });
});
