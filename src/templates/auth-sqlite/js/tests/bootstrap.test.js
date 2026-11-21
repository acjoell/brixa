import { createClient } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";
import { migrate } from "drizzle-orm/libsql/migrator";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { it } from "vitest";
import * as schema from "../src/db/schema.js";
import { checkBootstrap, checkBootstrapRace } from "./bootstrap-contract.js";

it.each(["transacción y rollback", "carrera de conexiones independientes"])(
  "bootstrap SQLite: %s",
  async (scenario) => {
    const dir = await mkdtemp(join(tmpdir(), "brixa-bootstrap-"));
    const url = "file:" + join(dir, "auth.db");
    const first = createClient({ url });
    const second = createClient({ url });
    try {
      const database = drizzle(first, { schema });
      await migrate(database, { migrationsFolder: "drizzle" });
      if (scenario === "transacción y rollback") {
        await checkBootstrap(database, (enabled) =>
          first.execute(
            enabled
              ? "CREATE TRIGGER bootstrap_test_failure BEFORE INSERT ON audit_log_system BEGIN SELECT RAISE(ABORT, 'bootstrap test'); END"
              : "DROP TRIGGER bootstrap_test_failure",
          ),
        );
      } else {
        await checkBootstrapRace(database, drizzle(second, { schema }), { serializeWrites: true });
      }
    } finally {
      first.close();
      second.close();
      await rm(dir, { recursive: true, force: true });
    }
  },
);
