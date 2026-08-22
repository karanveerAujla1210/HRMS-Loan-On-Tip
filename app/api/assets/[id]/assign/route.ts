import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { z } from "zod";
import { createApiClient, getSessionAndProfile, getRole } from "@/lib/api";
import { writeAudit } from "@/lib/audit";

const AssignSchema = z.object({
  employee_id: z.string().uuid(),
  expected_return_date: z.string().optional().nullable(),
  condition_at_handover: z.string().default("GOOD"),
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

  const parsed = AssignSchema.safeParse(await req.json());
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  const { data: asset } = await supabase
    .from("assets")
    .select("id,asset_code,status,company_id")
    .eq("id", params.id)
    .eq("company_id", profile.company_id)
    .single();

  if (!asset) return NextResponse.json({ error: "Asset not found" }, { status: 404 });
  if (asset.status !== "AVAILABLE") return NextResponse.json({ error: "Asset is not available for assignment" }, { status: 400 });

  const { data: asgn, error: assignErr } = await supabase
    .from("asset_assignments")
    .insert({
      asset_id: params.id,
      employee_id: parsed.data.employee_id,
      assigned_by: profile.employee_id,
      expected_return_date: parsed.data.expected_return_date,
      status: "ACTIVE",
      remarks: parsed.data.remarks || null,
    })
    .select("id")
    .single();

  if (assignErr || !asgn) return NextResponse.json({ error: assignErr?.message ?? "Failed to assign asset" }, { status: 500 });

  await supabase.from("asset_handover").insert({
    asset_assignment_id: asgn.id,
    handover_date: new Date().toISOString().slice(0, 10),
    employee_acknowledged: true,
    condition_at_handover: parsed.data.condition_at_handover,
    remarks: parsed.data.remarks || null,
  });

  await supabase.from("assets").update({
    current_employee_id: parsed.data.employee_id,
    status: "ASSIGNED",
    condition: parsed.data.condition_at_handover,
  }).eq("id", params.id);

  await writeAudit(supabase, {
    company_id: profile.company_id,
    actor_employee_id: profile.employee_id,
    actor_auth_user_id: session.user.id,
    action: "ASSET_ASSIGNED",
    entity_type: "asset_assignments",
    entity_id: asgn.id,
    new_values: { asset_id: params.id, employee_id: parsed.data.employee_id },
  });

  return NextResponse.json({ data: { assignment_id: asgn.id, asset_code: asset.asset_code }, error: null }, { status: 201 });
}
