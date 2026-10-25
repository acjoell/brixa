import js from "@eslint/js";
import tseslint from "typescript-eslint";
import prettier from "eslint-config-prettier";

export default tseslint.config(
  js.configs.recommended,
  ...tseslint.configs.strictTypeChecked,
  prettier,
  {
    languageOptions: {
      parserOptions: {
        projectService: {
          // Config files at the root are outside tsconfig rootDir (src/).
          // allowDefaultProject parses them without type-aware rules.
          allowDefaultProject: ["*.config.js", "*.config.ts"],
        },
        tsconfigRootDir: import.meta.dirname,
      },
    },
  },
  {
    // Disable type-checked rules for files not covered by tsconfig
    // (root config files matched by allowDefaultProject, and test files).
    files: ["*.config.js", "*.config.ts", "scripts/**/*.js", "**/*.test.ts"],
    extends: [tseslint.configs.disableTypeChecked],
  },
  {
    ignores: ["dist/", "node_modules/", "coverage/", "src/templates/"],
  },
  {
    files: ["scripts/**/*.js"],
    languageOptions: {
      globals: { process: "readonly", console: "readonly" },
    },
  },
);
