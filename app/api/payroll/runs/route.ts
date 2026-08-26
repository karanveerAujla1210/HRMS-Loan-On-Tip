import { route, resolveActor, requirePermission, requireCompany, ok, badRequest, notFound, dbError, readJson, serviceClient } from "@/lib/server";
import { writeAudit } from "@/lib/audit";

function pad(n: number): string {
  return String(n).padStart(2, "0");
}
function lastDayOfMonth(year: number, month: number): string {
  const d = new Date(year, month, 0);
  return `${year}-${pad(month)}-${pad(d.getDate())}`;
}

export const POST = route(async (req: Request) => {
  const actor = await resolveActor();
  requirePermission(actor, "payroll.create");
  const companyId = requireCompany(actor);

  const body = await readJson(req);
  const payroll_month = Number(body.payroll_month);
  const payroll_year = Number(body.payroll_year);
  if (!(payroll_month >= 1 && payroll_month <= 12) || !(payroll_year > 2000)) {
    throw badRequest("INVALID_INPUT", "Valid payroll_month (1-12) and payroll_year are required");
  }

  const period_start = `${payroll_year}-${pad(payroll_month)}-01`;
  const period_end = lastDayOfMonth(payroll_year, payroll_month);

  const db = serviceClient();
  const { data, error } = await db
    .from("payroll_runs")
    .insert({
      company_id: companyId,
      payroll_month,
      payroll_year,
      period_start,
      period_end,
      status: "DRAFT",
      created_by: actor.employeeId,
    })
    .select("id, status, payroll_month, payroll_year")
    .single();
  if (error) throw dbError(error);

  return ok(data, { status: 201 });
});

export const GET = route(async (req: Request) => {
  const actor = await resolveActor();
  requirePermission(actor, "payroll.view");
  const companyId = requireCompany(actor);
  const { searchParams } = new URL(req.url);
  const db = serviceClient();
  let q = db
    .from("payroll_runs")
    .select("id,payroll_month,payroll_year,status,employee_count,gross_pay,total_deductions,net_pay,created_at")
    .eq("company_id", companyId)
    .order("created_at", { ascending: false })
    .limit(50);
  const month = searchParams.get("payroll_month");
  const year = searchParams.get("payroll_year");
  if (month) q = q.eq("payroll_month", Number(month));
  if (year) q = q.eq("payroll_year", Number(year));
  const { data, error } = await q;
  if (error) throw dbError(error);
  return ok(data ?? []);
});
