/**
 * Esquema de base de datos (PostgreSQL + Drizzle ORM).
 *
 * Este archivo define las tablas, relaciones e índices de la base de datos.
 * Actualmente se encuentra vacío para que definas los modelos de tu aplicación.
 *
 * Cómo definir una tabla:
 * -----------------------
 * 1. Importa los constructores y tipos de columnas desde "drizzle-orm/pg-core":
 *    import { pgTable, serial, text, timestamp } from "drizzle-orm/pg-core";
 *
 * 2. Declara y exporta tus tablas:
 *    export const articulos = pgTable("articulos", {
 *      id: serial("id").primaryKey(),
 *      titulo: text("titulo").notNull(),
 *      creadoEn: timestamp("creado_en").defaultNow().notNull(),
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
 */
