#!/usr/bin/env node
/**
 * Scripts de V2 (SSR) para verify-i18n.
 * Se ejecuta en un subproceso aislado desde verifyI18n() para evitar que
 * Vite createServer contamine process.env.NODE_ENV del proceso padre.
 *
 * Uso: node scripts/verify-i18n-v2.js <frontendDir> <language>
 */
import fs from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import { pathToFileURL } from "node:url";

const [frontendDir, language] = process.argv.slice(2);
if (!frontendDir || !language) {
  console.error("Uso: node verify-i18n-v2.js <frontendDir> <language>");
  process.exit(1);
}

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

  await i18n.changeLanguage("en");
  const htmlEn = renderToString(
    React.createElement(I18nextProvider, { i18n }, React.createElement(App)),
  );
  const htmlEnText = htmlEn.replace(/<[^>]+>/g, "");

  await i18n.changeLanguage("es");
  const htmlEs = renderToString(
    React.createElement(I18nextProvider, { i18n }, React.createElement(App)),
  );
  const htmlEsText = htmlEs.replace(/<[^>]+>/g, "");

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
