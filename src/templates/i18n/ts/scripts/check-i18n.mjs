#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const localesDir = path.resolve(__dirname, '..', 'src', 'locales');

function flattenKeys(obj, prefix = '') {
  const result = {};
  for (const [key, value] of Object.entries(obj)) {
    const fullKey = prefix ? `${prefix}.${key}` : key;
    if (value && typeof value === 'object' && !Array.isArray(value)) {
      Object.assign(result, flattenKeys(value, fullKey));
    } else {
      result[fullKey] = String(value);
    }
  }
  return result;
}

function extractMarkers(text) {
  const matches = text.match(/\{\{([a-zA-Z0-9_-]+)\}\}/g);
  if (!matches) return [];
  return Array.from(new Set(matches)).sort();
}

if (!fs.existsSync(localesDir)) {
  console.error(`Error: locales directory not found: ${localesDir}`);
  process.exit(1);
}

const files = fs.readdirSync(localesDir).filter((file) => file.endsWith('.json'));
if (!files.includes('en.json')) {
  console.error('Error: base language file en.json not found');
  process.exit(1);
}

const baseContent = JSON.parse(
  fs.readFileSync(path.join(localesDir, 'en.json'), 'utf-8'),
);
const baseFlat = flattenKeys(baseContent);
const baseKeys = Object.keys(baseFlat).sort();

let hasError = false;

for (const file of files) {
  if (file === 'en.json') continue;
  const filePath = path.join(localesDir, file);
  const content = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
  const flat = flattenKeys(content);
  const keys = Object.keys(flat).sort();

  // Missing keys in file compared to en.json
  for (const key of baseKeys) {
    if (!(key in flat)) {
      console.error(`Error [${file}]: clave faltante "${key}"`);
      hasError = true;
    }
  }

  // Extra keys in file not in en.json
  for (const key of keys) {
    if (!(key in baseFlat)) {
      console.error(`Error [${file}]: clave extra "${key}" no existe en en.json`);
      hasError = true;
    }
  }

  // Markers comparison
  for (const key of baseKeys) {
    if (key in flat) {
      const baseMarkers = extractMarkers(baseFlat[key]);
      const fileMarkers = extractMarkers(flat[key]);
      if (baseMarkers.join(',') !== fileMarkers.join(',')) {
        console.error(
          `Error [${file}]: marcadores difieren en clave "${key}". Esperado: [${baseMarkers.join(', ')}], recibido: [${fileMarkers.join(', ')}]`,
        );
        hasError = true;
      }
    }
  }
}

if (hasError) {
  process.exit(1);
}

console.log('✓ Todas las claves y marcadores i18n son consistentes.');
