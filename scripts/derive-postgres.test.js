import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { URL, pathToFileURL } from "node:url";
import ts from "typescript";
import { afterEach, describe, expect, it } from "vitest";
import { derive, sync } from "./derive-postgres.js";

const temporary = [];
afterEach(async () => {
  for (const directory of temporary.splice(0)) {
    await fs.rm(directory, { recursive: true, force: true });
  }
});

async function copyOverlay() {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), "brixa-sync-"));
  temporary.push(directory);
  await fs.cp(new URL("../src/templates/database-postgres", import.meta.url), directory, {
    recursive: true,
  });
  return directory;
}

describe("Piloto TS → JS PostgreSQL", () => {
  it("conserva comentarios, marcadores, imports y literales al eliminar tipos", async () => {
    const source = `import type { Pool } from "pg";
import { URL } from "node:url";
// @@INSERT:db@@
export const url: URL = new URL("postgres://localhost/test.ts");
export type Database = Pool;
`;
    const output = await derive(source, "client.ts");
    expect(output).toContain("// @@INSERT:db@@");
    expect(output).toContain('import { URL } from "node:url"');
    expect(output).toContain('"postgres://localhost/test.ts"');
    expect(output).not.toContain("Pool");
    expect(output).not.toContain(": URL");
    expect(await derive(source, "client.ts")).toBe(output);
  });

  it("comprueba sin escribir y detecta cambios manuales y archivos ausentes", async () => {
    const directory = await copyOverlay();
    await sync(directory);
    const target = path.join(directory, "js/src/db/client.js");
    await fs.appendFile(target, "\n// cambio manual\n");
    const changed = await fs.readFile(target, "utf8");
    await expect(sync(directory)).rejects.toThrow("JavaScript desincronizado");
    expect(await fs.readFile(target, "utf8")).toBe(changed);
    await fs.unlink(target);
    await expect(sync(directory)).rejects.toThrow("JavaScript desincronizado");
    await sync(directory, true);
    await sync(directory);
  });

  it("detecta fuentes modificadas y rechaza JavaScript con imports duplicados", async () => {
    const directory = await copyOverlay();
    const source = path.join(directory, "ts/src/db/client.ts");
    await fs.appendFile(source, "\nexport const changed = true;\n");
    await expect(sync(directory)).rejects.toThrow("JavaScript desincronizado");
    await fs.appendFile(source, "\nexport const invalid = missing;\n");
    await expect(sync(directory)).rejects.toThrow("no-undef");
    await fs.appendFile(source, '\nimport { URL } from "node:url";\n');
    await expect(sync(directory)).rejects.toThrow();
  });
  it.each([
    'import "./missing.js";',
    'export { missing } from "./missing.js";',
    'export * from "./missing.js";',
    'export const lazy = () => import("./missing.js");',
    'export * from "./schema.ts";',
  ])("rechaza referencias locales inválidas: %s", async (statement) => {
    const directory = await copyOverlay();
    await fs.appendFile(path.join(directory, "ts/src/db/client.ts"), `\n${statement}\n`);
    await expect(sync(directory, true)).rejects.toThrow(/Referencia local/);
  });

  it("conserva exports e imports runtime frente al compilador TypeScript", async () => {
    const directory = await copyOverlay();
    await fs.writeFile(
      path.join(directory, "dependency.mjs"),
      "export const value = 4; export default 3;",
    );
    const source = `import type { Missing } from "missing-types";
import initial, { value as named } from "./dependency.mjs";
import * as namespace from "./dependency.mjs";
export { value as reexported } from "./dependency.mjs";
export * from "./dependency.mjs";
export type Removed = Missing;
export const total: number = initial + named + namespace.value;
export default total;
export const lazy = async (): Promise<number> => (await import("./dependency.mjs")).value;
`;
    const references = new Set();
    const babel = await derive(source, "fixture.ts", references);
    expect([...references]).toEqual(["./dependency.mjs"]);
    const compiled = ts.transpileModule(source, {
      compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
    }).outputText;
    await fs.writeFile(path.join(directory, "babel.mjs"), babel);
    await fs.writeFile(path.join(directory, "typescript.mjs"), compiled);
    const actual = await import(pathToFileURL(path.join(directory, "babel.mjs")).href);
    const expected = await import(pathToFileURL(path.join(directory, "typescript.mjs")).href);
    expect(Object.keys(actual)).toEqual(Object.keys(expected));
    for (const key of ["default", "total", "reexported", "value"]) {
      expect(actual[key]).toBe(expected[key]);
    }
    expect(await actual.lazy()).toBe(await expected.lazy());
  });

  it.each(["fixture.tsx", "fixture.jsx"])(
    "declara JSX/TSX fuera del piloto: %s",
    async (filename) => {
      await expect(derive("export const View = () => <div />;", filename)).rejects.toThrow(
        "JSX/TSX fuera del alcance",
      );
    },
  );
});
