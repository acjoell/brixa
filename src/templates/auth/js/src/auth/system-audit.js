import { randomUUID } from "node:crypto";

import { auditLogSystem } from "../db/schema.js";
import { systemAuditEvents } from "./audit-events.js";

function isDenialEvent(event) {
  return event === "login_failed" || event === "brute_force_detected";
}

// Petición HTTP o invocación CLI: el llamador aporta la correlación de confianza.
export async function recordSystemAudit(database, input) {
  const { event, actorId, requestId } = input;
  if (
    !systemAuditEvents.includes(event) ||
    typeof requestId !== "string" ||
    requestId.length === 0 ||
    requestId.length > 128 ||
    /[^a-zA-Z0-9._:-]/.test(requestId) ||
    !(
      actorId === null ||
      (typeof actorId === "string" &&
        /^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(actorId) &&
        actorId.length === 36)
    )
  ) {
    throw new Error("Evento de auditoría no válido.");
  }
  await database
    .insert(auditLogSystem)
    .values({ id: randomUUID(), event, actorId, requestId, createdAt: new Date() });
}

export class SystemAuditDenied extends Error {
  constructor(event) {
    super("Operación denegada.");
    this.event = event;
  }
}

// El llamador entrega la BD raíz y usa exclusivamente tx dentro de la mutación.
export async function withSystemAudit(database, input, mutate) {
  const { event, actorId, requestId } = input;
  if (isDenialEvent(event)) {
    throw new Error("Un evento de denegación requiere una transacción independiente.");
  }
  try {
    return await database.transaction(async (tx) => {
      const result = await mutate(tx);
      if (result instanceof SystemAuditDenied) throw result;
      await recordSystemAudit(tx, { event, actorId, requestId });
      return result;
    });
  } catch (error) {
    if (error instanceof SystemAuditDenied && isDenialEvent(error.event)) {
      await database.transaction(async (tx) => {
        await recordSystemAudit(tx, { event: error.event, actorId, requestId });
      });
    }
    throw error;
  }
}
