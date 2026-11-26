import { describe, it, expect } from "vitest";

try {
  process.loadEnvFile();
} catch (err: unknown) {
  if ((err as NodeJS.ErrnoException).code !== "ENOENT") {
    throw err;
  }
}

describe("Base de datos PostgreSQL", () => {
  it("conecta como app_exec con privilegios limitados", async (ctx) => {
    if (!process.env.DATABASE_URL) {
      ctx.skip();
      console.log("Prueba de conexión a PostgreSQL omitida: DATABASE_URL no está configurada.");
      return;
    }

    const { checkRuntimeIdentity, pool } = await import("../src/db/client.js");
    try {
      await checkRuntimeIdentity();
      const res = await pool.query("SELECT current_user AS identity, 1 AS alive");
      expect(res.rows[0]).toEqual({ identity: "app_exec", alive: 1 });
      const client = await pool.connect();
      try {
        await client.query("BEGIN");
        await expect(
          client.query("CREATE TEMP TABLE brixa_forbidden (id int)"),
        ).rejects.toMatchObject({
          code: "42501",
        });
      } finally {
        await client.query("ROLLBACK").finally(() => client.release());
      }
    } finally {
      await pool.end();
    }
  });
});
