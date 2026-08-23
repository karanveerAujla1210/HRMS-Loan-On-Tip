import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createApiClient, getSessionAndProfile, getRole } from "@/lib/api";
import { writeAudit } from "@/lib/audit";

const PostSchema = z.object({
  payroll_month: z.coerce.number().int().min(1).max(12),
  payroll_year: z.coerce.number().int().min(2000).max(2100),
});

export async function POST(req: NextRequest) {
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

  const month = parsed.data.payroll_month;
  const year = parsed.data.payroll_year;
  const periodStart = new Date(year, month - 1, 1).toISOString().slice(0, 10);
  const periodEnd = new Date(year, month, 0).toISOString().slice(0, 10);

  const { data: run, error } = await supabase
    .from("payroll_runs")
    .insert({
      company_id: profile.company_id,
      payroll_month: month,
      payroll_year: year,
      period_start: periodStart,
      period_end: periodEnd,
      status: "DRAFT",
      created_by: profile.employee_id,
    })
    .select("id,payroll_month,payroll_year,status,company_id,period_start,period_end")
    .single();

  if (error || !run) return NextResponse.json({ error: error?.message ?? "Failed to create payroll run" }, { status: 500 });

  await writeAudit(supabase, {
    company_id: profile.company_id,
    actor_employee_id: profile.employee_id,
    actor_auth_user_id: session.user.id,
    action: "PAYROLL_RUN_CREATED",
    entity_type: "payroll_runs",
    entity_id: run.id,
    new_values: { payroll_month: month, payroll_year: year, period_start: periodStart, period_end: periodEnd },
  });

  return NextResponse.json({ data: run, error: null }, { status: 201 });
}
