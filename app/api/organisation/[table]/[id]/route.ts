import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { z } from "zod";
import { createApiClient, getSessionAndProfile, getRole } from "@/lib/api";
import { writeAudit } from "@/lib/audit";

const ALLOWED_TABLES = ["departments", "designations", "locations", "shifts", "leave_types", "holidays", "custom_fields"] as const;

export async function PATCH(req: NextRequest, { params }: { params: { table: string; id: string } }) {
  const supabase = await createApiClient();
  const { session, profile } = await getSessionAndProfile(supabase);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!profile?.company_id) return NextResponse.json({ error: "Profile not found" }, { status: 404 });
  if (!profile.employee_id) return NextResponse.json({ error: "Employee not found" }, { status: 404 });

  const role = await getRole(supabase, profile.employee_id);
  if (!role || !["SUPER_ADMIN", "HR_ADMIN"].includes(role)) {
    return NextResponse.json({ error: "Forbidden: insufficient role" }, { status: 403 });
  }

  const table = params.table as typeof ALLOWED_TABLES[number];
  if (!ALLOWED_TABLES.includes(table)) {
    return NextResponse.json({ error: "Invalid table" }, { status: 400 });
  }

  const body = await req.json();
  const { data: updated, error } = await supabase.from(table).update(body).eq("id", params.id).eq("company_id", profile.company_id).select("id").single();

  if (error || !updated) return NextResponse.json({ error: error?.message ?? "Failed to update record" }, { status: 500 });

  await writeAudit(supabase, {
    company_id: profile.company_id,
    actor_employee_id: profile.employee_id,
    actor_auth_user_id: session.user.id,
    action: `ORG_${table.toUpperCase()}_UPDATED`,
    entity_type: table,
    entity_id: params.id,
    new_values: body,
  });

  return NextResponse.json({ data: updated, error: null });
}

export async function DELETE(req: NextRequest, { params }: { params: { table: string; id: string } }) {
  const supabase = await createApiClient();
  const { session, profile } = await getSessionAndProfile(supabase);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!profile?.company_id) return NextResponse.json({ error: "Profile not found" }, { status: 404 });
  if (!profile.employee_id) return NextResponse.json({ error: "Employee not found" }, { status: 404 });

  const role = await getRole(supabase, profile.employee_id);
  if (!role || !["SUPER_ADMIN", "HR_ADMIN"].includes(role)) {
    return NextResponse.json({ error: "Forbidden: insufficient role" }, { status: 403 });
  }

  const table = params.table as typeof ALLOWED_TABLES[number];
  if (!ALLOWED_TABLES.includes(table)) {
    return NextResponse.json({ error: "Invalid table" }, { status: 400 });
  }

  if (table === "holidays") {
    const { error } = await supabase.from(table).delete().eq("id", params.id).eq("company_id", profile.company_id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ data: { deleted: true }, error: null });
  }

  const { data: updated, error } = await supabase.from(table).update({ is_active: false }).eq("id", params.id).eq("company_id", profile.company_id).select("id").single();
  if (error || !updated) return NextResponse.json({ error: error?.message ?? "Failed to deactivate record" }, { status: 500 });

  await writeAudit(supabase, {
    company_id: profile.company_id,
    actor_employee_id: profile.employee_id,
    actor_auth_user_id: session.user.id,
    action: `ORG_${table.toUpperCase()}_DEACTIVATED`,
    entity_type: table,
    entity_id: params.id,
  });

  return NextResponse.json({ data: updated, error: null });
}
