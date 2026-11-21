import { randomUUID } from "node:crypto";
import type { db } from "../db/client.js";
import { auditLogSystem } from "../db/schema.js";
import { isDenialEvent, systemAuditEvents } from "./audit-events.js";
import type { DenialEvent, SystemAuditEventName } from "./audit-events.js";

type SystemAuditEvent = {
  event: SystemAuditEventName;
  actorId: string | null;
  requestId: string;
};

type AuditContext = Omit<SystemAuditEvent, "event">;
type SuccessAuditInput = AuditContext & { event?: Exclude<SystemAuditEventName, DenialEvent> };
type AuditWrite = Pick<typeof db, "select" | "insert" | "update" | "delete">;
type AuditTransactions = { transaction<T>(operation: (tx: AuditWrite) => Promise<T>): Promise<T> };

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
  constructor(
    readonly event: DenialEvent,
    readonly actorId?: string | null,
  ) {
    super("Operación denegada.");
  }
}

// El llamador entrega un ejecutor de transacciones raíz y usa exclusivamente tx.
// Si hay varios eventos de éxito o la operación es idempotente, el llamador
// registra los eventos correspondientes dentro de su callback.
export async function withSystemAudit<T>(
  database: AuditTransactions,
  input: SuccessAuditInput,
  mutate: (tx: AuditWrite) => Promise<T>,
): Promise<T> {
  const { event, actorId, requestId } = input;
  if (event !== undefined && isDenialEvent(event)) {
    throw new Error("Un evento de denegación requiere una transacción independiente.");
  }
  try {
    return await database.transaction(async (tx) => {
      const result = await mutate(tx);
      if (result instanceof SystemAuditDenied) throw result;
      if (event !== undefined) await recordSystemAudit(tx, { event, actorId, requestId });
      return result;
    });
  } catch (error) {
    if (error instanceof SystemAuditDenied && isDenialEvent(error.event)) {
      await database.transaction(async (tx) => {
        await recordSystemAudit(tx, {
          event: error.event,
          actorId: error.actorId === undefined ? actorId : error.actorId,
          requestId,
        });
      });
    }
    throw error;
  }
}
