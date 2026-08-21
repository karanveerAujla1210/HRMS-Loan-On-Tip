import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { writeAudit } from "@/lib/audit";

export async function POST(req: NextRequest) {
  const cookieStore = await cookies();
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    { cookies: { getAll: () => cookieStore.getAll() } }
  );

  const { data: { session } } = await supabase.auth.getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json() as {
    attendance_id: string;
    new_check_in?: string;
    new_check_out?: string;
    reason: string;
  };

  if (!body.attendance_id || !body.reason) {
    return NextResponse.json({ error: "attendance_id and reason are required" }, { status: 400 });
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("id,employee_id,company_id")
    .eq("auth_user_id", session.user.id)
    .single();
  if (!profile?.employee_id) return NextResponse.json({ error: "Employee not found" }, { status: 404 });

  const { data: att } = await supabase
    .from("attendance")
    .select("id,check_in_at,check_out_at,status,worked_minutes")
    .eq("id", body.attendance_id)
    .single();
  if (!att) return NextResponse.json({ error: "Attendance record not found" }, { status: 404 });

  const { data: adj, error } = await supabase
    .from("attendance_adjustments")
    .insert({
      attendance_id: body.attendance_id,
      requested_by: profile.employee_id,
      old_values: { check_in_at: att.check_in_at, check_out_at: att.check_out_at, status: att.status },
      new_values: { check_in_at: body.new_check_in ?? att.check_in_at, check_out_at: body.new_check_out ?? att.check_out_at },
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
  const cookieStore = await cookies();
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    { cookies: { getAll: () => cookieStore.getAll() } }
  );

  const { data: { session } } = await supabase.auth.getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json() as { adjustment_id: string; action: "APPROVED" | "REJECTED" };
  if (!body.adjustment_id || !body.action) {
    return NextResponse.json({ error: "adjustment_id and action required" }, { status: 400 });
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("id,employee_id,company_id")
    .eq("auth_user_id", session.user.id)
    .single();
  if (!profile?.employee_id) return NextResponse.json({ error: "Employee not found" }, { status: 404 });

  const { data: adj } = await supabase
    .from("attendance_adjustments")
    .select("id,attendance_id,new_values")
    .eq("id", body.adjustment_id)
    .single();
  if (!adj) return NextResponse.json({ error: "Adjustment not found" }, { status: 404 });

  await supabase.from("attendance_adjustments").update({
    status: body.action,
    approved_by: profile.employee_id,
    approved_at: new Date().toISOString(),
  }).eq("id", body.adjustment_id);

  if (body.action === "APPROVED") {
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
    action: `CORRECTION_${body.action}`,
    entity_type: "attendance_adjustments",
    entity_id: body.adjustment_id,
  });

  return NextResponse.json({ data: { action: body.action }, error: null });
}
