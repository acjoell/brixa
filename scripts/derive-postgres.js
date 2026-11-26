/** T-023: inventario explícito de pares de plantillas aprobado en D-098. */
import fs from "node:fs/promises";
import { isBuiltin } from "node:module";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { transformAsync } from "@babel/core";
import transformTypescript from "@babel/plugin-transform-typescript";
import { format, resolveConfig } from "prettier";
import { ESLint } from "eslint";
import js from "@eslint/js";
import tseslint from "typescript-eslint";

const root = path.resolve(import.meta.dirname, "..");
const templates = path.join(root, "src/templates");
const database = [
  "src/db/client.ts",
  "src/db/migrate.ts",
  "src/db/schema.ts",
  "tests/db.test.ts",
  "vitest.config.ts",
];
const groups = {
  express: {
    base: "backend-express",
    files: [
      "src/app.ts",
      "src/config.ts",
      "src/errors.ts",
      "src/index.ts",
      "src/redact.ts",
      "tests/config.test.ts",
      "tests/cors.test.ts",
      "tests/errors.test.ts",
      "tests/health.test.ts",
    ],
    modules: ["express", "helmet", "cors", "zod", "vitest"],
  },
  react: {
    base: "frontend-react",
    files: [
      "src/main.tsx",
      "src/App.tsx",
      "src/AppFrame.tsx",
      "src/ThemeSelector.tsx",
      "src/useAppContent.tsx",
      "vite.config.ts",
      "_scripts/theme-init.ts",
    ],
    modules: ["react", "react-dom/client", "@vitejs/plugin-react", "@tailwindcss/vite", "vite"],
  },
  "database-postgres": {
    files: [...database, "src/db/connection-url.ts"],
    modules: [
      "pg",
      "drizzle-orm/node-postgres",
      "drizzle-orm/node-postgres/migrator",
      "vitest/config",
    ],
  },
  "database-sqlite": {
    files: database,
    modules: [
      "@libsql/client",
      "drizzle-orm/libsql",
      "drizzle-orm/libsql/migrator",
      "vitest/config",
    ],
  },
  "api-docs": {
    files: ["src/docs/swagger.ts", "src/docs/validate-env.ts", "tests/docs.test.ts"],
    modules: ["swagger-ui-express"],
    fragments: ["app.imports", "app.routes", "index.imports", "index.startup"],
  },
  "auth-postgres": {
    overlays: ["auth", "database-postgres"],
    files: [
      "src/db/schema.ts",
      "src/db/session-write.ts",
      "src/db/activation-write.ts",
      "src/db/login-abuse-write.ts",
      "src/db/check-auth-privileges.ts",
      "src/db/bootstrap.ts",
      "src/auth/bootstrap-cli.ts",
      "src/auth/recover-admin-cli.ts",
      "tests/session-postgres.test.ts",
    ],
    modules: [
      "drizzle-orm",
      "drizzle-orm/pg-core",
      "pg",
      "drizzle-orm/node-postgres",
      "drizzle-orm/node-postgres/migrator",
    ],
  },
  "auth-sqlite": {
    overlays: ["auth"],
    files: [
      "src/db/schema.ts",
      "src/db/session-write.ts",
      "src/db/activation-write.ts",
      "src/db/login-abuse-write.ts",
      "src/auth/bootstrap-cli.ts",
      "src/auth/recover-admin-cli.ts",
      "src/db/local-admin.ts",
      "tests/session-lifecycle.test.ts",
      "tests/bootstrap.test.ts",
      "tests/managed-activation.test.ts",
      "tests/login.test.ts",
      "tests/login-abuse.test.ts",
      "tests/auth-http-sqlite.test.ts",
      "tests/activation-http.test.ts",
      "tests/logout.test.ts",
      "tests/change-password.test.ts",
      "tests/admin-recovery.test.ts",
      "tests/system-audit.test.ts",
    ],
    modules: [
      "drizzle-orm",
      "drizzle-orm/sqlite-core",
      "@libsql/client",
      "drizzle-orm/libsql",
      "drizzle-orm/libsql/migrator",
    ],
  },
  auth: {
    overlays: ["auth-postgres", "auth-sqlite"],
    files: [
      "src/auth/audit-events.ts",
      "src/auth/initial-administrator.ts",
      "src/auth/bootstrap.ts",
      "src/auth/bootstrap-console.ts",
      "src/auth/system-audit.ts",
      "src/auth/session-config.ts",
      "src/auth/sessions.ts",
      "src/auth/activation-config.ts",
      "src/auth/activation-token.ts",
      "src/auth/managed-activation.ts",
      "src/auth/activate-account.ts",
      "src/auth/email.ts",
      "src/auth/login.ts",
      "src/auth/http.ts",
      "src/auth/http-transport.ts",
      "src/auth/http-runtime.ts",
      "src/auth/login-abuse.ts",
      "src/auth/change-password.ts",
      "src/auth/recover-admin.ts",
      "src/auth/recover-admin-console.ts",
      "src/auth/password-limits.ts",
      "src/auth/password-policy.ts",
      "src/auth/argon2id-phc.ts",
      "src/auth/password-crypto.ts",
      "src/auth/argon2-limiter.ts",
      "tests/system-audit-contract.ts",
      "tests/bootstrap-contract.ts",
      "tests/activation-token.test.ts",
      "tests/managed-activation-contract.ts",
      "tests/account-activation-contract.ts",
      "tests/login-contract.ts",
      "tests/auth-http.test.ts",
      "tests/auth-lifecycle-contract.ts",
      "tests/require-auth-contract.ts",
      "tests/login-abuse-contract.ts",
      "tests/logout-contract.ts",
      "tests/change-password-contract.ts",
      "tests/admin-recovery-contract.ts",
      "tests/password-limits.test.ts",
      "tests/password-policy.test.ts",
      "tests/argon2id-phc.test.ts",
      "tests/password-crypto.test.ts",
      "tests/argon2-limiter.test.ts",
    ],
    modules: ["@node-rs/argon2", "drizzle-orm", "express", "vitest", "zod"],
    fragments: ["index.imports", "index.startup"],
  },
  i18n: {
    files: ["src/i18n.ts", "src/components/LanguageSelector.tsx", "src/useAppContent.tsx"],
    modules: ["i18next", "react-i18next", "i18next-browser-languagedetector"],
  },
  "auth-ui": {
    files: [
      "src/features/auth/AuthApp.tsx",
      "src/features/auth/AuthApp.test.tsx",
      "src/features/auth/AuthForm.tsx",
      "src/features/auth/AuthForms.tsx",
      "src/features/auth/ActivationView.tsx",
      "src/features/auth/activation.ts",
      "src/features/auth/WorkspaceView.tsx",
      "src/features/auth/ProtectedRoute.tsx",
      "src/features/auth/SessionNotice.tsx",
      "src/features/auth/authClient.ts",
      "src/features/auth/authClient.test.ts",
      "src/features/auth/session.ts",
      "src/features/auth/session.test.ts",
      "src/features/auth/sessionContext.ts",
      "src/features/auth/SessionProvider.tsx",
    ],
    modules: ["react-router", "react-dom/server", "vitest"],
  },
};

