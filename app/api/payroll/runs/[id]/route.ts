import { route, resolveActor, requirePermission, requireCompany, ok, badRequest, notFound, dbError, readJson, serviceClient } from "@/lib/server";
import { writeAudit } from "@/lib/audit";

export const GET = route(async (_req: Request, ctx: { params: Promise<{ id: string }> }) => {
  const actor = await resolveActor();
  requirePermission(actor, "payroll.view");
  const companyId = requireCompany(actor);
  const { id } = await ctx.params;
  const db = serviceClient();

  const { data: run, error: runErr } = await db
    .from("payroll_runs")
    .select("*")
    .eq("id", id)
    .eq("company_id", companyId)
    .maybeSingle();
  if (runErr) throw dbError(runErr);
  if (!run) throw notFound("Payroll run not found");

  const { data: items, error: itemsErr } = await db
    .from("payroll_items")
    .select("id,employee_id,paid_days,gross_salary,total_earnings,total_deductions,net_salary,status")
    .eq("payroll_run_id", id)
    .order("gross_salary", { ascending: false });
  if (itemsErr) throw dbError(itemsErr);

  return ok({ run, items: items ?? [] });
});

export const PATCH = route(async (req: Request, ctx: { params: Promise<{ id: string }> }) => {
  const actor = await resolveActor();
  const companyId = requireCompany(actor);
  const { id } = await ctx.params;

  const body = await readJson(req);
  const action = body.action ? String(body.action).toUpperCase() : null;
  if (action !== "APPROVED" && action !== "LOCKED") {
    throw badRequest("INVALID_INPUT", "action must be APPROVED or LOCKED");
  }

  // APPROVED requires finance approval; LOCKED requires the lock permission.
  if (action === "APPROVED") requirePermission(actor, "payroll.approve");
  else requirePermission(actor, "payroll.lock");

  const db = serviceClient();
  const { data: run, error: runErr } = await db
    .from("payroll_runs")
    .select("id, status, company_id")
    .eq("id", id)
    .maybeSingle();
  if (runErr) throw dbError(runErr);
  if (!run) throw notFound("Payroll run not found");
  if ((run as { company_id: string }).company_id !== companyId) throw badRequest("FORBIDDEN", "Run belongs to another company");

  const update: Record<string, unknown> = { status: action, updated_at: new Date().toISOString() };
  if (action === "APPROVED") {
    update.approved_by = actor.employeeId;
    update.approved_at = new Date().toISOString();
  }
  const { data, error } = await db
    .from("payroll_runs")
    .update(update)
    .eq("id", id)
    .select("id, status")
    .single();
  if (error) throw dbError(error);

  // Publishing payslips on lock.
  if (action === "LOCKED") {
    await db
      .from("payslips")
      .update({ published_at: new Date().toISOString() })
      .eq("payroll_run_id", id)
      .then(() => {});
  }

  await writeAudit(db, {
    company_id: companyId,
    actor_employee_id: actor.employeeId,
    actor_auth_user_id: actor.authUserId,
    action: action === "APPROVED" ? "PAYROLL_APPROVE" : "PAYROLL_LOCK",
    entity_type: "payroll_runs",
    entity_id: id,
  }).catch(() => {});

  return ok(data);
});
