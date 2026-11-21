import { withPostgresAdministrator } from "../db/bootstrap.js";
import { runAdminRecoveryConsole } from "./recover-admin-console.js";
import { recoverInitialAdministrator } from "./recover-admin.js";

await runAdminRecoveryConsole((password, requestId) =>
  withPostgresAdministrator((database) =>
    recoverInitialAdministrator(database, password, requestId),
  ),
);
