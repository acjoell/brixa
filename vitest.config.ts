import { defineConfig, configDefaults } from "vitest/config";

export default defineConfig({
  test: {
    include: ["src/**/*.test.ts", "scripts/**/*.test.js"],
    exclude: [...configDefaults.exclude, "src/templates/**"],
    environment: "node",
  },
});
