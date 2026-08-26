import { route, resolveActor, requirePermission, requireCompany, ok, badRequest, notFound, dbError, readJson, serviceClient } from "@/lib/server";
import { writeAudit } from "@/lib/audit";

export const POST = route(async (req: Request, ctx: { params: Promise<{ id: string }> }) => {
  const actor = await resolveActor();
  requirePermission(actor, "employee.salary.manage");
  const companyId = requireCompany(actor);
  const { id } = await ctx.params;
  const db = serviceClient();

  const { data: emp, error: empErr } = await db
    .from("employees")
    .select("id, company_id")
    .eq("id", id)
    .maybeSingle();
  if (empErr) throw dbError(empErr);
  if (!emp) throw notFound("Employee not found");
  if ((emp as { company_id: string }).company_id !== companyId) throw badRequest("FORBIDDEN", "Employee belongs to another company");

  const body = await readJson(req);
  const annual_ctc = body.annual_ctc ? Number(body.annual_ctc) : 0;
  if (!(annual_ctc > 0)) throw badRequest("INVALID_INPUT", "annual_ctc must be a positive number");
  const effective_from = body.effective_from ? String(body.effective_from) : new Date().toISOString().slice(0, 10);

  // Demote any existing current assignment.
  const { data: prev } = await db
    .from("employee_salary_assignments")
    .select("annual_ctc")
    .eq("employee_id", id)
    .eq("is_current", true)
    .maybeSingle();

  const { error: updErr } = await db
    .from("employee_salary_assignments")
    .update({ is_current: false, effective_to: effective_from, updated_at: new Date().toISOString() })
    .eq("employee_id", id)
    .eq("is_current", true);
  if (updErr) throw dbError(updErr);

  const { data, error } = await db
    .from("employee_salary_assignments")
    .insert({
      employee_id: id,
      salary_structure_id: body.salary_structure_id ?? null,
      annual_ctc,
      effective_from,
      is_current: true,
      approved_by: actor.employeeId,
    })
    .select("id, annual_ctc, monthly_ctc, effective_from")
    .single();
  if (error) throw dbError(error);

  await db
    .from("employee_salary_history")
    .insert({
      employee_id: id,
      previous_ctc: prev ? Number((prev as { annual_ctc: number }).annual_ctc) : 0,
      new_ctc: annual_ctc,
      new_structure_id: body.salary_structure_id ?? null,
      effective_date: effective_from,
      reason: body.reason ?? null,
      approved_by: actor.employeeId,
    })
    .then(() => {});

  await writeAudit(db, {
    company_id: companyId,
    actor_employee_id: actor.employeeId,
    actor_auth_user_id: actor.authUserId,
    action: "SALARY_ASSIGN",
    entity_type: "employee_salary_assignments",
    entity_id: (data as { id: string }).id,
    new_values: { annual_ctc, effective_from },
  }).catch(() => {});

  return ok(data, { status: 201 });
});
