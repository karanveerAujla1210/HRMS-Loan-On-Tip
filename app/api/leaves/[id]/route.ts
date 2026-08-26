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
    throw badRequest("ALREADY_PROCESSED", "This leave request has already been processed");
  }

  const { error: apprErr } = await db.from("leave_approvals").insert({
    leave_request_id: id,
    approver_id: actor.employeeId,
    action,
    comments: body.comments ?? null,
  });
  if (apprErr) throw dbError(apprErr);

  if (action === "APPROVED") {
    const leaveRow = leave as { employee_id: string; leave_type_id: string; from_date: string; total_days: number };
    const year = new Date(leaveRow.from_date).getFullYear();
    const { data: bal } = await db
      .from("leave_balances")
      .select("id, used")
      .eq("employee_id", leaveRow.employee_id)
      .eq("leave_type_id", leaveRow.leave_type_id)
      .eq("year", year)
      .maybeSingle();
    if (bal) {
      await db
        .from("leave_balances")
        .update({ used: Number((bal as { used: number }).used) + leaveRow.total_days, updated_at: new Date().toISOString() })
        .eq("id", (bal as { id: string }).id);
    }
    await db.from("leave_transactions").insert({
      employee_id: leaveRow.employee_id,
      leave_type_id: leaveRow.leave_type_id,
      transaction_type: "CONSUMPTION",
      quantity: leaveRow.total_days,
      reference_id: id,
      reason: "Leave approved",
      transaction_date: leaveRow.from_date,
      created_by: actor.employeeId,
    }).then(() => {});
  }

  const { data, error: updErr } = await db
    .from("leave_requests")
    .update({ status: action, updated_at: new Date().toISOString() })
    .eq("id", id)
    .select("id, status")
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
