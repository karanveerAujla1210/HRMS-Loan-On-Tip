import "server-only";
import { adminClient, hasAdminCredentials } from "./supabase";
import { internalError } from "./errors";

export type AuditEvent = {
  action: string;
  entityType: string;
  entityId?: string | null;
  companyId?: string | null;
  actorEmployeeId?: string | null;
  actorAuthUserId?: string | null;
  oldValues?: Record<string, unknown> | null;
  newValues?: Record<string, unknown> | null;
  requestId?: string | null;
  ipAddress?: string | null;
  userAgent?: string | null;
  metadata?: Record<string, unknown> | null;
};

/** Field names that must never be written into an audit payload. */
const REDACTED_KEYS = [
  "password",
  "account_number",
  "account_number_encrypted",
  "pan_encrypted",
  "pan_number",
  "aadhaar_number",
  "document_number",
  "document_number_encrypted",
  "token",
  "secret",
  "authorization",
];

export function redact(
  values: Record<string, unknown> | null | undefined
): Record<string, unknown> | null {
  if (!values) return null;
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(values)) {
    out[REDACTED_KEYS.some((k) => key.toLowerCase().includes(k)) ? `${key}__redacted` : key] =
      REDACTED_KEYS.some((k) => key.toLowerCase().includes(k)) ? "[redacted]" : value;
  }
  return out;
}

/**
 * Appends an audit event.
 *
 * Audit rows are written with the privileged client because the table is
 * append-only for everyone else. A failure here fails the request: an
 * unauditable sensitive mutation is not an acceptable outcome.
 */
export async function writeAudit(event: AuditEvent): Promise<void> {
  if (!hasAdminCredentials()) {
    throw internalError(
      "Audit logging is unavailable because SUPABASE_SERVICE_ROLE_KEY is not configured"
    );
  }

  const { error } = await adminClient()
    .from("audit_logs")
    .insert({
      company_id: event.companyId ?? null,
      actor_employee_id: event.actorEmployeeId ?? null,
      actor_auth_user_id: event.actorAuthUserId ?? null,
      action: event.action,
      entity_type: event.entityType,
      entity_id: event.entityId ?? null,
      old_values: redact(event.oldValues),
      new_values: redact(event.newValues),
      ip_address: event.ipAddress ?? null,
      user_agent: event.userAgent ?? null,
      request_id: event.requestId ?? null,
      metadata: event.metadata ?? null,
    });

  if (error) {
    throw internalError(`Audit log write failed: ${error.message}`);
  }
}

/** Best-effort API request log. Never fails the request. */
export async function writeApiLog(entry: {
  requestId: string;
  authUserId?: string | null;
  employeeId?: string | null;
  method: string;
  endpoint: string;
  statusCode: number;
  durationMs: number;
  ipAddress?: string | null;
  userAgent?: string | null;
  errorCode?: string | null;
}): Promise<void> {
  if (!hasAdminCredentials()) return;
  try {
    await adminClient().from("api_logs").insert({
      request_id: entry.requestId,
      user_id: entry.authUserId ?? null,
      employee_id: entry.employeeId ?? null,
      method: entry.method,
      endpoint: entry.endpoint.slice(0, 500),
      status_code: entry.statusCode,
      duration_ms: entry.durationMs,
      ip_address: entry.ipAddress ?? null,
      user_agent: entry.userAgent ?? null,
      error_code: entry.errorCode ?? null,
    });
  } catch {
    // Observability must never break the request path.
  }
}
