import { createClient } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";
import { migrate } from "drizzle-orm/libsql/migrator";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { it } from "vitest";
import { sqliteActivationDatabase } from "../src/db/activation-write.js";
import * as schema from "../src/db/schema.js";
import { checkPasswordChange } from "./change-password-contract.js";

it("cambia la contraseña de forma atómica en SQLite en archivo", async () => {
  const dir = await mkdtemp(join(tmpdir(), "brixa-password-sqlite-"));
  const url = "file:" + join(dir, "auth.db");
  const client = createClient({ url });
  const second = createClient({ url });
  try {
    const database = drizzle(client, { schema });
    await migrate(database, { migrationsFolder: "drizzle" });
    await checkPasswordChange(
      database,
      database,
      drizzle(second, { schema }),
      sqliteActivationDatabase({ url }),
      sqliteActivationDatabase({ url }),
      (open, gate) => () => {
        const { database: connection, close } = open();
        return { database: gate(connection), close };
      },
      (enabled) =>
        client.execute(
          enabled
            ? "CREATE TRIGGER reject_password_change BEFORE INSERT ON audit_log_system WHEN NEW.event='password_changed' BEGIN SELECT RAISE(ABORT, 'fixture'); END"
            : "DROP TRIGGER reject_password_change",
        ),
    );
  } finally {
    second.close();
    client.close();
    await rm(dir, { recursive: true, force: true });
  }
}, 15_000);
