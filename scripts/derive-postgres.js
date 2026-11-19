/** Piloto T-023: solo database-postgres; las configuraciones divergentes son manuales. */
import fs from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { transformAsync } from "@babel/core";
import transformTypescript from "@babel/plugin-transform-typescript";
import { format, resolveConfig } from "prettier";
import { ESLint } from "eslint";

const root = path.resolve(import.meta.dirname, "..");
export const files = [
  "src/db/client",
  "src/db/migrate",
  "src/db/schema",
  "tests/db.test",
  "vitest.config",
];

export async function derive(source, filename, references = new Set()) {
  if (filename.endsWith(".tsx") || filename.endsWith(".jsx")) {
    throw new Error("JSX/TSX fuera del alcance del piloto database-postgres");
  }
  const result = await transformAsync(source, {
    filename,
    babelrc: false,
    configFile: false,
    comments: true,
    generatorOpts: { retainLines: true },
    plugins: [
      [transformTypescript, { onlyRemoveTypeImports: true }],
      () => ({
        post(file) {
          // Inspeccionar después de eliminar tipos: import type no es una dependencia runtime.
          file.path.traverse({
            "ImportDeclaration|ExportNamedDeclaration|ExportAllDeclaration"(reference) {
              if (reference.node.source) references.add(reference.node.source.value);
            },
            CallExpression(reference) {
              if (reference.node.callee.type === "Import") {
                const argument = reference.node.arguments[0];
                if (argument?.type !== "StringLiteral") {
                  throw reference.buildCodeFrameError(
                    "El piloto requiere imports dinámicos literales",
                  );
                }
                references.add(argument.value);
              }
            },
          });
        },
      }),
    ],
  });
  if (result?.code === undefined || result.code === null) {
    throw new Error(`Babel no produjo código: ${filename}`);
  }
  return format(result.code, {
    ...(await resolveConfig(path.join(root, ".prettierrc"))),
    parser: "babel",
  });
}

export async function sync(
  directory = path.join(root, "src/templates/database-postgres"),
  write = false,
) {
  const eslint = new ESLint({
    cwd: directory,
    overrideConfigFile: path.join(root, "src/templates/backend-express-js/eslint.config.js"),
  });
  for (const file of files) {
    const filename = path.join(directory, "ts", `${file}.ts`);
    const target = path.join(directory, "js", `${file}.js`);
    const references = new Set();
    const expected = await derive(await fs.readFile(filename, "utf8"), filename, references);
    for (const reference of references) {
      if (!reference.startsWith(".")) continue;
      const jsRoot = path.join(directory, "js");
      const resolved = path.resolve(path.dirname(target), reference);
      const relative = path.relative(jsRoot, resolved);
      if (relative.startsWith("..") || !reference.endsWith(".js")) {
        throw new Error(`Referencia local no soportada: ${reference} en ${filename}`);
      }
      if (files.some((file) => path.normalize(`${file}.js`) === relative)) continue;
      // La composición existente proporciona redact.js desde el backend base.
      const candidates = [resolved, path.join(root, "src/templates/backend-express-js", relative)];
      const found = await Promise.all(
        candidates.map(async (candidate) => {
          try {
            return (await fs.stat(candidate)).isFile();
          } catch (error) {
            if (error.code === "ENOENT") return false;
            throw error;
          }
        }),
      );
      if (!found.some(Boolean)) {
        throw new Error(`Referencia local inexistente: ${reference} en ${filename}`);
      }
    }
    const results = await eslint.lintText(expected, { filePath: target });
    if (results.some((result) => result.errorCount > 0 || result.warningCount > 0)) {
      const formatter = await eslint.loadFormatter("stylish");
      throw new Error(await formatter.format(results));
    }
    if (write) {
      await fs.writeFile(target, expected);
    } else {
      const actual = await fs.readFile(target, "utf8").catch((error) => {
        if (error.code === "ENOENT") return null;
        throw error;
      });
      if (actual !== expected) {
        throw new Error(`JavaScript desincronizado: ${target}. Ejecuta npm run derive:js.`);
      }
    }
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const args = process.argv.slice(2);
  if (args.length > 1 || (args.length === 1 && args[0] !== "--write")) {
    throw new Error("Uso: node scripts/derive-postgres.js [--write]");
  }
  await sync(undefined, args[0] === "--write");
  console.log("database-postgres: sincronización y lint correctos (piloto T-023).");
}
