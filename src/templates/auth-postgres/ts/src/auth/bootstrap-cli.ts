import { runBootstrapConsole } from "./bootstrap-console.js";
import { hasInitialAdministrator } from "./bootstrap.js";
import { bootstrapPostgresAdministrator, withPostgresAdministrator } from "../db/bootstrap.js";

await runBootstrapConsole(bootstrapPostgresAdministrator, () =>
  withPostgresAdministrator(hasInitialAdministrator),
);
