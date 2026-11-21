import { createClient } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";
import { migrate } from "drizzle-orm/libsql/migrator";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { clearTimeout, setTimeout } from "node:timers";
import { it } from "vitest";
import * as schema from "../src/db/schema.js";
import { sqliteActivationDatabase } from "../src/db/activation-write.js";
import {
  checkManagedActivation,
  checkManagedActivationRace,
  holdActivationCommit,
  managedActivationFixture,
} from "./managed-activation-contract.js";
import {
  checkAccountActivation,
  checkAccountActivationRaces,
} from "./account-activation-contract.js";
import type { ActivationRace } from "./managed-activation-contract.js";

it.each(["flujo y rollback", "carreras", "consumo y rollback", "carreras de consumo"])(
  "activación administrada SQLite: %s",
  async (scenario) => {
    const dir = await mkdtemp(join(tmpdir(), "brixa-managed-activation-"));
    const url = "file:" + join(dir, "auth.db");
    const first = createClient({ url });
    try {
      const database = drizzle(first, { schema });
      const openDatabase = sqliteActivationDatabase({ url });
      await migrate(database, { migrationsFolder: "drizzle" });
      const fixture = await managedActivationFixture(database);

      if (scenario === "flujo y rollback") {
        await checkManagedActivation(fixture, openDatabase, (event, enabled) =>
          first.execute(
            enabled
              ? `CREATE TRIGGER reject_audit BEFORE INSERT ON audit_log_system WHEN NEW.event='${event}' BEGIN SELECT RAISE(ABORT, 'fixture'); END`
              : "DROP TRIGGER reject_audit",
          ),
        );
        return;
      }

      if (scenario === "consumo y rollback") {
        await checkAccountActivation(fixture, openDatabase, (event, enabled) =>
          first.execute(
            enabled
              ? `CREATE TRIGGER reject_consumption BEFORE INSERT ON audit_log_system WHEN NEW.event='${event}' BEGIN SELECT RAISE(ABORT, 'fixture'); END`
              : "DROP TRIGGER reject_consumption",
          ),
        );
        return;
      }

      const race: ActivationRace = async (start, contend, onBlocked) => {
        const { gated, ready, release } = holdActivationCommit(database);
        const busy = Promise.withResolvers<void>();
        const observeBusy = () => {
          const { database: other, close } = openDatabase();
          const observer = new Proxy(other, {
            get(target, key, receiver) {
              if (key !== "transaction") return Reflect.get(target, key, receiver);
              return async (operation: Parameters<typeof other.transaction>[0]) => {
                try {
                  return await target.transaction(operation);
                } catch (error) {
                  if (error instanceof Error && "code" in error && error.code === "SQLITE_BUSY") {
                    busy.resolve();
                  }
                  throw error;
                }
              };
            },
          });
          return { database: observer, close };
        };
        const firstWork = Promise.allSettled([
          start(() => ({ database: gated, close() {} }), gated),
        ]);
        const timeout = setTimeout(
          () => busy.reject(new Error("SQLite no observó SQLITE_BUSY")),
          3000,
        );
        // Instalar el manejador desde el principio, incluso si la primera operación falla.
        const paused = Promise.allSettled([busy.promise]);
        try {
          await Promise.race([
            ready,
            firstWork.then(() => {
              throw new Error("Primera transacción terminó antes de la barrera");
            }),
          ]);
          const secondWork = Promise.allSettled([contend(observeBusy, database)]);
          try {
            await Promise.race([
              busy.promise,
              secondWork.then(() => {
                throw new Error("Segunda transacción terminó sin SQLITE_BUSY");
              }),
            ]);
            onBlocked?.();
          } finally {
            release();
            await secondWork;
          }
          const [[winner], [contender]] = await Promise.all([firstWork, secondWork]);
          if (winner.status === "rejected") throw winner.reason;
          return [winner.value, contender];
        } finally {
          clearTimeout(timeout);
          busy.resolve();
          release();
          await Promise.all([firstWork, paused]);
        }
      };
      if (scenario === "carreras de consumo")
        await checkAccountActivationRaces(fixture, openDatabase, race);
      else await checkManagedActivationRace(fixture, race);
    } finally {
      first.close();
      await rm(dir, { recursive: true, force: true });
    }
  },
);
