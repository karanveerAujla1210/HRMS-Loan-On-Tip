import { route, resolveActor, requirePermission, requireCompany, ok, badRequest, dbError, readJson, serviceClient } from "@/lib/server";
import { writeAudit } from "@/lib/audit";

export const POST = route(async (req: Request) => {
  const actor = await resolveActor();
  requirePermission(actor, "attendance.approve");
  const companyId = requireCompany(actor);

  const body = await readJson(req);
  const from_date = body.from_date ? String(body.from_date) : new Date().toISOString().slice(0, 10);
  const to_date = body.to_date ? String(body.to_date) : from_date;
  const status = body.status ? String(body.status) : "PRESENT";
  const employeeIds: string[] = Array.isArray(body.employee_ids)
    ? body.employee_ids.map(String)
    : [];

  if (to_date < from_date) {
    throw badRequest("INVALID_INPUT", "to_date must be on or after from_date");
  }

  const db = serviceClient();

  let targetEmployees: string[];
  if (employeeIds.length > 0) {
    targetEmployees = employeeIds;
  } else {
    const { data: emps, error: empErr } = await db
      .from("employees")
      .select("id")
      .eq("company_id", companyId)
      .eq("employment_status", "ACTIVE");
    if (empErr) throw dbError(empErr);
    targetEmployees = ((emps ?? []) as { id: string }[]).map((e) => e.id);
  }

  if (targetEmployees.length === 0) {
    return ok({ marked: 0, from_date, to_date, status, message: "No employees matched." });
  }

  const start = new Date(`${from_date}T00:00:00Z`);
  const end = new Date(`${to_date}T00:00:00Z`);
  const dates: string[] = [];
  for (let d = new Date(start); d <= end; d = new Date(d.getTime() + 86_400_000)) {
    dates.push(d.toISOString().slice(0, 10));
  }

  const rowsToUpsert: Record<string, unknown>[] = [];
  for (const employeeId of targetEmployees) {
    for (const date of dates) {
      rowsToUpsert.push({
        employee_id: employeeId,
        company_id: companyId,
        attendance_date: date,
        status,
        source: "ADMIN",
        is_manual_adjustment: true,
        approved_by: actor.employeeId,
        approved_at: new Date().toISOString(),
        worked_minutes: status === "PRESENT" ? 480 : 0,
      });
    }
  }

  const { error } = await db
    .from("attendance")
    .upsert(rowsToUpsert, { onConflict: "employee_id,attendance_date" });

  if (error) throw dbError(error);

  const marked = rowsToUpsert.length;

  await writeAudit(db, {
    company_id: companyId,
    actor_employee_id: actor.employeeId,
    actor_auth_user_id: actor.authUserId,
    action: "ATTENDANCE_BULK_MARK",
    entity_type: "attendance",
    entity_id: null,
    new_values: { from_date, to_date, status, employee_count: targetEmployees.length, marked },
  }).catch(() => {});

  return ok({ marked, from_date, to_date, status });
});
