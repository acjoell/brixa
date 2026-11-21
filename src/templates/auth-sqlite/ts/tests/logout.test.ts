import { createClient } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";
import { migrate } from "drizzle-orm/libsql/migrator";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { it } from "vitest";
import { sqliteActivationDatabase } from "../src/db/activation-write.js";
import * as schema from "../src/db/schema.js";
import { checkLogout } from "./logout-contract.js";

it("valida y cierra sesiones de login en SQLite en archivo", async () => {
  const dir = await mkdtemp(join(tmpdir(), "brixa-logout-sqlite-"));
  const url = "file:" + join(dir, "auth.db");
  const client = createClient({ url });
  const second = createClient({ url });
  try {
    const database = drizzle(client, { schema });
    await migrate(database, { migrationsFolder: "drizzle" });
    await checkLogout(
      database,
      database,
      drizzle(second, { schema }),
      sqliteActivationDatabase({ url }),
      (enabled) =>
        client.execute(
          enabled
            ? "CREATE TRIGGER reject_logout BEFORE INSERT ON audit_log_system WHEN NEW.event='logout' BEGIN SELECT RAISE(ABORT, 'fixture'); END"
            : "DROP TRIGGER reject_logout",
        ),
    );
  } finally {
    second.close();
    client.close();
    await rm(dir, { recursive: true, force: true });
  }
}, 15_000);
