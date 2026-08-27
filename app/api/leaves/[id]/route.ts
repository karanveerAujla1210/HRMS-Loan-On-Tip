import { route, resolveActor, requirePermission, requireCompany, ok, badRequest, notFound, dbError, readJson, serviceClient } from "@/lib/server";
import { writeAudit } from "@/lib/audit";

export const PATCH = route(async (req: Request, ctx: { params: Promise<{ id: string }> }) => {
  const actor = await resolveActor();
  requirePermission(actor, "leave.approve");
  const companyId = requireCompany(actor);
  const { id } = await ctx.params;

  const body = await readJson(req);
  const action = body.action ? String(body.action).toUpperCase() : null;
  if (action !== "APPROVED" && action !== "REJECTED") {
    throw badRequest("INVALID_INPUT", "action must be APPROVED or REJECTED");
  }

  const db = serviceClient();
  const { data: leave, error: lvErr } = await db
    .from("leave_requests")
    .select("id, employee_id, leave_type_id, from_date, total_days, status, company_id")
    .eq("id", id)
    .maybeSingle();
  if (lvErr) throw dbError(lvErr);
  if (!leave) throw notFound("Leave request not found");
  if ((leave as { company_id: string }).company_id !== companyId) {
    throw badRequest("FORBIDDEN", "Leave request belongs to another company");
  }
  if ((leave as { status: string }).status !== "PENDING") {
    throw badRequest("LEAVE_ALREADY_DECIDED", "This leave request has already been processed");
  }

  // Atomic, idempotent approval that also updates the leave balance inside a
  // single transaction (see migration 38).
  const { data: resultId, error: rpcErr } = await db.rpc("apply_leave_approval", {
    p_leave_request_id: id,
    p_actor_id: actor.employeeId,
    p_action: action,
    p_comments: body.comments ?? null,
  });
  if (rpcErr) throw dbError(rpcErr);

  const { data, error: updErr } = await db
    .from("leave_requests")
    .select("id, status")
    .eq("id", resultId ?? id)
    .single();
  if (updErr) throw dbError(updErr);

  await writeAudit(db, {
    company_id: companyId,
    actor_employee_id: actor.employeeId,
    actor_auth_user_id: actor.authUserId,
    action: action === "APPROVED" ? "LEAVE_APPROVE" : "LEAVE_REJECT",
    entity_type: "leave_requests",
    entity_id: id,
    new_values: { action, comments: body.comments ?? null },
  }).catch(() => {});

  return ok(data);
});
