/**
 * Esquema de base de datos (SQLite + Drizzle ORM).
 *
 * Este archivo define las tablas, relaciones e índices de la base de datos.
 * Actualmente se encuentra vacío para que definas los modelos de tu aplicación.
 *
 * Cómo definir una tabla:
 * -----------------------
 * 1. Importa los constructores y tipos de columnas desde "drizzle-orm/sqlite-core":
 *    import { sqliteTable, integer, text } from "drizzle-orm/sqlite-core";
 *
 * 2. Declara y exporta tus tablas:
 *    export const articulos = sqliteTable("articulos", {
 *      id: integer("id").primaryKey({ autoIncrement: true }),
 *      titulo: text("titulo").notNull(),
 *    });
 *
 * Cómo generar y aplicar migraciones:
 * -----------------------------------
 * - Generar migración SQL a partir de los cambios en el esquema:
 *     npm run db:generate
 *
 * - Aplicar las migraciones generadas en la base de datos:
 *     npm run db:migrate
 *
 * Nota:
 * -----
 * Drizzle 1.0 se encuentra en fase RC (Release Candidate) y cambiará el formato de las migraciones en futuras versiones.
 * Este proyecto deniega por defecto el script de instalación de esbuild requerido internamente por drizzle-kit,
 * garantizando la seguridad en la instalación sin afectar al generador de migraciones.
 */
