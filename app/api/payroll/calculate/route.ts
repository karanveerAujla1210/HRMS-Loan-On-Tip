import { route, resolveActor, requirePermission, requireCompany, ok, badRequest, notFound, dbError, readJson, serviceClient } from "@/lib/server";
import { writeAudit } from "@/lib/audit";
import { PAYROLL_DEFAULTS } from "@hrms/config";
import {
  computePayroll,
  payableDayWeight,
  fallbackStructureComponents,
  type StatutoryConfig,
  type StructureComponent,
  type PayrollComputationResult,
} from "@hrms/domain";
import type { AttendanceStatus } from "@hrms/api-contract";
import { loadCompanySettings, statutoryConfig } from "@/lib/server/settings";

type EmpRow = {
  id: string;
  employee_salary_assignments: {
    monthly_ctc: number;
    salary_structure_id: string;
  }[];
};

type CompRow = {
  value: number | null;
  percentage: number | null;
  monthly_limit: number | null;
  calculation_method: string;
  base_component_id: string | null;
  salary_components: {
    code: string;
    name: string;
    component_type: "EARNING" | "DEDUCTION" | "STATUTORY";
    is_taxable: boolean;
  }[] | null;
};

function daysInclusive(from: string, to: string): number {
  const ms = new Date(to).getTime() - new Date(from).getTime();
  return Math.max(1, Math.floor(ms / 86_400_000) + 1);
}

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
    .select("id, status, company_id, period_start, period_end")
    .eq("id", payroll_run_id)
    .eq("company_id", companyId)
    .maybeSingle();
  if (runErr) throw dbError(runErr);
  if (!run) throw notFound("Payroll run not found");
  if ((run as { status: string }).status !== "DRAFT") {
    throw badRequest("INVALID_STATE", "Only DRAFT runs can be calculated");
  }

  const period_start = (run as { period_start: string }).period_start;
  const period_end = (run as { period_end: string }).period_end;
  const workingDays = daysInclusive(period_start, period_end);

  const settings = await loadCompanySettings(db, companyId);
  const statutory: StatutoryConfig = statutoryConfig(settings);

  // All active employees with a current salary assignment.
  const { data: employees, error: empErr } = await db
    .from("employees")
    .select(
      "id, employee_salary_assignments!inner(salary_structure_id, monthly_ctc)"
    )
    .eq("company_id", companyId)
    .eq("employment_status", "ACTIVE")
    .eq("employee_salary_assignments.is_current", true);
  if (empErr) throw dbError(empErr);

  let grossPay = 0;
  let totalDeductions = 0;
  let netPay = 0;
  let count = 0;

  for (const emp of (employees ?? []) as EmpRow[]) {
    const assignment = emp.employee_salary_assignments?.[0];
    if (!assignment) continue;
    const ctc = Number(assignment.monthly_ctc ?? 0);
    if (!(ctc > 0)) continue;

    const structureId = assignment.salary_structure_id;
    let components: StructureComponent[] = [];

    if (structureId) {
      const { data: comps, error: compErr } = await db
        .from("salary_structure_components")
        .select(
          "value, percentage, monthly_limit, calculation_method, base_component_id, salary_components(code, name, component_type, is_taxable)"
        )
        .eq("salary_structure_id", structureId);
      if (compErr) throw dbError(compErr);

      const baseIds = (comps ?? [])
        .map((c: CompRow) => c.base_component_id)
        .filter((id): id is string => Boolean(id));
      const { data: baseRows } = baseIds.length
        ? await db.from("salary_components").select("id, code").in("id", baseIds)
        : { data: [] as { id: string; code: string }[] };
      const baseCodeById = new Map(
        (baseRows ?? []).map((b: { id: string; code: string }) => [b.id, b.code])
      );

      components = (comps ?? []).flatMap((c: CompRow) => {
        const sc = c.salary_components?.[0] ?? null;
        if (!sc) return [];
        // Statutory deductions (PF/ESI/PT) are derived from the company config,
        // not from structure rows, to avoid double counting.
        if (sc.component_type === "STATUTORY") return [];
        return [
          {
            code: sc.code,
            name: sc.name,
            type: sc.component_type,
            method: (c.calculation_method as StructureComponent["method"]) ?? "FIXED",
            value: c.value ?? null,
            percentage: c.percentage ?? null,
            baseCode: c.base_component_id ? baseCodeById.get(c.base_component_id) ?? null : null,
            monthlyLimit: c.monthly_limit ?? null,
            prorate: sc.component_type === "EARNING",
            taxable: sc.is_taxable,
          } satisfies StructureComponent,
        ];
      });

      if (components.length === 0) {
        components = fallbackStructureComponents(ctc * 12, PAYROLL_DEFAULTS.fallbackSplit);
      }
    } else {
      components = fallbackStructureComponents(ctc * 12, PAYROLL_DEFAULTS.fallbackSplit);
    }

    // Paid days from attendance; absence reduces pay, weekly offs/holidays are
    // already weighted to 1 by the domain engine.
    const { data: att } = await db
      .from("attendance")
      .select("status")
      .eq("employee_id", emp.id)
      .gte("attendance_date", period_start)
      .lte("attendance_date", period_end);

    let paidDays = 0;
    let lopDays = 0;
    for (const a of (att ?? []) as { status: string }[]) {
      paidDays += payableDayWeight(a.status as AttendanceStatus);
      if (a.status === "ABSENT" || a.status === "MISSING_PUNCH") lopDays += 1;
    }
    if (!att || att.length === 0) paidDays = workingDays; // assume full presence

    const result: PayrollComputationResult = computePayroll({
      monthlyCtc: ctc,
      workingDays,
      paidDays,
      lopDays,
      components,
      statutory,
      engineVersion: PAYROLL_DEFAULTS.engineVersion,
    });

    const { data: item, error: itemErr } = await db
      .from("payroll_items")
      .upsert(
        {
          payroll_run_id,
          employee_id: emp.id,
          working_days: workingDays,
          paid_days: result.proration * workingDays,
          lop_days: lopDays,
          gross_salary: result.grossEarnings,
          total_earnings: result.grossEarnings,
          total_deductions: result.totalDeductions,
          net_salary: result.netPay,
          employer_contribution: result.employerContribution,
          employee_contribution: result.employeeContribution,
          taxable_income: result.taxableIncome,
          income_tax: 0,
          status: "CALCULATED",
        },
        { onConflict: "payroll_run_id,employee_id" }
      )
      .select("id")
      .single();
    if (itemErr) throw dbError(itemErr);

    const itemId = (item as { id: string }).id;

    const lineItems = [...result.earnings, ...result.deductions].map((l) => ({
      payroll_item_id: itemId,
      salary_component_id: null,
      component_code: l.code,
      component_name: l.name,
      component_type: l.type,
      calculation_basis: l.basis,
      quantity: null,
      rate: null,
      amount: l.amount,
    }));

    if (lineItems.length) {
      const { error: compUpsertErr } = await db
        .from("payroll_item_components")
        .upsert(lineItems, { onConflict: "payroll_item_id,component_code" });
      if (compUpsertErr) throw dbError(compUpsertErr);
    }

    const { error: slipErr } = await db
      .from("payslips")
      .upsert(
        {
          payroll_item_id: itemId,
          employee_id: emp.id,
          payroll_run_id,
          gross_salary: result.grossEarnings,
          deductions: result.totalDeductions,
          net_salary: result.netPay,
          payslip_json: result as unknown as Record<string, unknown>,
        },
        { onConflict: "payroll_run_id,employee_id" }
      );
    if (slipErr) throw dbError(slipErr);

    grossPay += result.grossEarnings;
    totalDeductions += result.totalDeductions;
    netPay += result.netPay;
    count += 1;
  }

  const { error: updErr } = await db
    .from("payroll_runs")
    .update({
      status: "CALCULATED",
      employee_count: count,
      gross_pay: grossPay,
      total_deductions: totalDeductions,
      net_pay: netPay,
      engine_version: PAYROLL_DEFAULTS.engineVersion,
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
    new_values: { employee_count: count, net_pay: netPay, engine_version: PAYROLL_DEFAULTS.engineVersion },
  }).catch(() => {});

  return ok({ employee_count: count, gross_pay: grossPay, total_deductions: totalDeductions, net_pay: netPay });
});
