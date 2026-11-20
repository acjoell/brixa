import { Buffer } from "node:buffer";

const maxPhcBytes = 512;
const phcPattern =
  /^\$argon2id\$v=19\$m=([1-9][0-9]{4}),t=[2-4],p=[12]\$([A-Za-z0-9+/]+)\$([A-Za-z0-9+/]+)$/;

function isCanonicalBase64(encoded: string, minBytes: number, maxBytes: number): boolean {
  const bytes = Buffer.from(encoded, "base64");
  if (bytes.length < minBytes || bytes.length > maxBytes) return false;
  // El decodificador acepta bits sobrantes distintos de cero. Recodificar exige la forma canónica.
  return bytes.toString("base64").replace(/=+$/, "") === encoded;
}

export function isValidArgon2idPhc(value: unknown): boolean {
  if (typeof value !== "string" || value.length > maxPhcBytes) return false;
  if (Buffer.byteLength(value, "utf8") > maxPhcBytes) return false;
  const match = phcPattern.exec(value);
  if (!match) return false;

  const [, memoryField, salt, hash] = match;
  const memoryKiB = Number(memoryField);
  return (
    memoryKiB >= 19456 &&
    memoryKiB <= 65536 &&
    isCanonicalBase64(salt, 16, 32) &&
    isCanonicalBase64(hash, 32, 32)
  );
}
