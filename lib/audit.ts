import type { SupabaseClient } from "@supabase/supabase-js";

export async function writeAudit(
  supabase: SupabaseClient,
  opts: {
    company_id: string | null;
    actor_employee_id: string | null;
    actor_auth_user_id: string | null;
    action: string;
    entity_type: string;
    entity_id?: string;
    old_values?: Record<string, unknown>;
    new_values?: Record<string, unknown>;
  }
) {
  await supabase.from("audit_logs").insert({
    company_id: opts.company_id,
    actor_employee_id: opts.actor_employee_id,
    actor_auth_user_id: opts.actor_auth_user_id,
    action: opts.action,
    entity_type: opts.entity_type,
    entity_id: opts.entity_id ?? null,
    old_values: opts.old_values ?? null,
    new_values: opts.new_values ?? null,
  });
}
