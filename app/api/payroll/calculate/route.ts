import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { z } from "zod";
import { writeAudit } from "@/lib/audit";
import { getRole, createApiClient, getSessionAndProfile } from "@/lib/api";
import { calculateNetPay, type SalaryComponents } from "@hrms/domain";

const PostSchema = z.object({
  payroll_run_id: z.string().uuid(),
});

export async function POST(req: NextRequest) {
  const supabase = await createApiClient();
  const { session, profile } = await getSessionAndProfile(supabase);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!profile?.company_id) return NextResponse.json({ error: "Profile not found" }, { status: 404 });
  if (!profile.employee_id) return NextResponse.json({ error: "Employee not found" }, { status: 404 });

  const parsed = PostSchema.safeParse(await req.json());
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  const role = await getRole(supabase, profile.employee_id);
  if (!role || !["SUPER_ADMIN", "HR_ADMIN", "FINANCE_ADMIN"].includes(role)) {
    return NextResponse.json({ error: "Forbidden: insufficient role" }, { status: 403 });
  }

  const { data: run } = await supabase
    .from("payroll_runs")
    .select("id,payroll_month,payroll_year,status,company_id,period_start,period_end")
    .eq("id", parsed.data.payroll_run_id)
    .eq("company_id", profile.company_id)
    .single();

  if (!run) return NextResponse.json({ error: "Payroll run not found" }, { status: 404 });
  if (run.status !== "DRAFT") return NextResponse.json({ error: "Only DRAFT runs can be calculated" }, { status: 400 });

  const periodStart = new Date(run.period_start);
  const periodEnd = new Date(run.period_end);
  const totalDays = Math.max(1, Math.round((periodEnd.getTime() - periodStart.getTime()) / 86400000) + 1);

  // Get active employees
  const { data: employees } = await supabase
    .from("employees")
    .select("id")
    .eq("company_id", profile.company_id)
    .eq("employment_status", "ACTIVE");

  const empIds = (employees ?? []).map((e: { id: string }) => e.id);
  if (!empIds.length) return NextResponse.json({ error: "No active employees found" }, { status: 400 });

  // Get current salary assignments
  const { data: assignments } = await supabase
    .from("employee_salary_assignments")
    .select("employee_id,annual_ctc,monthly_ctc")
    .eq("is_current", true)
    .in("employee_id", empIds);

  if (!assignments?.length) return NextResponse.json({ error: "No active salary assignments found" }, { status: 400 });

  // Get attendance summaries for the period
  const { data: attSummaries } = await supabase
    .from("attendance")
    .select("employee_id,status")
    .in("employee_id", empIds)
    .gte("attendance_date", run.period_start)
    .lte("attendance_date", run.period_end);

  const attMap: Record<string, { present: number; absent: number; half: number; leave: number }> = {};
  for (const row of attSummaries ?? []) {
    if (!attMap[row.employee_id]) attMap[row.employee_id] = { present: 0, absent: 0, half: 0, leave: 0 };
    const s = String(row.status).toUpperCase();
    if (s === "PRESENT" || s === "LATE") attMap[row.employee_id].present++;
    else if (s === "ABSENT") attMap[row.employee_id].absent++;
    else if (s === "HALF_DAY") attMap[row.employee_id].half += 0.5;
    else if (s === "ON_LEAVE") attMap[row.employee_id].leave++;
  }

  let totalGross = 0;
  let totalNet = 0;
  let totalDeductions = 0;
  const items: Record<string, unknown>[] = [];
  const breakdownMap = new Map<string, { basic: number; hra: number; conveyance: number; special_allowance: number; pf: number; pt: number; gross: number; deductions: number; net: number }>();
  for (const asgn of assignments) {
    const monthly = Number(asgn.monthly_ctc);
    const att = attMap[asgn.employee_id] ?? { present: 0, absent: 0, half: 0, leave: 0 };
    const paidDays = Math.min(totalDays, Math.round(att.present + att.half + att.leave));
    const lopDays = Math.max(0, att.absent);

    const components: SalaryComponents = {
      basic: +(monthly * 0.4 * (paidDays / totalDays)).toFixed(2),
      hra: +(monthly * 0.2 * (paidDays / totalDays)).toFixed(2),
      conveyance: +(monthly * 0.1 * (paidDays / totalDays)).toFixed(2),
      special_allowance: +(monthly * 0.3 * (paidDays / totalDays)).toFixed(2),
      pf_employee: +Math.min(monthly * 0.4 * (paidDays / totalDays) * 0.12, 1800).toFixed(2),
      professional_tax: 200,
      tds: 0,
    };

    const result = calculateNetPay(components, paidDays, totalDays, true);
    const gross = result.gross;
    const deductions = result.deductions;
    const net = result.net;

    totalGross += gross;
    totalNet += net;
    totalDeductions += deductions;

    breakdownMap.set(asgn.employee_id, {
      basic: components.basic,
      hra: components.hra,
      conveyance: components.conveyance,
      special_allowance: components.special_allowance,
      pf: components.pf_employee,
      pt: 200,
      gross,
      deductions,
      net,
    });

    items.push({
      payroll_run_id: run.id,
      employee_id: asgn.employee_id,
      working_days: totalDays,
      paid_days: paidDays,
      lop_days: lopDays,
      absent_days: att.absent,
      leave_days: att.leave,
      gross_salary: gross,
      total_earnings: gross,
      total_deductions: deductions,
      net_salary: net,
      employee_contribution: components.pf_employee,
      employer_contribution: +Math.min(components.basic * 0.12, 1800).toFixed(2),
      taxable_income: gross,
      income_tax: 0,
      status: "DRAFT",
    });
  }

  // Delete existing items for this run before recalculating
  await supabase.from("payroll_items").delete().eq("payroll_run_id", run.id);

  const { data: insertedItems, error: itemsErr } = await supabase
    .from("payroll_items")
    .insert(items)
    .select("id,employee_id,gross_salary,total_deductions,net_salary");

  if (itemsErr) return NextResponse.json({ error: itemsErr.message }, { status: 500 });

  // Create payslips
  const payslips = (insertedItems ?? []).map((item: {
    id: string; employee_id: string; gross_salary: number; total_deductions: number; net_salary: number;
  }) => {
    const breakdown = breakdownMap.get(item.employee_id);
    return {
      payroll_item_id: item.id,
      employee_id: item.employee_id,
      payroll_run_id: run.id,
      gross_salary: item.gross_salary,
      deductions: item.total_deductions,
      net_salary: item.net_salary,
      payslip_json: breakdown ?? { gross: item.gross_salary, deductions: item.total_deductions, net: item.net_salary },
      generated_at: new Date().toISOString(),
    };
  });

  if (payslips.length) {
    await supabase.from("payslips").delete().eq("payroll_run_id", run.id);
    await supabase.from("payslips").insert(payslips);
  }

  // Update run totals
  await supabase.from("payroll_runs").update({
    employee_count: items.length,
    gross_pay: +totalGross.toFixed(2),
    total_deductions: +totalDeductions.toFixed(2),
    net_pay: +totalNet.toFixed(2),
    status: "CALCULATED",
  }).eq("id", run.id);

  await writeAudit(supabase, {
    company_id: profile.company_id,
    actor_employee_id: profile.employee_id,
    actor_auth_user_id: session.user.id,
    action: "PAYROLL_CALCULATED",
    entity_type: "payroll_runs",
    entity_id: run.id,
    new_values: { employee_count: items.length, gross_pay: totalGross, net_pay: totalNet },
  });

  return NextResponse.json({
    data: { employee_count: items.length, gross_pay: totalGross, net_pay: totalNet },
    error: null,
  });
}
