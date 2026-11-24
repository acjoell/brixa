import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { URL } from "node:url";
import ts from "typescript";
import { transformSync } from "@babel/core";
import { afterEach, describe, expect, it } from "vitest";
import { derive, syncTemplates } from "./derive-postgres.js";
import { resolveInsertionPoints } from "../src/generator/insertions.ts";

const templates = new URL("../src/templates/", import.meta.url);
const temporary = [];
const syncFrontend = (directory, write) => syncTemplates(directory, write, ["react"]);
afterEach(async () => {
  for (const directory of temporary.splice(0))
    await fs.rm(directory, { recursive: true, force: true });
});

async function copyMain() {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), "brixa-tsx-"));
  temporary.push(directory);
  for (const language of ["ts", "js"]) {
    const base = `frontend-react-${language}`;
    await fs.cp(new URL(base, templates), path.join(directory, base), { recursive: true });
  }
  return directory;
}

describe("Incremento React main TSX → JSX", () => {
  it("preserva JSX, tipos borrados, comentarios, marcadores y literales", async () => {
    const source = `import type { Props } from "./types.ts";
import { Widget } from "./Widget.tsx";
export { Widget } from "./Widget.tsx";
export { label } from "./label.ts";
// @@INSERT:imports@@
export const literal = "./Widget.tsx";
export const lazy = () => import("./Widget.tsx");
export const View = <T,>({ value }: Props<T>) => <><Widget value={value!} />{/* conservar */}<code>src/App.tsx</code></>;
`;
    const references = new Set();
    const output = await derive(source, "View.tsx", references);
    expect([...references]).toEqual(["./Widget.jsx", "./label.js"]);
    expect(output).not.toContain("./types.ts");
    expect(output).not.toContain("Props");
    expect(output).toContain("// @@INSERT:imports@@");
    expect(output).toContain("{/* conservar */}");
    expect(output).toContain("<code>src/App.tsx</code>");
    expect(output).toContain("<Widget value={value} />");
    expect(output).toContain('literal = "./Widget.tsx"');
    expect(output).toContain('import("./Widget.jsx")');
    expect(output).not.toContain("jsx-runtime");
    expect(await derive(source, "View.tsx")).toBe(output);
  });

  it("el main real conserva el resultado del compilador TypeScript con JSX preserve", async () => {
    const source = await fs.readFile(new URL("frontend-react-ts/src/main.tsx", templates), "utf8");
    const expected = ts.transpileModule(source.replace("'./App.tsx'", "'./App.jsx'"), {
      compilerOptions: {
        jsx: ts.JsxEmit.Preserve,
        module: ts.ModuleKind.ESNext,
        target: ts.ScriptTarget.ES2022,
      },
      reportDiagnostics: true,
    });
    expect(expected.diagnostics).toEqual([]);
    const normalize = (code) =>
      transformSync(code, {
        babelrc: false,
        configFile: false,
        parserOpts: { plugins: ["jsx"] },
        comments: false,
        compact: true,
        minified: true,
      }).code;
    expect(normalize(await derive(source, "main.tsx"))).toBe(normalize(expected.outputText));
  });

  it("detecta edición manual de JSX sin escribir y restaura un main ausente", async () => {
    const directory = await copyMain();
    await syncFrontend(directory);
    const target = path.join(directory, "frontend-react-js/src/main.jsx");
    const original = await fs.readFile(target, "utf8");
    const changed = original.replace("<App", '<App data-test="manual"');
    expect(changed).not.toBe(original);
    await fs.writeFile(target, changed);
    await expect(syncFrontend(directory)).rejects.toThrow("JavaScript desincronizado");
    expect(await fs.readFile(target, "utf8")).toBe(changed);
    await fs.unlink(target);
    await expect(syncFrontend(directory)).rejects.toThrow("JavaScript desincronizado");
    await syncFrontend(directory, true);
    expect(await fs.readFile(target, "utf8")).toBe(original);
    await syncFrontend(directory);
  });

  it("admite la inserción i18n existente sin generar proyectos", async () => {
    const source = await fs.readFile(new URL("frontend-react-ts/src/main.tsx", templates), "utf8");
    const main = await derive(source, "main.tsx");
    const output = resolveInsertionPoints(main, {
      imports: [{ contributor: "i18n", lines: ["import './i18n.js'"] }],
    });
    expect(output).toContain("import './i18n.js'");
    expect(output).not.toContain("@@INSERT:");
    expect(output).toContain("projectName={document.title}");
    expect(output).toContain(
      "initialThemePreference={document.documentElement.dataset.themePreference}",
    );
  });

  it("detecta cambios TSX, imports inexistentes y errores de lint", async () => {
    const directory = await copyMain();
    const sourceFile = path.join(directory, "frontend-react-ts/src/main.tsx");
    const source = await fs.readFile(sourceFile, "utf8");
    await fs.writeFile(sourceFile, `${source}\nexport const changed: boolean = true;\n`);
    await expect(syncFrontend(directory)).rejects.toThrow("JavaScript desincronizado");
    await fs.writeFile(sourceFile, source.replace("./App.tsx", "./Missing.tsx"));
    await expect(syncFrontend(directory, true)).rejects.toThrow(
      "Referencia local inexistente: ./Missing.jsx",
    );
    await fs.writeFile(sourceFile, `${source}\nexport const invalid = missing;\n`);
    await expect(syncFrontend(directory, true)).rejects.toThrow("no-undef");
  });
});
