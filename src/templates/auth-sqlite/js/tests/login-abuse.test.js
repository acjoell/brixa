import { createClient } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";
import { migrate } from "drizzle-orm/libsql/migrator";
import { cp, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { expect, it } from "vitest";
import { sqliteActivationDatabase } from "../src/db/activation-write.js";
import * as schema from "../src/db/schema.js";
import { recordSystemAudit } from "../src/auth/system-audit.js";
import { checkLoginAbuse } from "./login-abuse-contract.js";

it("persiste los límites de login tras migrar SQLite en archivo desde 0007", async () => {
  const directory = await mkdtemp(join(tmpdir(), "brixa-login-abuse-"));
  const url = "file:" + join(directory, "auth.db");
  const client = createClient({ url });
  try {
    const db = drizzle(client, { schema });
    const old = join(directory, "drizzle");
    await cp("drizzle", old, { recursive: true });
    const path = join(old, "meta", "_journal.json");
    const journal = JSON.parse(await readFile(path, "utf8"));
    journal.entries = journal.entries.slice(0, 8);
    await writeFile(path, JSON.stringify(journal));
    await migrate(db, { migrationsFolder: old });
    await recordSystemAudit(db, { event: "login_failed", actorId: null, requestId: "before-0008" });
    const oldCounter = { keyDigest: "a".repeat(64), hits: 3, expiresAtMs: 2_000_000_000_000 };
    await db.insert(schema.loginAbuseCounters).values(oldCounter);
    const audit = await db.select().from(schema.auditLogSystem);
    const history = async () =>
      (await client.execute("SELECT * FROM __drizzle_migrations ORDER BY created_at")).rows;
    const previous = await history();
    expect(previous).toHaveLength(8);
    await migrate(db, { migrationsFolder: "drizzle" });
    const applied = await history();
    expect(applied).toHaveLength(9);
    expect(applied.slice(0, 8)).toEqual(previous);
    expect(await db.select().from(schema.loginAbuseCounters)).toEqual([oldCounter]);
    await migrate(db, { migrationsFolder: "drizzle" });
    expect(await history()).toEqual(applied);
    await checkLoginAbuse(
      sqliteActivationDatabase({ url }),
      sqliteActivationDatabase({ url }),
      (enabled) =>
        client.execute(
          enabled
            ? "CREATE TRIGGER reject_abuse_update BEFORE UPDATE ON login_abuse_counters BEGIN SELECT RAISE(ABORT, 'private fixture'); END"
            : "DROP TRIGGER reject_abuse_update",
        ),
    );
    await expect(client.execute("DELETE FROM audit_log_system")).rejects.toThrow();
    expect(await db.select().from(schema.auditLogSystem)).toEqual(audit);
  } finally {
    client.close();
    await rm(directory, { recursive: true, force: true });
  }
}, 15_000);
