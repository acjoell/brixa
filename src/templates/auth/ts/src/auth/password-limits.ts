import { Buffer } from "node:buffer";

const maxCodePoints = 128;
const maxUtf8Bytes = 512;

export function isPasswordWithinLimits(value: unknown): boolean {
  // Un punto de código ocupa como máximo dos unidades UTF-16.
  if (typeof value !== "string" || value.length > maxCodePoints * 2) return false;
  // En modo Unicode un par válido es un solo punto de código fuera de la categoría Surrogate.
  if (/\p{Surrogate}/u.test(value)) return false;
  return Buffer.byteLength(value, "utf8") <= maxUtf8Bytes && [...value].length <= maxCodePoints;
}
