import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { randomBytes } from "node:crypto";
import { readFile } from "node:fs/promises";
import path from "node:path";

export async function provisionPostgres(connection, backendDir, host = "127.0.0.1") {
  const { containerName, database, user, port } = connection;
  const ownerPassword = randomBytes(24).toString("hex");
  const runtimePassword = randomBytes(24).toString("hex");
  const provision = await readFile(path.join(backendDir, "ops", "provision.sql"), "utf8");
  const commands = [
    "SHOW server_version_num;",
    provision,
    `ALTER ROLE table_owner PASSWORD '${ownerPassword}';`,
    `ALTER ROLE app_exec PASSWORD '${runtimePassword}';`,
  ].join("\n");
  try {
    const result = execFileSync(
      "docker",
      [
        "exec",
        "-i",
        containerName,
        "psql",
        "-XAt",
        "-v",
        "ON_ERROR_STOP=1",
        "-U",
        user,
        "-d",
        database,
        "-v",
        "target=" + database,
      ],
      { input: commands, encoding: "utf8", timeout: 15_000, stdio: ["pipe", "pipe", "pipe"] },
    );
    assert.equal(result.split("\n")[0], "170004");
  } catch {
    throw new Error("Falló el aprovisionamiento aislado de PostgreSQL 17.4.");
  }
  const location = `@${host}:${port}/${database}`;
  return {
    DATABASE_URL: "postgresql://app_exec:" + runtimePassword + location,
    MIGRATION_DATABASE_URL: "postgresql://table_owner:" + ownerPassword + location,
  };
}
