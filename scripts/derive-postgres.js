/** T-023: database-postgres y main de React; configuraciones divergentes manuales. */
import fs from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { transformAsync } from "@babel/core";
import transformTypescript from "@babel/plugin-transform-typescript";
import { format, resolveConfig } from "prettier";
import { ESLint } from "eslint";
import js from "@eslint/js";
import tseslint from "typescript-eslint";

const root = path.resolve(import.meta.dirname, "..");
export const files = [
  "src/db/client",
  "src/db/migrate",
  "src/db/schema",
  "tests/db.test",
  "vitest.config",
];

export async function derive(source, filename, references = new Set()) {
  const jsx = filename.endsWith(".tsx") || filename.endsWith(".jsx");
  function moduleReference(node) {
    if (jsx && node.value.startsWith(".")) {
      const extension = path.extname(node.value);
      if (extension === ".tsx" || extension === ".ts") {
        node.value =
          node.value.slice(0, -extension.length) + (extension === ".tsx" ? ".jsx" : ".js");
      }
    }
    references.add(node.value);
  }
  const result = await transformAsync(source, {
    filename,
    babelrc: false,
    configFile: false,
    comments: true,
    generatorOpts: { retainLines: true },
    plugins: [
      [transformTypescript, { onlyRemoveTypeImports: true, isTSX: jsx }],
      () => ({
        post(file) {
          // Inspeccionar después de eliminar tipos: import type no es una dependencia runtime.
          file.path.traverse({
            "ImportDeclaration|ExportNamedDeclaration|ExportAllDeclaration"(reference) {
              if (reference.node.source) moduleReference(reference.node.source);
            },
            CallExpression(reference) {
              if (reference.node.callee.type === "Import") {
                const argument = reference.node.arguments[0];
                if (argument?.type !== "StringLiteral") {
                  throw reference.buildCodeFrameError(
                    "El piloto requiere imports dinámicos literales",
                  );
                }
                moduleReference(argument);
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
  await syncFiles(
    {
      sourceDir: path.join(directory, "ts"),
      targetDir: path.join(directory, "js"),
      entries: files.map((file) => [`${file}.ts`, `${file}.js`]),
      extensions: [".js"],
      fallbackDir: path.join(root, "src/templates/backend-express-js"),
      eslint,
    },
    write,
  );
}

export async function syncFrontend(directory = path.join(root, "src/templates"), write = false) {
  // Lint ligero sin instalar los plugins React de los proyectos generados.
  const eslint = new ESLint({
    cwd: directory,
    overrideConfigFile: true,
    overrideConfig: [
      {
        files: ["**/*.jsx"],
        languageOptions: {
          parser: tseslint.parser,
          parserOptions: { ecmaFeatures: { jsx: true } },
          globals: { document: "readonly" },
        },
        rules: js.configs.recommended.rules,
      },
    ],
  });
  await syncFiles(
    {
      sourceDir: path.join(directory, "frontend-react-ts"),
      targetDir: path.join(directory, "frontend-react-js"),
      entries: [["src/main.tsx", "src/main.jsx"]],
      extensions: [".js", ".jsx", ".css"],
      eslint,
    },
    write,
  );
}

async function syncFiles(
  { sourceDir, targetDir, entries, extensions, fallbackDir, eslint },
  write,
) {
  for (const [sourceFile, targetFile] of entries) {
    const filename = path.join(sourceDir, sourceFile);
    const target = path.join(targetDir, targetFile);
    const references = new Set();
    const expected = await derive(await fs.readFile(filename, "utf8"), filename, references);
    for (const reference of references) {
      if (!reference.startsWith(".")) continue;
      const resolved = path.resolve(path.dirname(target), reference);
      const relative = path.relative(targetDir, resolved);
      if (relative.startsWith("..") || !extensions.includes(path.extname(reference))) {
        throw new Error(`Referencia local no soportada: ${reference} en ${filename}`);
      }
      if (entries.some(([, file]) => path.normalize(file) === relative)) continue;
      // La composición existente proporciona redact.js desde el backend base.
      const candidates = [resolved];
      if (fallbackDir) candidates.push(path.join(fallbackDir, relative));
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
  await syncFrontend(undefined, args[0] === "--write");
  console.log("database-postgres y React main: sincronización y lint correctos (T-023).");
}
