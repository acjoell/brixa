import { withSqliteAdministrator } from "../db/local-admin.js";
import { runAdminRecoveryConsole } from "./recover-admin-console.js";
import { recoverInitialAdministrator } from "./recover-admin.js";

await runAdminRecoveryConsole((password, requestId) =>
  withSqliteAdministrator((database) => recoverInitialAdministrator(database, password, requestId)),
);
