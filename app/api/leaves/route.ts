import { route, resolveActor, requirePermission, requireCompany, ok, badRequest, dbError, readJson, serviceClient } from "@/lib/server";
import { writeAudit } from "@/lib/audit";

export const POST = route(async (req: Request) => {
  const actor = await resolveActor();
  requirePermission(actor, "leave.apply");
  if (!actor.employeeId) throw badRequest("NO_EMPLOYEE", "No employee record linked to this account");
  const companyId = requireCompany(actor);

  const body = await readJson(req);
  const leave_type_id = body.leave_type_id ? String(body.leave_type_id) : null;
  const from_date = body.from_date ? String(body.from_date) : null;
  const to_date = body.to_date ? String(body.to_date) : null;
  const total_days = body.total_days ? Number(body.total_days) : 0;

  if (!leave_type_id || !from_date || !to_date || !(total_days > 0)) {
    throw badRequest("INVALID_INPUT", "leave_type_id, from_date, to_date and total_days are required");
  }

  const db = serviceClient();

  // Validate remaining balance for the current year.
  const year = new Date(from_date).getFullYear();
  const { data: balance } = await db
    .from("leave_balances")
    .select("closing_balance")
    .eq("employee_id", actor.employeeId)
    .eq("leave_type_id", leave_type_id)
    .eq("year", year)
    .maybeSingle();
  const available = balance ? Number((balance as { closing_balance: number }).closing_balance) : 0;
  if (available < total_days) {
    throw badRequest("INSUFFICIENT_BALANCE", `Only ${available} day(s) remaining for this leave type`);
  }

  const { data, error } = await db
    .from("leave_requests")
    .insert({
      employee_id: actor.employeeId,
      leave_type_id,
      from_date,
      to_date,
      total_days,
      half_day_type: body.half_day_type ?? null,
      reason: body.reason ?? null,
      attachment_document_id: body.attachment_document_id ?? null,
      status: "PENDING",
    })
    .select("id, status, total_days")
    .single();
  if (error) throw dbError(error);

  await writeAudit(db, {
    company_id: companyId,
    actor_employee_id: actor.employeeId,
    actor_auth_user_id: actor.authUserId,
    action: "LEAVE_REQUEST",
    entity_type: "leave_requests",
    entity_id: data.id,
    new_values: { leave_type_id, from_date, to_date, total_days },
  }).catch(() => {});

  return ok(data, { status: 201 });
});
