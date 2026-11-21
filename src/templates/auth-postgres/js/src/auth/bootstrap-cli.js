import { runBootstrapConsole } from "./bootstrap-console.js";
import { bootstrapPostgresAdministrator } from "../db/bootstrap.js";

await runBootstrapConsole(bootstrapPostgresAdministrator);
