import { describe, it, expect } from "vitest";

try {
  process.loadEnvFile();
} catch (err: unknown) {
  if ((err as NodeJS.ErrnoException).code !== "ENOENT") {
    throw err;
  }
}

describe("Base de datos SQLite", () => {
  it("conecta correctamente y ejecuta SELECT 1", async (ctx) => {
    if (!process.env.DATABASE_URL) {
      ctx.skip();
      console.log("Prueba de conexión a SQLite omitida: DATABASE_URL no está configurada.");
      return;
    }

    const { client } = await import("../src/db/client.js");
    try {
      const res = await client.execute("SELECT 1 AS alive");
      expect(res.rows[0]?.alive).toBe(1);
    } finally {
      client.close();
    }
  });
});
