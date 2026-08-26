import { route, resolveActor, requirePermission, requireCompany, ok, badRequest, notFound, dbError, readJson, serviceClient } from "@/lib/server";
import { writeAudit } from "@/lib/audit";

export const POST = route(async (req: Request, ctx: { params: Promise<{ id: string }> }) => {
  const actor = await resolveActor();
  requirePermission(actor, "resignation.manage");
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
  const { data: existing } = await db.from("resignations").select("id").eq("employee_id", id).maybeSingle();
  if (existing) throw badRequest("ALREADY_INITIATED", "An exit process is already in progress for this employee");

  const { data, error } = await db
    .from("resignations")
    .insert({
      employee_id: id,
      resignation_date: body.resignation_date ? String(body.resignation_date) : new Date().toISOString().slice(0, 10),
      last_working_date: body.last_working_date ?? null,
      reason: body.reason ?? null,
      status: "INITIATED",
    })
    .select("id, status")
    .single();
  if (error) throw dbError(error);

  await db
    .from("employees")
    .update({ employment_status: "ON_NOTICE", last_working_date: body.last_working_date ?? null, updated_at: new Date().toISOString() })
    .eq("id", id)
    .then(() => {});

  await writeAudit(db, {
    company_id: companyId,
    actor_employee_id: actor.employeeId,
    actor_auth_user_id: actor.authUserId,
    action: "EXIT_INITIATE",
    entity_type: "resignations",
    entity_id: (data as { id: string }).id,
  }).catch(() => {});

  return ok(data, { status: 201 });
});

export const PATCH = route(async (req: Request, ctx: { params: Promise<{ id: string }> }) => {
  const actor = await resolveActor();
  requirePermission(actor, "resignation.manage");
  const companyId = requireCompany(actor);
  const { id } = await ctx.params;
  const db = serviceClient();

  const body = await readJson(req);
  const { data: existing, error: exErr } = await db
    .from("resignations")
    .select("id, employee_id, status")
    .eq("employee_id", id)
    .maybeSingle();
  if (exErr) throw dbError(exErr);
  if (!existing) throw notFound("No exit process found for this employee");

  const update: Record<string, unknown> = {};
  for (const f of ["resignation_date", "last_working_date", "reason", "it_cleared", "finance_cleared", "hr_cleared", "ff_amount", "ff_notes"]) {
    if (f in body) update[f] = (body as Record<string, unknown>)[f];
  }
  if (body.status) {
    update.status = String(body.status);
    if (body.status === "COMPLETED") {
      update.completed_at = new Date().toISOString();
      update.employee_id = id;
    }
  }
  if (Object.keys(update).length === 0) throw badRequest("INVALID_INPUT", "No supported fields provided");

  const { data, error } = await db
    .from("resignations")
    .update(update)
    .eq("employee_id", id)
    .select("id, status")
    .single();
  if (error) throw dbError(error);

  if (body.status === "COMPLETED") {
    await db
      .from("employees")
      .update({ employment_status: "TERMINATED", last_working_date: body.last_working_date ?? null, updated_at: new Date().toISOString() })
      .eq("id", id)
      .then(() => {});
  }

  await writeAudit(db, {
    company_id: companyId,
    actor_employee_id: actor.employeeId,
    actor_auth_user_id: actor.authUserId,
    action: body.status === "COMPLETED" ? "EXIT_COMPLETE" : "EXIT_UPDATE",
    entity_type: "resignations",
    entity_id: (data as { id: string }).id,
    new_values: update,
  }).catch(() => {});

  return ok(data);
});
