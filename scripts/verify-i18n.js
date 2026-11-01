import { execFileSync } from "node:child_process";
import fs from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import { pathToFileURL } from "node:url";

function getLeaves(obj, prefix = "") {
  const leaves = [];
  for (const [k, v] of Object.entries(obj)) {
    const fullKey = prefix ? `${prefix}.${k}` : k;
    if (typeof v === "object" && v !== null) {
      leaves.push(...getLeaves(v, fullKey));
    } else if (typeof v === "string") {
      leaves.push({ key: fullKey, val: v });
    }
  }
  return leaves;
}

function cleanVal(str) {
  return str
    .replace(/<[^>]+>/g, "")
    .replace(/\{\{val\}\}/g, "0")
    .trim();
}

async function verifyV2SSR(frontendDir, language) {
  const req = createRequire(path.join(frontendDir, "package.json"));
  const { createServer } = await import(pathToFileURL(req.resolve("vite")).href);
  const { renderToString } = await import(pathToFileURL(req.resolve("react-dom/server")).href);
  const React = (await import(pathToFileURL(req.resolve("react")).href)).default;

  const enJson = JSON.parse(
    fs.readFileSync(path.join(frontendDir, "src", "locales", "en.json"), "utf-8"),
  );
  const esJson = JSON.parse(
    fs.readFileSync(path.join(frontendDir, "src", "locales", "es.json"), "utf-8"),
  );

  const vite = await createServer({
    root: frontendDir,
    server: { middlewareMode: true },
    appType: "custom",
  });

  try {
    const appExt = language === "ts" ? "tsx" : "jsx";
    const codeExt = language === "ts" ? "ts" : "js";
    const { default: App } = await vite.ssrLoadModule(`/src/App.${appExt}`);
    const { default: i18n } = await vite.ssrLoadModule(`/src/i18n.${codeExt}`);
    const { I18nextProvider } = await vite.ssrLoadModule("react-i18next");

    // Render inglés
    await i18n.changeLanguage("en");
    const htmlEn = renderToString(
      React.createElement(I18nextProvider, { i18n }, React.createElement(App)),
    );
    const htmlEnText = htmlEn.replace(/<[^>]+>/g, "");

    // Render español
    await i18n.changeLanguage("es");
    const htmlEs = renderToString(
      React.createElement(I18nextProvider, { i18n }, React.createElement(App)),
    );
    const htmlEsText = htmlEs.replace(/<[^>]+>/g, "");

    // a) Por idioma, todos los valores del JSON aparecen en el HTML (texto sin etiquetas)
    const enLeaves = getLeaves(enJson);
    for (const { val } of enLeaves) {
      const cleaned = cleanVal(val);
      if (!htmlEnText.includes(cleaned)) {
        throw new Error(`[V2 SSR en] Valor no encontrado en HTML: "${cleaned}"`);
      }
    }

    const esLeaves = getLeaves(esJson);
    for (const { val } of esLeaves) {
      const cleaned = cleanVal(val);
      if (!htmlEsText.includes(cleaned)) {
        throw new Error(`[V2 SSR es] Valor no encontrado en HTML: "${cleaned}"`);
      }
    }

    // b) En español no aparece ningún valor inglés distinto del español
    for (let i = 0; i < enLeaves.length; i++) {
      const cleanedEn = cleanVal(enLeaves[i].val);
      const cleanedEs = cleanVal(esLeaves[i].val);
      if (cleanedEn !== cleanedEs) {
        if (htmlEsText.includes(cleanedEn)) {
          throw new Error(
            `[V2 SSR es] Valor inglés ("${cleanedEn}") encontrado indebidamente en HTML español`,
          );
        }
      }
    }

    // c) Ninguna clave visible como texto
    for (const { key } of enLeaves) {
      if (htmlEnText.includes(key)) {
        throw new Error(`[V2 SSR en] Clave de traducción visible como texto: "${key}"`);
      }
      if (htmlEsText.includes(key)) {
        throw new Error(`[V2 SSR es] Clave de traducción visible como texto: "${key}"`);
      }
    }
  } finally {
    await vite.close();
  }
}

async function verifyV3StorageAndNavigator(frontendDir) {
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
}

function verifyV4DistStrings(frontendDir) {
  const assetsDir = path.join(frontendDir, "dist", "assets");
  if (!fs.existsSync(assetsDir)) {
    throw new Error(`Directorio de assets ${assetsDir} no existe tras npm run build`);
  }
  const files = fs.readdirSync(assetsDir);
  const jsFiles = files.filter((f) => f.endsWith(".js"));
  if (jsFiles.length === 0) {
    throw new Error("No se encontraron archivos JS en dist/assets/");
  }

  let foundEn = false;
  let foundEs = false;

  for (const jsFile of jsFiles) {
    const content = fs.readFileSync(path.join(assetsDir, jsFile), "utf-8");
    if (content.includes("Get started")) foundEn = true;
    if (content.includes("Comenzar")) foundEs = true;
  }

  if (!foundEn) {
    throw new Error("Cadena distintiva de inglés ('Get started') no encontrada en dist/assets/");
  }
  if (!foundEs) {
    throw new Error("Cadena distintiva de español ('Comenzar') no encontrada en dist/assets/");
  }
}

export async function verifyI18n(frontendDir, language) {
  console.log(`\n--- Verificación i18n (V1–V4) en ${frontendDir} ---`);

  // V1. npm run check:i18n
  console.log("V1. Ejecutando check:i18n...");
  execFileSync("npm", ["run", "check:i18n"], { cwd: frontendDir, stdio: "inherit" });
  console.log("✔ V1. check:i18n completado con éxito.");

  // V2. SSR con Vite createServer + ssrLoadModule + react-dom/server
  console.log("V2. Verificando SSR con Vite y react-dom/server...");
  await verifyV2SSR(frontendDir, language);
  console.log("✔ V2. SSR completado con éxito.");

  // V3. localStorage y navigator simulados
  console.log("V3. Verificando localStorage y navigator simulados...");
  await verifyV3StorageAndNavigator(frontendDir);
  console.log("✔ V3. localStorage y navigator completado con éxito.");

  // V4. Cadenas distintivas de en y es presentes en dist/
  console.log("V4. Verificando cadenas distintivas en dist/...");
  verifyV4DistStrings(frontendDir);
  console.log("✔ V4. Cadenas en dist/ completado con éxito.");
}
