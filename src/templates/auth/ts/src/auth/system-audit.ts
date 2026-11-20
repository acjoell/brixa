import { randomUUID } from "node:crypto";
import type { db } from "../db/client.js";
import { auditLogSystem } from "../db/schema.js";
import { systemAuditEvents } from "./audit-events.js";

type SystemAuditEvent = {
  event: (typeof systemAuditEvents)[number];
  actorId: string | null;
  requestId: string;
};

type DenialEvent = Extract<SystemAuditEvent["event"], "login_failed" | "brute_force_detected">;
type SuccessAuditEvent = SystemAuditEvent & {
  event: Exclude<SystemAuditEvent["event"], DenialEvent>;
};

function isDenialEvent(event: SystemAuditEvent["event"]): event is DenialEvent {
  return event === "login_failed" || event === "brute_force_detected";
}

// Petición HTTP o invocación CLI: el llamador aporta la correlación de confianza.
export async function recordSystemAudit(
  database: Pick<typeof db, "insert">,
  input: SystemAuditEvent,
) {
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
  constructor(readonly event: DenialEvent) {
    super("Operación denegada.");
  }
}

// El llamador entrega la BD raíz y usa exclusivamente tx dentro de la mutación.
export async function withSystemAudit<T>(
  database: typeof db,
  input: SuccessAuditEvent,
  mutate: (tx: Pick<typeof db, "select" | "insert" | "update" | "delete">) => Promise<T>,
): Promise<T> {
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
