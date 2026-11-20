import { Buffer } from "node:buffer";
import { afterEach, describe, expect, it, vi } from "vitest";
import { hash, parseOptions, verify } from "@node-rs/argon2";
import { isValidArgon2idPhc } from "../src/auth/argon2id-phc.js";
import {
  hashPassword,
  needsPasswordRehash,
  prepareDummyVerification,
  verifyPassword,
} from "../src/auth/password-crypto.js";

vi.mock("@node-rs/argon2", { spy: true });
afterEach(() => {
  vi.clearAllMocks();
  vi.restoreAllMocks();
});

describe("Argon2id", () => {
  it("genera PHC canónicos con la política vigente y un salt nuevo por contraseña", async () => {
    const first = await hashPassword("🔑");
    const second = await hashPassword("🔑");
    expect(isValidArgon2idPhc(first)).toBe(true);
    expect(first.startsWith("$argon2id$v=19$m=19456,t=2,p=1$")).toBe(true);
    expect(parseOptions(first)).toMatchObject({ saltLen: 16, outputLen: 32 });
    expect(first.split("$")[4]).not.toBe(second.split("$")[4]);
    expect(await verifyPassword("🔑", first)).toBe(true);
    expect(await verifyPassword("incorrecta", first)).toBe(false);
    expect(needsPasswordRehash(first, true)).toBe(false);
  });

  it.each([{ timeCost: 3 }, { salt: Buffer.alloc(17) }])(
    "evalúa el rehash solo tras verificar una credencial con parámetros admitidos distintos",
    async (options) => {
      const stored = await hash("anterior", options);
      expect(needsPasswordRehash(stored, await verifyPassword("incorrecta", stored))).toBe(false);
      expect(parseOptions).not.toHaveBeenCalled();
      expect(needsPasswordRehash(stored, await verifyPassword("anterior", stored))).toBe(true);
      expect(hash).toHaveBeenCalledTimes(1);
    },
  );

  it("solo evalúa el rehash con el booleano primitivo true", async () => {
    const stored = await hash("anterior", { timeCost: 3 });
    for (const invalid of [Promise.resolve(false), Promise.resolve(true), "true", 1, {}]) {
      // @ts-expect-error Entrada incorrecta posible desde JavaScript.
      expect(needsPasswordRehash(stored, invalid)).toBe(false);
    }
    expect(needsPasswordRehash(stored, false)).toBe(false);
    expect(parseOptions).not.toHaveBeenCalled();
    expect(needsPasswordRehash(stored, true)).toBe(true);
    expect(parseOptions).toHaveBeenCalledExactlyOnceWith(stored);
  });

  it("prepara el dummy una vez y verifica cada intento sin conceder éxito", async () => {
    const check = await prepareDummyVerification();
    expect(await check("dummy")).toBe(false);
    expect(await check("otra")).toBe(false);
    expect(hash).toHaveBeenCalledTimes(1);
    expect(verify).toHaveBeenCalledTimes(2);
    const [[phc], [reused]] = vi.mocked(verify).mock.calls;
    expect(isValidArgon2idPhc(phc)).toBe(true);
    expect(reused).toBe(phc);
  });

  it("rechaza entradas y PHC inválidos antes de llamar a la biblioteca", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const phc = (await hashPassword("válida")).replace("m=19456", "m=65537");
    vi.clearAllMocks();
    await expect(hashPassword("\uD800")).rejects.toMatchObject({ code: "INVALID_PASSWORD" });
    await expect(verifyPassword("x".repeat(129), phc)).rejects.toMatchObject({
      code: "INVALID_PASSWORD",
    });
    await expect(verifyPassword("válida", phc)).rejects.toMatchObject({
      code: "CORRUPT_PHC",
      message: "CORRUPT_PHC",
    });
    expect(() => needsPasswordRehash(phc, true)).toThrow("CORRUPT_PHC");
    expect(hash).not.toHaveBeenCalled();
    expect(verify).not.toHaveBeenCalled();
    expect(parseOptions).not.toHaveBeenCalled();
    expect(warn.mock.calls).toEqual([
      [{ event: "invalid_stored_password_phc" }],
      [{ event: "invalid_stored_password_phc" }],
    ]);
  });

  it("propaga fallos operativos sin incluir el error nativo", async () => {
    const phc = await hashPassword("válida");
    const failure = new Error("detalle interno sensible");
    const expected = { code: "ARGON2_OPERATION_FAILED", message: "ARGON2_OPERATION_FAILED" };
    vi.mocked(hash).mockRejectedValueOnce(failure);
    await expect(hashPassword("válida")).rejects.toMatchObject(expected);
    vi.mocked(verify).mockRejectedValueOnce(failure);
    await expect(verifyPassword("válida", phc)).rejects.toMatchObject(expected);
  });
});
