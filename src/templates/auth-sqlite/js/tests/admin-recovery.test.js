import assert from "node:assert/strict";
import { createClient } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";
import { migrate } from "drizzle-orm/libsql/migrator";
import { cp, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { it } from "vitest";
import { sqliteActivationDatabase } from "../src/db/activation-write.js";
import * as schema from "../src/db/schema.js";
import { checkAdminRecovery } from "./admin-recovery-contract.js";

it("recupera al administrador y conserva la auditoría SQLite al migrar desde 0005", async () => {
  const directory = await mkdtemp(join(tmpdir(), "brixa-recovery-sqlite-"));
  const url = "file:" + join(directory, "auth.db");
  const first = createClient({ url });
  const second = createClient({ url });
  try {
    for (const client of [first, second]) await client.execute("PRAGMA foreign_keys=ON");
    const owner = drizzle(first, { schema });
    const other = drizzle(second, { schema });
    const old = join(directory, "drizzle");
    await cp("drizzle", old, { recursive: true });
    const path = join(old, "meta", "_journal.json");
    const journal = JSON.parse(await readFile(path, "utf8"));
    journal.entries = journal.entries.slice(0, 6);
    await writeFile(path, JSON.stringify(journal));
    await migrate(owner, { migrationsFolder: old });
    const history = () => first.execute("SELECT * FROM __drizzle_migrations ORDER BY created_at");
    const priorHistory = (await history()).rows;
    assert.equal(priorHistory.length, 6);
    const writer = sqliteActivationDatabase({ url });
    await checkAdminRecovery(
      owner,
      other,
      other,
      writer,
      (gate) => () => {
        const { database, close } = writer();
        return { database: gate(database), close };
      },
      async () => {
        await migrate(owner, { migrationsFolder: "drizzle" });
        const migrated = (await history()).rows;
        assert.equal(migrated.length, 7);
        assert.deepEqual(migrated.slice(0, 6), priorHistory);
        await migrate(owner, { migrationsFolder: "drizzle" });
        assert.deepEqual((await history()).rows, migrated);
        const objects = (
          await first.execute(
            "SELECT name, sql FROM sqlite_schema WHERE tbl_name='audit_log_system' ORDER BY name",
          )
        ).rows;
        assert.match(
          String(objects.find(({ name }) => name === "audit_log_system")?.sql),
          /WITHOUT ROWID/i,
        );
        for (const trigger of ["no_update", "no_delete", "no_replace"])
          assert(objects.some(({ name }) => name === "audit_system_" + trigger));
        for (const sql of [
          "UPDATE audit_log_system SET request_id='changed'",
          "DELETE FROM audit_log_system",
          "REPLACE INTO audit_log_system SELECT * FROM audit_log_system LIMIT 1",
        ])
          await assert.rejects(first.execute(sql), /append-only/);
      },
      (enabled) =>
        first.execute(
          enabled
            ? "CREATE TRIGGER reject_recovery BEFORE INSERT ON audit_log_system WHEN NEW.event='initial_admin_password_recovered' BEGIN SELECT RAISE(ABORT, 'fixture'); END"
            : "DROP TRIGGER reject_recovery",
        ),
    );
  } finally {
    second.close();
    first.close();
    await rm(directory, { force: true, recursive: true });
  }
}, 15_000);
