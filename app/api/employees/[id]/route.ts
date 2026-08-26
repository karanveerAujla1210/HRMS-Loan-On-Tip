import { route, resolveActor, requirePermission, requireCompany, ok, badRequest, notFound, dbError, readJson, serviceClient } from "@/lib/server";
import { writeAudit } from "@/lib/audit";

async function loadEmployee(db: ReturnType<typeof serviceClient>, companyId: string, id: string) {
  const { data, error } = await db
    .from("employees")
    .select("*")
    .eq("id", id)
    .eq("company_id", companyId)
    .maybeSingle();
  if (error) throw dbError(error);
  if (!data) throw notFound("Employee not found");
  return data;
}

export const GET = route(async (_req: Request, ctx: { params: Promise<{ id: string }> }) => {
  const actor = await resolveActor();
  const companyId = requireCompany(actor);
  const { id } = await ctx.params;
  const db = serviceClient();
  const data = await loadEmployee(db, companyId, id);
  return ok(data);
});

export const PATCH = route(async (req: Request, ctx: { params: Promise<{ id: string }> }) => {
  const actor = await resolveActor();
  requirePermission(actor, "employee.update");
  const companyId = requireCompany(actor);
  const { id } = await ctx.params;

  const db = serviceClient();
  const existing = await loadEmployee(db, companyId, id);

  const body = await readJson(req);
  const updatable = [
    "first_name", "middle_name", "last_name", "gender", "date_of_birth",
    "blood_group", "official_email", "personal_email", "official_mobile",
    "personal_mobile", "joining_date", "confirmation_date", "employment_type_id",
    "department_id", "designation_id", "team_id", "location_id", "manager_id",
    "hr_manager_id", "employment_status", "probation_end_date", "notice_period_days",
    "last_working_date", "nationality", "marital_status",
  ];
  const update: Record<string, unknown> = {};
  for (const key of updatable) {
    if (key in body) update[key] = (body as Record<string, unknown>)[key];
  }
  if (Object.keys(update).length === 0) {
    throw badRequest("INVALID_INPUT", "No updatable fields provided");
  }
  update.updated_at = new Date().toISOString();

  const { data, error } = await db
    .from("employees")
    .update(update)
    .eq("id", id)
    .eq("company_id", companyId)
    .select("id, employee_code, display_name")
    .single();
  if (error) throw dbError(error);

  await writeAudit(db, {
    company_id: companyId,
    actor_employee_id: actor.employeeId,
    actor_auth_user_id: actor.authUserId,
    action: "EMPLOYEE_UPDATE",
    entity_type: "employees",
    entity_id: id,
    old_values: { employment_status: existing.employment_status },
    new_values: update,
  }).catch(() => {});

  return ok(data);
});

export const DELETE = route(async (_req: Request, ctx: { params: Promise<{ id: string }> }) => {
  const actor = await resolveActor();
  requirePermission(actor, "employee.offboard");
  const companyId = requireCompany(actor);
  const { id } = await ctx.params;

  const db = serviceClient();
  const existing = await loadEmployee(db, companyId, id);
  const { data, error } = await db
    .from("employees")
    .update({ employment_status: "TERMINATED", last_working_date: new Date().toISOString().slice(0, 10), updated_at: new Date().toISOString() })
    .eq("id", id)
    .eq("company_id", companyId)
    .select("id, employee_code")
    .single();
  if (error) throw dbError(error);

  await writeAudit(db, {
    company_id: companyId,
    actor_employee_id: actor.employeeId,
    actor_auth_user_id: actor.authUserId,
    action: "EMPLOYEE_OFFBOARD",
    entity_type: "employees",
    entity_id: id,
    old_values: { employment_status: existing.employment_status },
    new_values: { employment_status: "TERMINATED" },
  }).catch(() => {});

  return ok(data);
});
