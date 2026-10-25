import js from "@eslint/js";
import { defineConfig } from "eslint/config";

export default defineConfig([
  {
    files: ["**/*.js"],
    extends: [js.configs.recommended],
    languageOptions: {
      globals: {
        console: "readonly",
        process: "readonly",
        fetch: "readonly",
      },
    },
  },
]);
