import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { z } from "zod";
import { createApiClient, getSessionAndProfile, getRole } from "@/lib/api";
import { writeAudit } from "@/lib/audit";

const ReturnSchema = z.object({
  condition: z.enum(["GOOD", "FAIR", "POOR", "DAMAGED"]).default("GOOD"),
  damage_description: z.string().optional().nullable(),
  missing_items: z.string().optional().nullable(),
  recovery_amount: z.coerce.number().min(0).optional().nullable(),
  remarks: z.string().optional().nullable(),
});

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const supabase = await createApiClient();
  const { session, profile } = await getSessionAndProfile(supabase);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!profile?.company_id) return NextResponse.json({ error: "Profile not found" }, { status: 404 });
  if (!profile.employee_id) return NextResponse.json({ error: "Employee not found" }, { status: 404 });

  const role = await getRole(supabase, profile.employee_id);
  if (!role || !["SUPER_ADMIN", "HR_ADMIN", "OPERATIONS_ADMIN", "ASSET_ADMIN"].includes(role)) {
    return NextResponse.json({ error: "Forbidden: insufficient role" }, { status: 403 });
  }

  const parsed = ReturnSchema.safeParse(await req.json());
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  const { data: asgn } = await supabase
    .from("asset_assignments")
    .select("id")
    .eq("asset_id", params.id)
    .eq("status", "ACTIVE")
    .single();

  if (!asgn) return NextResponse.json({ error: "No active assignment found" }, { status: 400 });

  await supabase.from("asset_returns").insert({
    asset_assignment_id: asgn.id,
    return_date: new Date().toISOString().slice(0, 10),
    received_by: profile.employee_id,
    condition_at_return: parsed.data.condition,
    damage_description: parsed.data.damage_description,
    missing_items: parsed.data.missing_items,
    recovery_amount: parsed.data.recovery_amount,
    remarks: parsed.data.remarks,
  });

  await supabase.from("asset_assignments").update({
    status: "RETURNED",
    returned_at: new Date().toISOString(),
  }).eq("id", asgn.id);

  const newStatus = parsed.data.condition === "DAMAGED" ? "DAMAGED" : "AVAILABLE";
  await supabase.from("assets").update({
    status: newStatus,
    condition: parsed.data.condition,
    current_employee_id: null,
  }).eq("id", params.id);

  await writeAudit(supabase, {
    company_id: profile.company_id,
    actor_employee_id: profile.employee_id,
    actor_auth_user_id: session.user.id,
    action: "ASSET_RETURNED",
    entity_type: "asset_returns",
    entity_id: asgn.id,
    new_values: { asset_id: params.id, condition: parsed.data.condition },
  });

  return NextResponse.json({ data: { status: newStatus }, error: null });
}
