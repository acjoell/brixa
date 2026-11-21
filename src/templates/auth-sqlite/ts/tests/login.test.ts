import { createClient } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";
import { migrate } from "drizzle-orm/libsql/migrator";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { it } from "vitest";
import { sqliteActivationDatabase } from "../src/db/activation-write.js";
import * as schema from "../src/db/schema.js";
import { checkLogin, pauseLoginLookup } from "./login-contract.js";

it("login SQLite en archivo: credenciales, auditoría, rollback y concurrencia", async () => {
  const dir = await mkdtemp(join(tmpdir(), "brixa-login-sqlite-"));
  const url = "file:" + join(dir, "auth.db");
  const client = createClient({ url });
  const runtime = createClient({ url });
  try {
    const owner = drizzle(client, { schema });
    await migrate(owner, { migrationsFolder: "drizzle" });
    await checkLogin(
      owner,
      drizzle(runtime, { schema }),
      sqliteActivationDatabase({ url }),
      sqliteActivationDatabase({ url }),
      (open, pause) => () => {
        const { database, close } = open();
        return { database: pauseLoginLookup(database, pause), close };
      },
      (enabled) =>
        client.execute(
          enabled
            ? "CREATE TRIGGER reject_login BEFORE INSERT ON audit_log_system WHEN NEW.event='login_succeeded' BEGIN SELECT RAISE(ABORT, 'fixture'); END"
            : "DROP TRIGGER reject_login",
        ),
    );
  } finally {
    runtime.close();
    client.close();
    await rm(dir, { recursive: true, force: true });
  }
}, 15_000);
