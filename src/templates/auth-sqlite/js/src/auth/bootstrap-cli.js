import { withSqliteAdministrator } from "../db/local-admin.js";
import { bootstrapInitialAdministrator } from "./bootstrap.js";
import { runBootstrapConsole } from "./bootstrap-console.js";

await runBootstrapConsole((credentials) =>
  withSqliteAdministrator((database) => bootstrapInitialAdministrator(database, credentials)),
);
