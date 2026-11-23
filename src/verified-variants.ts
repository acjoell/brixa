/**
 * Brixa — combinaciones verificadas por el arnés de integración.
 *
 * La lista base coincide con VARIANTS de scripts/verify-generated.js.
 * Las combinaciones Auth disponen de evidencia especializada (D-053).
 */

import { DEFAULT_AUTH_TRANSPORT } from "./validation/options.js";
import type { UserOptions } from "./types.js";

/** Representa los flags opcionales de una variante verificada. */
type VerifiedVariant = Omit<UserOptions, "outputDir">;

/**
 * Genera el nombre de variante en el mismo formato que el arnés
 * (p. ej. "fullstack+js+sqlite+i18n").
 */
export function variantLabel(opts: VerifiedVariant): string {
  const parts: string[] = [opts.modality, opts.language];
  if (opts.database && opts.database !== "none") parts.push(opts.database);
  if (opts.docker) parts.push("docker");
  if (opts.apiDocs) parts.push("docs");
  if (opts.i18n) parts.push("i18n");
  if (opts.auth) parts.push("auth", opts.authTransport ?? DEFAULT_AUTH_TRANSPORT);
  return parts.join("+");
}

/**
 * Lista de las 32 combinaciones verificadas por el arnés.
 * Debe coincidir con la lista VARIANTS de scripts/verify-generated.js.
 */
export const VERIFIED_VARIANTS: readonly VerifiedVariant[] = [
  { modality: "frontend", language: "ts" },
  { modality: "frontend", language: "js" },
  { modality: "backend", language: "ts" },
  { modality: "backend", language: "js" },
  { modality: "fullstack", language: "ts" },
  { modality: "fullstack", language: "js" },
  { modality: "backend", language: "ts", database: "postgres" },
  { modality: "backend", language: "js", database: "postgres" },
  { modality: "fullstack", language: "ts", database: "postgres" },
  { modality: "fullstack", language: "js", database: "postgres" },
  { modality: "backend", language: "ts", database: "sqlite" },
  { modality: "backend", language: "js", database: "sqlite" },
  { modality: "fullstack", language: "ts", database: "sqlite" },
  { modality: "fullstack", language: "js", database: "sqlite" },
  { modality: "backend", language: "ts", docker: true },
  { modality: "backend", language: "js", docker: true },
  { modality: "backend", language: "ts", database: "postgres", docker: true },
  { modality: "backend", language: "js", database: "postgres", docker: true },
  { modality: "backend", language: "ts", database: "sqlite", docker: true },
  { modality: "backend", language: "js", database: "sqlite", docker: true },
  { modality: "fullstack", language: "ts", docker: true },
  { modality: "fullstack", language: "js", docker: true },
  { modality: "fullstack", language: "ts", database: "postgres", docker: true },
  { modality: "fullstack", language: "js", database: "postgres", docker: true },
  { modality: "fullstack", language: "ts", database: "sqlite", docker: true },
  { modality: "fullstack", language: "js", database: "sqlite", docker: true },
  { modality: "backend", language: "ts", apiDocs: true },
  { modality: "backend", language: "js", apiDocs: true },
  { modality: "fullstack", language: "ts", database: "postgres", docker: true, apiDocs: true },
  { modality: "fullstack", language: "js", database: "sqlite", apiDocs: true },
  { modality: "frontend", language: "ts", i18n: true },
  { modality: "fullstack", language: "js", database: "sqlite", i18n: true },
] as const;

const _verifiedSet = new Set(VERIFIED_VARIANTS.map(variantLabel));

/** Ciclo Auth y controles generales focalizados acreditados (T-014a). */
export const VERIFIED_AUTH_VARIANTS: readonly VerifiedVariant[] = (
  [
    { modality: "backend", language: "js", database: "postgres", authTransport: "bearer" },
    { modality: "backend", language: "ts", database: "sqlite", authTransport: "bearer" },
    { modality: "fullstack", language: "ts", database: "sqlite", authTransport: "cookie" },
    { modality: "fullstack", language: "js", database: "postgres", authTransport: "cookie" },
    { modality: "backend", language: "js", database: "sqlite", authTransport: "cookie" },
  ] as const
).map((variant) => ({ ...variant, auth: true, apiDocs: true }));

const verifiedAuthSet = new Set(VERIFIED_AUTH_VARIANTS.map(variantLabel));

/**
 * Devuelve true para una combinación exacta con evidencia de generación y funcionamiento.
 */
export function isVerified(opts: VerifiedVariant): boolean {
  const label = variantLabel(opts);
  return opts.auth ? verifiedAuthSet.has(label) : _verifiedSet.has(label);
}

/**
 * Lista de combinaciones cubiertas por el arnés de seguridad (verify:security).
 * Piloto inicial T-018: backend TS, backend JS y fullstack TS.
 */
export const VERIFIED_SECURITY_VARIANTS: readonly VerifiedVariant[] = [
  { modality: "backend", language: "ts" },
  { modality: "backend", language: "js" },
  { modality: "fullstack", language: "ts" },
] as const;

const _verifiedSecuritySet = new Set(VERIFIED_SECURITY_VARIANTS.map(variantLabel));

/**
 * Devuelve true si la combinación dada está entre las verificadas por el arnés de seguridad.
 */
export function isSecurityVerified(opts: VerifiedVariant): boolean {
  const label = variantLabel(opts);
  return opts.auth ? verifiedAuthSet.has(label) : _verifiedSecuritySet.has(label);
}
