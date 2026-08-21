import type { SupabaseClient } from "@supabase/supabase-js";

interface AuditParams {
  company_id: string;
  actor_employee_id?: string | null;
  actor_auth_user_id: string;
  action: string;
  entity_type: string;
  entity_id?: string | null;
  old_values?: Record<string, unknown>;
  new_values?: Record<string, unknown>;
}

export async function writeAudit(supabase: SupabaseClient, params: AuditParams) {
  const { error } = await supabase.from("audit_logs").insert({
    company_id: params.company_id,
    actor_employee_id: params.actor_employee_id ?? null,
    actor_auth_user_id: params.actor_auth_user_id,
    action: params.action,
    entity_type: params.entity_type,
    entity_id: params.entity_id ?? null,
    old_values: params.old_values ?? null,
    new_values: params.new_values ?? null,
    created_at: new Date().toISOString(),
  });

  if (error) throw new Error(`Audit log write failed: ${error.message}`);
}
