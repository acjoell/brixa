import { describe, it, expect } from "vitest";

try {
  process.loadEnvFile();
} catch (err: unknown) {
  if ((err as NodeJS.ErrnoException).code !== "ENOENT") {
    throw err;
  }
}

describe("Base de datos PostgreSQL", () => {
  it("conecta correctamente y ejecuta SELECT 1", async (ctx) => {
    if (!process.env.DATABASE_URL) {
      ctx.skip();
      console.log("Prueba de conexión a PostgreSQL omitida: DATABASE_URL no está configurada.");
      return;
    }

    const { pool } = await import("../src/db/client.js");
    try {
      const res = await pool.query("SELECT 1 AS alive");
      expect(res.rows[0].alive).toBe(1);
    } finally {
      await pool.end();
    }
  });
});
