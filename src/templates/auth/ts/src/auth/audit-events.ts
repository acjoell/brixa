type AuditMetadata = {
  category: "authentication" | "session" | "identity" | "security";
  severity: "info" | "warning" | "high";
  denial?: true;
};

export const systemAuditCatalog = Object.freeze({
  login_succeeded: { category: "authentication", severity: "info" },
  login_failed: { category: "authentication", severity: "warning", denial: true },
  logout: { category: "session", severity: "info" },
  account_activated: { category: "identity", severity: "info" },
  password_changed: { category: "identity", severity: "info" },
  brute_force_detected: { category: "security", severity: "high", denial: true },
  user_created: { category: "identity", severity: "info" },
  user_disabled: { category: "identity", severity: "warning" },
  bootstrap: { category: "identity", severity: "info" },
  activation_token_issued: { category: "identity", severity: "info" },
  activation_token_consumed: { category: "identity", severity: "info" },
  activation_token_revoked: { category: "identity", severity: "info" },
  activation_token_expired: { category: "identity", severity: "info" },
  platform_admin_access_denied: { category: "security", severity: "warning", denial: true },
  initial_admin_password_recovered: { category: "security", severity: "warning" },
} as const satisfies Record<string, AuditMetadata>);

export type SystemAuditEventName = keyof typeof systemAuditCatalog;
export type DenialEvent = {
  [Name in SystemAuditEventName]: (typeof systemAuditCatalog)[Name] extends { denial: true }
    ? Name
    : never;
}[SystemAuditEventName];

for (const metadata of Object.values(systemAuditCatalog)) Object.freeze(metadata);

export const systemAuditEvents = Object.freeze(
  Object.keys(systemAuditCatalog) as SystemAuditEventName[],
);

export function isDenialEvent(event: SystemAuditEventName): event is DenialEvent {
  if (!Object.hasOwn(systemAuditCatalog, event)) return false;
  const metadata: AuditMetadata = systemAuditCatalog[event];
  return metadata.denial === true;
}
