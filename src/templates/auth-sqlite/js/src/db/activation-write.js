import { createClient } from "@libsql/client";

import { drizzle } from "drizzle-orm/libsql";
import { and, eq } from "drizzle-orm";
import { setTimeout } from "node:timers/promises";

import * as schema from "./schema.js";

export { isInitialAdministrator as hasActivationAuthority } from "../auth/initial-administrator.js";

export function sqliteActivationDatabase(config) {
  return () => {
    const client = createClient(config);
    return { database: drizzle(client, { schema }), close: () => client.close() };
  };
}

export async function withActivationWrite(openDatabase, operation) {
  // libSQL abre BEGIN IMMEDIATE. Un fallo SQLITE_BUSY al abrir puede dejar
  // bloqueos en la conexión local hasta cerrarla. Cada intento tiene su propio
  // cliente y solo se reintenta antes de ejecutar el callback.
  for (let retry = 0; ; retry++) {
    const { database, close } = openDatabase();
    let started = false;
    try {
      return await database.transaction(async (tx) => {
        started = true;
        return operation(tx);
      });
    } catch (error) {
      if (
        started ||
        retry >= 10 ||
        !(error instanceof Error) ||
        !("code" in error) ||
        error.code !== "SQLITE_BUSY"
      )
        throw error;
    } finally {
      close();
    }
    await setTimeout(20);
  }
}

export async function lockAccount(tx, userId) {
  const { users } = schema;
  const [user] = await tx
    .select({ status: users.status, passwordHash: users.passwordHash })
    .from(users)
    .where(eq(users.id, userId));
  return user;
}

export async function lockActivationUser(tx, userId) {
  return (await lockAccount(tx, userId))?.status;
}

export async function readActivation(openDatabase, read) {
  const { database, close } = openDatabase();
  try {
    return await read(database);
  } finally {
    close();
  }
}

export async function lockActivationToken(tx, userId, digest) {
  const { activationTokens } = schema;
  const [token] = await tx
    .select({ status: activationTokens.status, expiresAt: activationTokens.expiresAt })
    .from(activationTokens)
    .where(and(eq(activationTokens.userId, userId), eq(activationTokens.tokenDigest, digest)));
  return token;
}
