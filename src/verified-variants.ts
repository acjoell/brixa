/**
 * Brixa — combinaciones verificadas por el arnés de integración.
 *
 * Debe coincidir exactamente con la lista VARIANTS de scripts/verify-generated.js.
 * Toda combinación que el CLI genera pero que no aparezca aquí se muestra como
 * EXPERIMENTAL en el resumen previo a la generación.
 */

/** Representa los flags opcionales de una variante verificada. */
interface VerifiedVariant {
  modality: string;
  language: string;
  database?: string;
  docker?: boolean;
  apiDocs?: boolean;
  i18n?: boolean;
}

/**
 * Genera el nombre de variante en el mismo formato que el arnés
 * (p. ej. "fullstack+js+sqlite+i18n").
 */
export function variantLabel(opts: {
  modality: string;
  language: string;
  database?: string | undefined;
  docker?: boolean | undefined;
  apiDocs?: boolean | undefined;
  i18n?: boolean | undefined;
}): string {
  const parts = [opts.modality, opts.language];
  if (opts.database && opts.database !== "none") parts.push(opts.database);
  if (opts.docker) parts.push("docker");
  if (opts.apiDocs) parts.push("docs");
  if (opts.i18n) parts.push("i18n");
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

/**
 * Devuelve true si la combinación dada está entre las 32 verificadas por el arnés.
 */
export function isVerified(opts: {
  modality: string;
  language: string;
  database?: string | undefined;
  docker?: boolean | undefined;
  apiDocs?: boolean | undefined;
  i18n?: boolean | undefined;
}): boolean {
  return _verifiedSet.has(
    variantLabel({
      modality: opts.modality,
      language: opts.language,
      database: opts.database,
      docker: opts.docker,
      apiDocs: opts.apiDocs,
      i18n: opts.i18n,
    }),
  );
}
