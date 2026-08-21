import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createApiClient, getSessionAndProfile, getRole } from "@/lib/api";
import { writeAudit } from "@/lib/audit";

const APPROVER_ROLES = ["SUPER_ADMIN", "HR_ADMIN", "MANAGER"];

const PostSchema = z.object({
  attendance_id: z.string().uuid(),
  new_check_in: z.string().datetime({ offset: true }).optional(),
  new_check_out: z.string().datetime({ offset: true }).optional(),
  reason: z.string().min(1),
});

const PatchSchema = z.object({
  adjustment_id: z.string().uuid(),
  action: z.enum(["APPROVED", "REJECTED"]),
});

export async function POST(req: NextRequest) {
  const supabase = await createApiClient();
  const { session, profile } = await getSessionAndProfile(supabase);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!profile?.employee_id) return NextResponse.json({ error: "Employee not found" }, { status: 404 });

  const parsed = PostSchema.safeParse(await req.json());
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  const body = parsed.data;

  const { data: att } = await supabase
    .from("attendance")
    .select("id,check_in_at,check_out_at,status")
    .eq("id", body.attendance_id)
    .single();
  if (!att) return NextResponse.json({ error: "Attendance record not found" }, { status: 404 });

  const { data: adj, error } = await supabase
    .from("attendance_adjustments")
    .insert({
      attendance_id: body.attendance_id,
      requested_by: profile.employee_id,
      old_values: { check_in_at: att.check_in_at, check_out_at: att.check_out_at, status: att.status },
      new_values: {
        check_in_at: body.new_check_in ?? att.check_in_at,
        check_out_at: body.new_check_out ?? att.check_out_at,
      },
      reason: body.reason,
      status: "PENDING",
    })
    .select("id")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  await writeAudit(supabase, {
    company_id: profile.company_id,
    actor_employee_id: profile.employee_id,
    actor_auth_user_id: session.user.id,
    action: "CORRECTION_REQUESTED",
    entity_type: "attendance_adjustments",
    entity_id: adj?.id,
    new_values: { reason: body.reason },
  });

  return NextResponse.json({ data: { adjustment_id: adj?.id }, error: null });
}

export async function PATCH(req: NextRequest) {
  const supabase = await createApiClient();
  const { session, profile } = await getSessionAndProfile(supabase);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!profile?.employee_id) return NextResponse.json({ error: "Employee not found" }, { status: 404 });

  const role = await getRole(supabase, profile.employee_id);
  if (!role || !APPROVER_ROLES.includes(role)) {
    return NextResponse.json({ error: "Forbidden: insufficient role" }, { status: 403 });
  }

  const parsed = PatchSchema.safeParse(await req.json());
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  const { adjustment_id, action } = parsed.data;

  const { data: adj } = await supabase
    .from("attendance_adjustments")
    .select("id,attendance_id,new_values")
    .eq("id", adjustment_id)
    .single();
  if (!adj) return NextResponse.json({ error: "Adjustment not found" }, { status: 404 });

  await supabase.from("attendance_adjustments").update({
    status: action,
    approved_by: profile.employee_id,
    approved_at: new Date().toISOString(),
  }).eq("id", adjustment_id);

  if (action === "APPROVED") {
    const nv = adj.new_values as Record<string, string>;
    const updates: Record<string, unknown> = { is_manual_adjustment: true };
    if (nv.check_in_at) updates.check_in_at = nv.check_in_at;
    if (nv.check_out_at) {
      updates.check_out_at = nv.check_out_at;
      if (nv.check_in_at) {
        updates.worked_minutes = Math.max(0, Math.floor(
          (new Date(nv.check_out_at).getTime() - new Date(nv.check_in_at).getTime()) / 60000
        ));
      }
    }
    await supabase.from("attendance").update(updates).eq("id", adj.attendance_id);
  }

  await writeAudit(supabase, {
    company_id: profile.company_id,
    actor_employee_id: profile.employee_id,
    actor_auth_user_id: session.user.id,
    action: `CORRECTION_${action}`,
    entity_type: "attendance_adjustments",
    entity_id: adjustment_id,
  });

  return NextResponse.json({ data: { action }, error: null });
}
