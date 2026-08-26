import { route, resolveActor, requirePermission, requireCompany, ok, badRequest, notFound, dbError, readJson, serviceClient } from "@/lib/server";
import { writeAudit } from "@/lib/audit";

export const POST = route(async (req: Request) => {
  const actor = await resolveActor();
  requirePermission(actor, "payroll.calculate");
  const companyId = requireCompany(actor);

  const body = await readJson(req);
  const payroll_run_id = body.payroll_run_id ? String(body.payroll_run_id) : null;
  if (!payroll_run_id) throw badRequest("INVALID_INPUT", "payroll_run_id is required");

  const db = serviceClient();
  const { data: run, error: runErr } = await db
    .from("payroll_runs")
    .select("id, status, company_id, payroll_month, payroll_year, period_start, period_end")
    .eq("id", payroll_run_id)
    .eq("company_id", companyId)
    .maybeSingle();
  if (runErr) throw dbError(runErr);
  if (!run) throw notFound("Payroll run not found");
  const runRow = run as { status: string; payroll_year: number; payroll_month: number };
  if (runRow.status !== "DRAFT") throw badRequest("INVALID_STATE", "Only DRAFT runs can be calculated");

  // All active employees with a current salary assignment.
  const { data: employees, error: empErr } = await db
    .from("employees")
    .select("id, employee_salary_assignments!inner(monthly_ctc)")
    .eq("company_id", companyId)
    .eq("employment_status", "ACTIVE")
    .eq("employee_salary_assignments.is_current", true);
  if (empErr) throw dbError(empErr);

  let grossPay = 0;
  let netPay = 0;
  let count = 0;

  for (const emp of (employees ?? []) as Array<{ id: string; employee_salary_assignments: { monthly_ctc: number }[] }>) {
    const ctc = Number(emp.employee_salary_assignments?.[0]?.monthly_ctc ?? 0);
    if (!(ctc > 0)) continue;

    const { data: item, error: itemErr } = await db
      .from("payroll_items")
      .upsert(
        {
          payroll_run_id: payroll_run_id,
          employee_id: emp.id,
          paid_days: 30,
          gross_salary: ctc,
          total_earnings: ctc,
          total_deductions: 0,
          net_salary: ctc,
          status: "CALCULATED",
        },
        { onConflict: "payroll_run_id,employee_id" }
      )
      .select("id, net_salary")
      .single();
    if (itemErr) throw dbError(itemErr);

    const net = Number((item as { net_salary: number }).net_salary);
    grossPay += ctc;
    netPay += net;
    count += 1;

    await db
      .from("payslips")
      .upsert(
        {
          payroll_item_id: (item as { id: string }).id,
          employee_id: emp.id,
          payroll_run_id,
          gross_salary: ctc,
          deductions: 0,
          net_salary: net,
          payslip_json: { monthly_ctc: ctc, net_salary: net },
        },
        { onConflict: "payroll_run_id,employee_id" }
      )
      .then(() => {});
  }

  const { data: updated, error: updErr } = await db
    .from("payroll_runs")
    .update({
      status: "CALCULATED",
      employee_count: count,
      gross_pay: grossPay,
      total_deductions: 0,
      net_pay: netPay,
      updated_at: new Date().toISOString(),
    })
    .eq("id", payroll_run_id)
    .select("id, status, employee_count, gross_pay, net_pay")
    .single();
  if (updErr) throw dbError(updErr);

  await writeAudit(db, {
    company_id: companyId,
    actor_employee_id: actor.employeeId,
    actor_auth_user_id: actor.authUserId,
    action: "PAYROLL_CALCULATE",
    entity_type: "payroll_runs",
    entity_id: payroll_run_id,
    new_values: { employee_count: count, net_pay: netPay },
  }).catch(() => {});

  return ok({ employee_count: count, gross_pay: grossPay, net_pay: netPay });
});
