import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { z } from "zod";
import { createApiClient, getSessionAndProfile, getRole } from "@/lib/api";
import { writeAudit } from "@/lib/audit";

const PostSchema = z.object({
  salary_structure_id: z.string().uuid().optional().nullable(),
  annual_ctc: z.coerce.number(),
  effective_from: z.string().min(1),
  reason: z.string().optional().nullable(),
});

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const supabase = await createApiClient();
  const { session, profile } = await getSessionAndProfile(supabase);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!profile?.company_id) return NextResponse.json({ error: "Profile not found" }, { status: 404 });
  if (!profile.employee_id) return NextResponse.json({ error: "Employee not found" }, { status: 404 });

  const role = await getRole(supabase, profile.employee_id);
  if (!role || !["SUPER_ADMIN", "HR_ADMIN", "FINANCE_ADMIN"].includes(role)) {
    return NextResponse.json({ error: "Forbidden: insufficient role" }, { status: 403 });
  }

  const parsed = PostSchema.safeParse(await req.json());
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  const { data: emp } = await supabase
    .from("employees")
    .select("id,company_id")
    .eq("id", params.id)
    .eq("company_id", profile.company_id)
    .single();

  if (!emp) return NextResponse.json({ error: "Employee not found" }, { status: 404 });

  const { data: current } = await supabase
    .from("employee_salary_assignments")
    .select("id,annual_ctc,salary_structure_id")
    .eq("employee_id", params.id)
    .eq("is_current", true)
    .maybeSingle();

  if (current) {
    await supabase.from("employee_salary_assignments")
      .update({ is_current: false, effective_to: parsed.data.effective_from })
      .eq("id", current.id);
  }

  const { data: newAssignment, error: assignErr } = await supabase.from("employee_salary_assignments").insert({
    employee_id: params.id,
    salary_structure_id: parsed.data.salary_structure_id || null,
    annual_ctc: parsed.data.annual_ctc,
    effective_from: parsed.data.effective_from,
    is_current: true,
    approved_by: profile.employee_id,
  }).select("id,annual_ctc,monthly_ctc,effective_from,salary_structures(name)").single();

  if (assignErr || !newAssignment) return NextResponse.json({ error: assignErr?.message ?? "Failed to assign salary" }, { status: 500 });

  await supabase.from("employee_salary_history").insert({
    employee_id: params.id,
    previous_ctc: current ? Number(current.annual_ctc) : null,
    new_ctc: parsed.data.annual_ctc,
    previous_structure_id: current ? current.salary_structure_id : null,
    new_structure_id: parsed.data.salary_structure_id || null,
    effective_date: parsed.data.effective_from,
    reason: parsed.data.reason || null,
    approved_by: profile.employee_id,
  });

  await writeAudit(supabase, {
    company_id: profile.company_id,
    actor_employee_id: profile.employee_id,
    actor_auth_user_id: session.user.id,
    action: "SALARY_ASSIGNED",
    entity_type: "employee_salary_assignments",
    entity_id: newAssignment.id,
    old_values: current ? { annual_ctc: current.annual_ctc } : undefined,
    new_values: { annual_ctc: parsed.data.annual_ctc, effective_from: parsed.data.effective_from },
  });

  return NextResponse.json({ data: newAssignment, error: null }, { status: 201 });
}
