import { route, resolveActor, requirePermission, requireCompany, ok, badRequest, notFound, dbError, readJson, serviceClient } from "@/lib/server";
import { writeAudit } from "@/lib/audit";

export const PATCH = route(async (req: Request, ctx: { params: Promise<{ id: string }> }) => {
  const actor = await resolveActor();
  requirePermission(actor, "attendance.approve");
  const companyId = requireCompany(actor);
  const { id } = await ctx.params;

  const body = await readJson(req);
  const status = body.status ? String(body.status) : "RESOLVED";
  const resolution_note = body.resolution_note ? String(body.resolution_note) : null;

  const db = serviceClient();
  const { data: exception, error: exErr } = await db
    .from("attendance_exceptions")
    .select("id, employee_id, company_id")
    .eq("id", id)
    .maybeSingle();
  if (exErr) throw dbError(exErr);
  if (!exception) throw notFound("Exception not found");
  if ((exception as { company_id: string }).company_id !== companyId) {
    throw badRequest("FORBIDDEN", "Exception belongs to another company");
  }

  const { data, error } = await db
    .from("attendance_exceptions")
    .update({
      status,
      resolution_note,
      resolved_by: actor.employeeId,
      resolved_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("id", id)
    .select("id, status")
    .single();
  if (error) throw dbError(error);

  await writeAudit(db, {
    company_id: companyId,
    actor_employee_id: actor.employeeId,
    actor_auth_user_id: actor.authUserId,
    action: "ATTENDANCE_EXCEPTION_RESOLVE",
    entity_type: "attendance_exceptions",
    entity_id: id,
    new_values: { status, resolution_note },
  }).catch(() => {});

  return ok(data);
});
