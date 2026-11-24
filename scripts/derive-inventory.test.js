import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, expect, it } from "vitest";
import { derive, syncTemplates } from "./derive-postgres.js";
import { resolveInsertionPoints } from "../src/generator/insertions.ts";

let directory;
const file = (relative) => path.join(directory, relative);
const read = (relative) => fs.readFile(file(relative), "utf8");
beforeEach(async () => {
  directory = await fs.mkdtemp(path.join(os.tmpdir(), "brixa-inventory-"));
  await fs.cp(path.resolve(import.meta.dirname, "../src/templates"), directory, {
    recursive: true,
  });
});
afterEach(async () => fs.rm(directory, { recursive: true, force: true }));

it("restaura exactamente todos los pares y fragmentos desde sus fuentes y es idempotente", async () => {
  const snapshot = new Map();
  for (const [base, count] of [
    ["backend-express-js", 9],
    ["frontend-react-js", 6],
    ["database-sqlite/js", 5],
    ["api-docs/js", 7],
    ["auth/js", 42],
    ["auth-postgres/js", 13],
    ["auth-sqlite/js", 18],
    ["i18n/js", 3],
    ["database-postgres/js", 5],
  ]) {
    const files = (await fs.readdir(file(base), { recursive: true })).filter(
      (name) =>
        (/\.jsx?$/.test(name) && !["drizzle.config.js", "eslint.config.js"].includes(name)) ||
        path.dirname(name) === "_fragments",
    );
    expect(files).toHaveLength(count);
    for (const name of files) {
      const relative = path.join(base, name);
      snapshot.set(relative, await read(relative));
      await fs.unlink(file(relative));
    }
  }
  const prepaint = "frontend-react-ts/public/theme-init.js";
  snapshot.set(prepaint, await read(prepaint));
  await fs.unlink(file(prepaint));
  await expect(syncTemplates(directory)).rejects.toThrow("desincronizado");
  await syncTemplates(directory, true);
  await syncTemplates(directory, true);
  await syncTemplates(directory);
  for (const [relative, expected] of snapshot) expect(await read(relative)).toBe(expected);
}, 20_000);

it("conserva las instrucciones JSX e inserta los cuatro fragmentos API reales", async () => {
  const hook = await read("frontend-react-js/src/useAppContent.jsx");
  expect(hook).toContain("<code>src/App.jsx</code>");
  expect(await read("i18n/js/src/useAppContent.jsx")).toContain(
    "./components/LanguageSelector.jsx",
  );
  for (const [host, point] of [
    ["app", "routes"],
    ["index", "startup"],
  ]) {
    const source = await read("backend-express-js/src/" + host + ".js");
    const insertions = {};
    for (const key of ["imports", point]) {
      const fragment = await read("api-docs/js/_fragments/" + host + "." + key);
      insertions[key] = [{ contributor: "api-docs", lines: [fragment.trimEnd()] }];
    }
    const output = resolveInsertionPoints(source, insertions);
    expect(output).not.toContain("@@INSERT:");
    for (const key of ["imports", point]) expect(output).toContain(insertions[key][0].lines[0]);
  }
});

it("detecta un fragmento editado y no escribe resultados parciales si falta una fuente", async () => {
  const fragment = "api-docs/js/_fragments/app.routes";
  await fs.appendFile(file(fragment), "// manual\n");
  const changed = await read(fragment);
  await expect(syncTemplates(directory, false, ["api-docs"])).rejects.toThrow("desincronizado");
  await fs.unlink(file("api-docs/ts/_fragments/index.startup"));
  await expect(syncTemplates(directory, true, ["api-docs"])).rejects.toThrow("ENOENT");
  expect(await read(fragment)).toBe(changed);
});

it.each([
  [
    "api-docs/ts/_fragments/app.imports",
    'import { missing } from "./docs/swagger.js";',
    "Export inexistente: missing",
  ],
  ["api-docs/ts/_fragments/app.routes", "const invalid: number = 1;", "Missing initializer"],
  ["api-docs/ts/src/docs/swagger.ts", 'import "./openapi.json";', "import JSON"],
  ["database-sqlite/ts/src/db/client.ts", 'import "drizzle-orm/typo";', "Import no soportado"],
  ["i18n/ts/src/i18n.ts", 'import "./locales/missing.json";', "Referencia local inexistente"],
])("rechaza una modificación incompatible en %s", async (source, addition, message) => {
  await fs.appendFile(file(source), "\n" + addition + "\n");
  await expect(syncTemplates(directory, true, [source.split("/")[0]])).rejects.toThrow(message);
});

it("exige import type y rutas dinámicas literales", async () => {
  await expect(derive('import {type Props} from "./types.js";', "fixture.ts")).rejects.toThrow(
    "Usa import type",
  );
  await expect(derive("export const load = name => import(name);", "fixture.ts")).rejects.toThrow(
    "imports dinámicos literales",
  );
});

it("comprueba el export que consume App también cuando i18n reemplaza el hook", async () => {
  const source = "i18n/ts/src/useAppContent.tsx";
  await fs.writeFile(
    file(source),
    (await read(source)).replace("function useAppContent(", "function renamed("),
  );
  await expect(syncTemplates(directory, false, ["react", "i18n"])).rejects.toThrow(
    "Export inexistente: useAppContent",
  );
});
