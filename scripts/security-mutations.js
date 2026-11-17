/**
 * Catálogo de mutaciones piloto para T-018 (protecciones de T-017b).
 * Todas las mutaciones modifican una protección de seguridad específica,
 * producen código válido y ejecutable, y se corresponden con aserciones de prueba existentes.
 */
export const PILOT_SECURITY_MUTATIONS = [
  {
    id: "http-500-contract",
    name: "Contrato HTTP 500 ante error interno",
    description:
      "Modifica el manejador global para responder con HTTP 200 en lugar del 500 esperado.",
    targetRelPath: (lang) => `src/errors.${lang}`,
    searchPattern: `  res.status(500).json({
    error: "Internal Server Error",
  });`,
    replacement: `  res.status(200).json({
    error: "Internal Server Error",
  });`,
    testFile: (lang) => `tests/errors.test.${lang}`,
    expectedTest: "error genérico → 500 sin detalles",
    expectedFailurePattern: /AssertionError: expected 200 to be 500/,
    allowedRelatedTests: ["ZodError interno → 500, no 400"],
  },
  {
    id: "cors-origin-null",
    name: "CORS: rechazo de Origin null",
    description: "Permite deliberadamente el origen 'null' en la lista blanca de orígenes CORS.",
    targetRelPath: (lang) => `src/app.${lang}`,
    searchPattern: `  cachedCorsMiddleware = cors({ origin: config.corsAllowedOrigins });`,
    replacement: `  cachedCorsMiddleware = cors({ origin: [...config.corsAllowedOrigins, "null"] });`,
    testFile: (lang) => `tests/cors.test.${lang}`,
    expectedTest: "4. Origin: null rechazado: no emite Access-Control-Allow-Origin",
    expectedFailurePattern: /AssertionError: expected 'null' to be null/,
    allowedRelatedTests: [],
  },
  {
    id: "helmet-csp-header",
    name: "Helmet/CSP: cabecera CSP restrictiva en /health",
    description: "Desactiva la directiva Content-Security-Policy en la configuración de Helmet.",
    targetRelPath: (lang) => `src/app.${lang}`,
    searchPattern: `    contentSecurityPolicy: {
      useDefaults: false,
      directives: {
        defaultSrc: ["'none'"],
        baseUri: ["'none'"],
        frameAncestors: ["'none'"],
        formAction: ["'none'"],
      },
    },`,
    replacement: `    contentSecurityPolicy: false,`,
    testFile: (lang) => `tests/health.test.${lang}`,
    expectedTest: "emite cabeceras de seguridad de Helmet con CSP restrictiva y sin HSTS",
    expectedFailurePattern: /AssertionError: expected null to be 'default-src \\'none\\'/,
    allowedRelatedTests: [],
  },
];
