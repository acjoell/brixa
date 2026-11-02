#!/usr/bin/env node
/**
 * Script de V3 (localStorage y navigator) para verify-i18n.
 * Se ejecuta en un subproceso aislado desde verifyI18n() para no contaminar
 * el entorno del proceso padre del arnés.
 *
 * Uso: node scripts/verify-i18n-v3.js <frontendDir>
 */
import fs from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { execFileSync } from "node:child_process";

const [frontendDir] = process.argv.slice(2);
if (!frontendDir) {
  console.error("Uso: node verify-i18n-v3.js <frontendDir>");
  process.exit(1);
}

const req = createRequire(path.join(frontendDir, "package.json"));
const i18next = (await import(pathToFileURL(req.resolve("i18next")).href)).default;
const LanguageDetector = (
  await import(pathToFileURL(req.resolve("i18next-browser-languagedetector")).href)
).default;

const enJson = JSON.parse(
  fs.readFileSync(path.join(frontendDir, "src", "locales", "en.json"), "utf-8"),
);
const esJson = JSON.parse(
  fs.readFileSync(path.join(frontendDir, "src", "locales", "es.json"), "utf-8"),
);

function createMockStorage(store = {}) {
  return {
    getItem: (k) => store[k] ?? null,
    setItem: (k, v) => {
      store[k] = String(v);
    },
    removeItem: (k) => {
      Reflect.deleteProperty(store, k);
    },
    clear: () => {
      for (const k of Object.keys(store)) {
        Reflect.deleteProperty(store, k);
      }
    },
  };
}

function setupEnvironment({ storageStore = {}, navLangs = ["en"] } = {}) {
  const mockStorage = createMockStorage(storageStore);
  const mockDoc = { documentElement: { lang: "" } };
  const mockNav = { languages: navLangs, language: navLangs[0] };

  globalThis.window = { localStorage: mockStorage };
  globalThis.document = mockDoc;
  Object.defineProperty(globalThis, "navigator", {
    value: mockNav,
    configurable: true,
    writable: true,
  });

  const i18n = i18next.createInstance();
  i18n.use(LanguageDetector);
  i18n.init({
    resources: { en: { translation: enJson }, es: { translation: esJson } },
    supportedLngs: ["en", "es"],
    fallbackLng: "en",
    interpolation: { escapeValue: false },
    detection: {
      order: ["localStorage", "navigator"],
      caches: ["localStorage"],
    },
  });

  if (typeof globalThis.document !== "undefined") {
    globalThis.document.documentElement.lang = i18n.resolvedLanguage ?? "en";
  }
  i18n.on("languageChanged", (lng) => {
    if (typeof globalThis.document !== "undefined") {
      globalThis.document.documentElement.lang = lng.split("-")[0];
    }
  });

  return { i18n, mockStorage: storageStore, mockDoc };
}

// 1. es-CO -> es
{
  const { i18n } = setupEnvironment({ navLangs: ["es-CO"] });
  if (i18n.resolvedLanguage !== "es") {
    throw new Error(`[V3 es-CO] Esperado 'es', obtenido '${i18n.resolvedLanguage}'`);
  }
}

// 2. fr -> en
{
  const { i18n } = setupEnvironment({ navLangs: ["fr-FR", "fr"] });
  if (i18n.resolvedLanguage !== "en") {
    throw new Error(`[V3 fr] Esperado fallback 'en', obtenido '${i18n.resolvedLanguage}'`);
  }
}

// 3. localStorage prevalece sobre navigator
{
  const { i18n } = setupEnvironment({
    storageStore: { i18nextLng: "es" },
    navLangs: ["en-US", "en"],
  });
  if (i18n.resolvedLanguage !== "es") {
    throw new Error(
      `[V3 localStorage prevalece] Esperado 'es', obtenido '${i18n.resolvedLanguage}'`,
    );
  }
}

// 4. changeLanguage('es') persiste y actualiza document.documentElement.lang
{
  const store = { i18nextLng: "en" };
  const { i18n, mockDoc } = setupEnvironment({
    storageStore: store,
    navLangs: ["en-US"],
  });
  await i18n.changeLanguage("es");
  if (store.i18nextLng !== "es") {
    throw new Error(
      `[V3 persistencia] Esperado 'es' en localStorage, obtenido '${store.i18nextLng}'`,
    );
  }
  if (mockDoc.documentElement.lang !== "es") {
    throw new Error(
      `[V3 doc.lang] Esperado 'es' en documentElement.lang, obtenido '${mockDoc.documentElement.lang}'`,
    );
  }
}

// 5. un localStorage que lanza error no rompe la inicialización (ejecutado en subproceso limpio)
const isolatedScript = `
  import { createRequire } from "node:module";
  import { pathToFileURL } from "node:url";
  import fs from "node:fs";
  import path from "node:path";

  const frontendDir = ${JSON.stringify(frontendDir)};
  const req = createRequire(path.join(frontendDir, "package.json"));
  const i18next = (await import(pathToFileURL(req.resolve("i18next")).href)).default;
  const LanguageDetector = (await import(pathToFileURL(req.resolve("i18next-browser-languagedetector")).href)).default;
  const en = JSON.parse(fs.readFileSync(path.join(frontendDir, "src", "locales", "en.json"), "utf-8"));
  const es = JSON.parse(fs.readFileSync(path.join(frontendDir, "src", "locales", "es.json"), "utf-8"));

  globalThis.window = {
    localStorage: {
      getItem: () => { throw new Error("SecurityError: storage access denied"); },
      setItem: () => { throw new Error("SecurityError: storage access denied"); },
      removeItem: () => { throw new Error("SecurityError: storage access denied"); },
    }
  };
  globalThis.document = { documentElement: { lang: "" } };
  Object.defineProperty(globalThis, "navigator", {
    value: { languages: ["es-ES"], language: "es-ES" },
    configurable: true,
    writable: true,
  });

  const i18n = i18next.createInstance();
  i18n.use(LanguageDetector);
  i18n.init({
    resources: { en: { translation: en }, es: { translation: es } },
    supportedLngs: ["en", "es"],
    fallbackLng: "en",
    detection: { order: ["localStorage", "navigator"], caches: ["localStorage"] },
  });

  if (!i18n.isInitialized || i18n.resolvedLanguage !== "es") {
    process.exit(1);
  }
`;
execFileSync(process.execPath, ["--input-type=module", "-e", isolatedScript], {
  cwd: frontendDir,
  stdio: "inherit",
});
