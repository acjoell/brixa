import { URL } from "node:url";

export function connectionUrl(
  variable: "DATABASE_URL" | "MIGRATION_DATABASE_URL",
  env = process.env,
) {
  const runtime = variable === "DATABASE_URL";
  if (
    runtime &&
    (env.MIGRATION_DATABASE_URL !== undefined ||
      env.POSTGRES_PASSWORD !== undefined ||
      env.PGPASSWORD !== undefined ||
      env.PGPASSFILE !== undefined)
  ) {
    throw new Error("El backend recibió credenciales reservadas a administración o migraciones.");
  }
  const value = env[variable];
  if (!value) throw new Error(`Variable de entorno ${variable} no configurada.`);
  try {
    const url = new URL(value);
    if (
      !["postgres:", "postgresql:"].includes(url.protocol) ||
      url.username !== (runtime ? "app_exec" : "table_owner") ||
      !url.hostname ||
      !url.password ||
      url.pathname.length < 2 ||
      env.PGOPTIONS ||
      [...url.searchParams.keys()].some((key) =>
        [
          "user",
          "password",
          "host",
          "port",
          "database",
          "dbname",
          "options",
          "service",
          "connectionString",
        ].includes(key),
      )
    )
      throw new Error();
  } catch {
    throw new Error(`Identidad o URL PostgreSQL inválida en ${variable}.`);
  }
  return value;
}
