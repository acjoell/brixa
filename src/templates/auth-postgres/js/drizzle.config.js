import { defineConfig } from "drizzle-kit";

import { connectionUrl } from "./src/db/connection-url.js";

export default defineConfig({
  dialect: "postgresql",
  schema: "./src/db/schema.js",
  out: "./drizzle",
  ...(process.argv[2] === "generate"
    ? {}
    : { dbCredentials: { url: connectionUrl("MIGRATION_DATABASE_URL") } }),
});
