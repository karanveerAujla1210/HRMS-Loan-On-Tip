import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createApiClient, getSessionAndProfile, getRole } from "@/lib/api";
import { writeAudit } from "@/lib/audit";

const PatchSchema = z.object({
  action: z.enum(["APPROVED", "REJECTED", "LOCKED"]),
  comments: z.string().trim().max(1000).optional().nullable(),
});

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const supabase = await createApiClient();
  const { session, profile } = await getSessionAndProfile(supabase);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!profile?.company_id) return NextResponse.json({ error: "Profile not found" }, { status: 404 });
  if (!profile.employee_id) return NextResponse.json({ error: "Employee not found" }, { status: 404 });

  const role = await getRole(supabase, profile.employee_id);
  if (!role || !["SUPER_ADMIN", "HR_ADMIN", "FINANCE_ADMIN"].includes(role)) {
    return NextResponse.json({ error: "Forbidden: insufficient role" }, { status: 403 });
  }

  const parsed = PatchSchema.safeParse(await req.json());
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  const { data: run } = await supabase
    .from("payroll_runs")
    .select("id,status,company_id,approved_by,approved_at")
    .eq("id", params.id)
    .eq("company_id", profile.company_id)
    .single();

  if (!run) return NextResponse.json({ error: "Payroll run not found" }, { status: 404 });

  const action = parsed.data.action;
  const comments = parsed.data.comments || null;
  const oldStatus = String(run.status);

  let newStatus: "APPROVED" | "DRAFT" | "LOCKED";
  if (action === "APPROVED") {
    if (oldStatus !== "CALCULATED") {
      return NextResponse.json({ error: "Only CALCULATED runs can be approved" }, { status: 400 });
    }
    newStatus = "APPROVED";
  } else if (action === "REJECTED") {
    if (!["CALCULATED", "APPROVED"].includes(oldStatus)) {
      return NextResponse.json({ error: "Only CALCULATED or APPROVED runs can be rejected" }, { status: 400 });
    }
    newStatus = "DRAFT";
  } else {
    if (oldStatus !== "APPROVED") {
      return NextResponse.json({ error: "Only APPROVED runs can be locked" }, { status: 400 });
    }
    newStatus = "LOCKED";
  }

  if (action !== "LOCKED") {
    const { error: approvalErr } = await supabase.from("payroll_approvals").insert({
      payroll_run_id: params.id,
      approver_id: profile.employee_id,
      approval_level: role === "FINANCE_ADMIN" ? 2 : 1,
      action,
      comments,
    });

    if (approvalErr) {
      return NextResponse.json({ error: approvalErr.message }, { status: 500 });
    }
  }

  const updatePayload: Record<string, unknown> = { status: newStatus };
  if (action === "APPROVED") {
    updatePayload.approved_by = profile.employee_id;
    updatePayload.approved_at = new Date().toISOString();
  } else if (action === "REJECTED") {
    updatePayload.approved_by = null;
    updatePayload.approved_at = null;
  }

  const { error: updateErr } = await supabase
    .from("payroll_runs")
    .update(updatePayload)
    .eq("id", params.id);

  if (updateErr) return NextResponse.json({ error: updateErr.message }, { status: 500 });

  await writeAudit(supabase, {
    company_id: profile.company_id,
    actor_employee_id: profile.employee_id,
    actor_auth_user_id: session.user.id,
    action: `PAYROLL_RUN_${parsed.data.action}`,
    entity_type: "payroll_runs",
    entity_id: params.id,
    old_values: { status: oldStatus, approved_by: run.approved_by, approved_at: run.approved_at },
    new_values: { status: newStatus, comments },
  });

  return NextResponse.json({ data: { status: newStatus }, error: null });
}
