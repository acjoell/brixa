import { randomBytes } from "node:crypto";
import { Algorithm, Version, hash, parseOptions, verify } from "@node-rs/argon2";
import { getArgon2Limiter } from "./argon2-limiter.js";
import { isValidArgon2idPhc } from "./argon2id-phc.js";
import { isPasswordWithinLimits } from "./password-limits.js";

const policy = {
  algorithm: Algorithm.Argon2id,
  version: Version.V0x13,
  memoryCost: 19456,
  timeCost: 2,
  parallelism: 1,
  outputLen: 32,
};
const saltBytes = 16;

type ErrorCode = "INVALID_PASSWORD" | "CORRUPT_PHC" | "ARGON2_OPERATION_FAILED";

export class PasswordCryptoError extends Error {
  readonly code: ErrorCode;

  constructor(code: ErrorCode) {
    super(code);
    this.name = "PasswordCryptoError";
    this.code = code;
  }
}

function requirePassword(password: unknown): asserts password is string {
  if (!isPasswordWithinLimits(password)) throw new PasswordCryptoError("INVALID_PASSWORD");
}

function requirePhc(phc: unknown): asserts phc is string {
  if (!isValidArgon2idPhc(phc)) {
    console.warn({ event: "invalid_stored_password_phc" });
    throw new PasswordCryptoError("CORRUPT_PHC");
  }
}

export async function hashPassword(password: unknown): Promise<string> {
  requirePassword(password);
  return getArgon2Limiter()(async () => {
    try {
      return await hash(password, { ...policy, salt: randomBytes(saltBytes) });
    } catch {
      throw new PasswordCryptoError("ARGON2_OPERATION_FAILED");
    }
  });
}

export async function verifyPassword(password: unknown, phc: unknown): Promise<boolean> {
  requirePassword(password);
  requirePhc(phc);
  return getArgon2Limiter()(async () => {
    try {
      return await verify(phc, password);
    } catch {
      throw new PasswordCryptoError("ARGON2_OPERATION_FAILED");
    }
  });
}

export function needsPasswordRehash(phc: unknown, verified: boolean): boolean {
  if (verified !== true) return false;
  requirePhc(phc);
  try {
    const stored = parseOptions(phc);
    return (
      stored.memoryCost !== policy.memoryCost ||
      stored.timeCost !== policy.timeCost ||
      stored.parallelism !== policy.parallelism ||
      stored.saltLen !== saltBytes
    );
  } catch {
    throw new PasswordCryptoError("ARGON2_OPERATION_FAILED");
  }
}

// Preparar una vez al arrancar y reutilizar la función para cuentas inexistentes.
export async function prepareDummyVerification(): Promise<(password: unknown) => Promise<false>> {
  const dummyPhc = await hashPassword("dummy");
  return async (password) => {
    await verifyPassword(password, dummyPhc);
    return false;
  };
}