// Nombres públicos estáticos de los módulos del inventario. Los assets y paquetes
// externos se comprueban en el proyecto generado por Vite/Node.
function recordBindings(reference, contract) {
  const { node } = reference;
  for (const specifier of node.specifiers ?? []) {
    const imported = specifier.imported ?? specifier.local;
    if (node.source && imported && specifier.type !== "ImportNamespaceSpecifier") {
      const name =
        specifier.type === "ImportDefaultSpecifier" ? "default" : (imported.name ?? imported.value);
      contract.imports.push([node.source.value, name]);
    }
    if (specifier.exported)
      contract.exports.add(specifier.exported.name ?? specifier.exported.value);
  }
  if (node.declaration) {
    for (const name of Object.keys(reference.get("declaration").getOuterBindingIdentifiers()))
      contract.exports.add(name);
  }
}

export async function derive(source, filename, references = new Set(), contract) {
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
      ...(filename.includes(path.sep + "_fragments" + path.sep)
        ? []
        : [[transformTypescript, { onlyRemoveTypeImports: true, isTSX: jsx }]]),
      () => ({
        pre(file) {
          for (const statement of file.ast.program.body) {
            if (
              statement.type === "ImportDeclaration" &&
              statement.importKind !== "type" &&
              statement.specifiers.length &&
              statement.specifiers.every((specifier) => specifier.importKind === "type")
            ) {
              throw file.buildCodeFrameError(
                statement,
                "Usa import type para una declaración que solo importa tipos",
              );
            }
          }
        },
        post(file) {
          // Inspeccionar después de eliminar tipos: import type no es una dependencia runtime.
          file.path.traverse({
            "ImportDeclaration|ExportNamedDeclaration|ExportAllDeclaration"(reference) {
              const { node } = reference;
              if (node.source) {
                moduleReference(node.source);
                if (
                  contract?.nodeRuntime &&
                  node.source.value.endsWith(".json") &&
                  !node.attributes?.some(
                    ({ key, value }) => key.name === "type" && value.value === "json",
                  )
                ) {
                  throw reference.buildCodeFrameError(
                    'El import JSON en Node requiere with { type: "json" }',
                  );
                }
              }
              if (contract) recordBindings(reference, contract);
            },
            ExportDefaultDeclaration() {
              contract?.exports.add("default");
            },
            JSXText({ node, parent }) {
              // Texto de ayuda visible de la plantilla base (no del overlay i18n).
              if (
                filename.endsWith(path.join("frontend-react-ts", "src", "useAppContent.tsx")) &&
                parent.openingElement?.name.name === "code" &&
                node.value === "src/App.tsx"
              ) {
                node.value = "src/App.jsx";
                delete node.extra;
              }
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

function frontendLint(directory) {
  // Los plugins React completos se ejecutan en el proyecto generado.
  return new ESLint({
    cwd: directory,
    overrideConfigFile: true,
    overrideConfig: [
      {
        files: ["**/*.{js,jsx}"],
        languageOptions: {
          parser: tseslint.parser,
          parserOptions: { ecmaFeatures: { jsx: true } },
          globals: { document: "readonly" },
        },
        rules: js.configs.recommended.rules,
      },
    ],
  });
}

async function exists(file) {
  try {
    return (await fs.stat(file)).isFile();
  } catch (error) {
    if (error.code === "ENOENT") return false;
    throw error;
  }
}

function templateGroup(directory, name) {
  const group = groups[name];
  const frontend = name === "react" || name === "i18n" || name === "auth-ui";
  const base = frontend ? groups.react : groups.express;
  const dir = (language) =>
    path.join(directory, group.base ? group.base + "-" + language : path.join(name, language));
  const entries = group.files.map((source) => [
    source,
    source.replace(/^_scripts\//, "public/").replace(/\.ts(x?)$/, ".js$1"),
  ]);
  for (const fragment of group.fragments ?? []) {
    entries.push(["_fragments/" + fragment, "_fragments/" + fragment]);
  }
  return {
    entries,
    sourceDir: dir("ts"),
    targetDir: dir("js"),
    overlayDirs:
      name === "auth-ui"
        ? [path.join(directory, name, "shared")]
        : (group.overlays ?? []).map((overlay) => path.join(directory, overlay, "js")),
    nodeRuntime: !frontend,
    fallback: group.base ? null : path.join(directory, base.base + "-js"),
    modules: new Set([...base.modules, ...group.modules]),
    extensions: frontend ? [".jsx", ".js", ".css", ".png", ".svg", ".json"] : [".js", ".json"],
    eslint: frontend
      ? frontendLint(directory)
      : new ESLint({
          cwd: directory,
          overrideConfigFile: path.join(templates, "backend-express-js/eslint.config.js"),
        }),
  };
}

async function localModule(reference, parent, group, destinations, filename) {
  const resolved = path.resolve(parent, reference);
  const relative = path.relative(group.targetDir, resolved);
  if (relative.startsWith("..") || !group.extensions.includes(path.extname(reference))) {
    throw new Error(`Referencia local no soportada: ${reference} en ${filename}`);
  }
  const candidates = [resolved];
  for (const store of group.overlayDirs) candidates.push(path.join(store, relative));
  if (group.fallback) candidates.push(path.join(group.fallback, relative));
  for (const candidate of candidates) {
    if (destinations.has(candidate) || (await exists(candidate))) return candidate;
  }
  throw new Error(`Referencia local inexistente: ${reference} en ${filename}`);
}

export async function syncTemplates(
  directory = templates,
  write = false,
  names = Object.keys(groups),
) {
  const selected = names.map((name) => templateGroup(directory, name));
  const destinations = new Set(
    selected.flatMap((group) => group.entries.map(([, file]) => path.join(group.targetDir, file))),
  );
  const changes = new Map();
  const contracts = new Map();
  const replacements = new Map();
  const localImports = [];
  for (const group of selected) {
    for (const [sourceFile, targetFile] of group.entries) {
      const filename = path.join(group.sourceDir, sourceFile);
      const target = path.join(group.targetDir, targetFile);
      const source = await fs.readFile(filename, "utf8");
      const fragment = sourceFile.startsWith("_fragments/");
      const references = new Set();
      const contract = { exports: new Set(), imports: [], nodeRuntime: group.nodeRuntime };
      const compiled = await derive(source, filename, references, contract);
      contracts.set(target, contract);
      if (group.fallback) {
        const baseTarget = path.join(group.fallback, targetFile);
        if (destinations.has(baseTarget)) {
          // i18n sustituye el hook que importa App en la plantilla base.
          replacements.set(baseTarget, target);
        }
      }
      // Los fragmentos se insertan en src/app.js o src/index.js y conservan sus bytes.
      const parent = fragment ? path.join(group.targetDir, "src") : path.dirname(target);
      for (const reference of references) {
        if (reference.startsWith(".")) {
          const moduleFile = await localModule(reference, parent, group, destinations, filename);
          for (const [specifier, name] of contract.imports) {
            if (specifier === reference) localImports.push({ moduleFile, name, filename });
          }
        } else if (!isBuiltin(reference) && !group.modules.has(reference)) {
          throw new Error(`Import no soportado: ${reference} en ${filename}`);
        }
      }
      if (!fragment) {
        // El generador aporta la entrada de la variante en el marcador de main.
        const lintSource =
          sourceFile === "src/main.tsx"
            ? compiled.replace("// @@INSERT:imports@@", "import App from './App.jsx'")
            : compiled;
        const results = await group.eslint.lintText(lintSource, { filePath: target });
        if (results.some((result) => result.errorCount || result.warningCount)) {
          const formatter = await group.eslint.loadFormatter("stylish");
          throw new Error(await formatter.format(results));
        }
      }
      const expected = fragment ? source : compiled;
      // Classic browser scripts must be executable before the application module in both variants.
      const outputs = sourceFile.startsWith("_scripts/")
        ? [target, path.join(group.sourceDir, targetFile)]
        : [target];
      for (const output of outputs) {
        if ((await exists(output)) && (await fs.readFile(output, "utf8")) === expected) continue;
        changes.set(output, expected);
      }
    }
  }
  // Solo contratos de módulos del inventario; Vite gestiona los assets.
  for (const { moduleFile, name, filename } of localImports) {
    for (const candidate of [moduleFile, replacements.get(moduleFile)]) {
      const module = contracts.get(candidate);
      if (module && !module.exports.has(name)) {
        throw new Error(
          `Export inexistente: ${name} en ${candidate} (importado desde ${filename})`,
        );
      }
    }
  }
  if (!write && changes.size) {
    throw new Error(
      `JavaScript desincronizado: ${[...changes.keys()].join(", ")}. Ejecuta npm run derive:js.`,
    );
  }
  for (const [target, expected] of changes) {
    await fs.mkdir(path.dirname(target), { recursive: true });
    await fs.writeFile(target, expected);
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const args = process.argv.slice(2);
  if (args.length > 1 || (args.length === 1 && args[0] !== "--write")) {
    throw new Error("Uso: node scripts/derive-postgres.js [--write]");
  }
  await syncTemplates(undefined, args[0] === "--write");
  console.log("T-023: plantillas JS/JSX sincronizadas y lint correcto.");
}
