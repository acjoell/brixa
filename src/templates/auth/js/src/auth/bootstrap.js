import { randomUUID } from "node:crypto";

import { initialAdministrator, users } from "../db/schema.js";
import { emailSchema } from "./email.js";
import { hashPassword } from "./password-crypto.js";
import { isPasswordWithinLimits } from "./password-limits.js";
import { withSystemAudit } from "./system-audit.js";

export class BootstrapError extends Error {
  constructor(code) {
    super(code);
    this.code = code;
    this.name = "BootstrapError";
  }
}

// En PostgreSQL el llamador operativo usa el adaptador reservado a table_owner.
export async function bootstrapInitialAdministrator(database, { email, password }) {
  const identifier = emailSchema.safeParse(email);
  if (!identifier.success || password === "" || !isPasswordWithinLimits(password)) {
    throw new BootstrapError("INVALID_CREDENTIALS");
  }

  try {
    const [existing] = await database
      .select({ singleton: initialAdministrator.singleton })
      .from(initialAdministrator)
      .limit(1);
    if (existing) throw new BootstrapError("ALREADY_INITIALIZED");

    const passwordHash = await hashPassword(password);
    const userId = randomUUID();
    const now = new Date();
    return await withSystemAudit(
      database,
      { event: "bootstrap", actorId: null, requestId: randomUUID() },
      async (tx) => {
        const [user] = await tx
          .insert(users)
          .values({
            id: userId,
            canonicalIdentifier: identifier.data,
            status: "active",
            passwordHash,
            createdAt: now,
            updatedAt: now,
          })
          .onConflictDoNothing({ target: users.canonicalIdentifier })
          .returning({ id: users.id });
        if (!user) throw new BootstrapError("EMAIL_IN_USE");

        const [authority] = await tx
          .insert(initialAdministrator)
          .values({ singleton: "initial", userId })
          .onConflictDoNothing({ target: initialAdministrator.singleton })
          .returning({ singleton: initialAdministrator.singleton });
        if (!authority) throw new BootstrapError("ALREADY_INITIALIZED");
        return { userId };
      },
    );
  } catch (error) {
    if (error instanceof BootstrapError) throw error;
    // Los errores del driver pueden contener SQL, parámetros o detalles de conexión.
    throw new BootstrapError("BOOTSTRAP_FAILED");
  }
}
