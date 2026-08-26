import { route, resolveActor, requirePermission, requireCompany, ok, badRequest, dbError, readJson, serviceClient } from "@/lib/server";

export const POST = route(async (req: Request) => {
  const actor = await resolveActor();
  requirePermission(actor, "attendance.approve");
  const companyId = requireCompany(actor);

  const body = await readJson(req);
  const date = body.attendance_date ? String(body.attendance_date) : new Date().toISOString().slice(0, 10);
  const status = body.status ? String(body.status) : "PRESENT";
  const employeeIds: string[] = Array.isArray(body.employee_ids)
    ? body.employee_ids.map(String)
    : [];
  if (employeeIds.length === 0) throw badRequest("INVALID_INPUT", "employee_ids is required");

  const db = serviceClient();
  let updated = 0;
  for (const employeeId of employeeIds) {
    const { error } = await db.from("attendance").upsert(
      {
        employee_id: employeeId,
        company_id: companyId,
        attendance_date: date,
        status,
        source: "ADMIN",
        is_manual_adjustment: true,
        approved_by: actor.employeeId,
        approved_at: new Date().toISOString(),
        worked_minutes: status === "PRESENT" ? 480 : 0,
      },
      { onConflict: "employee_id,attendance_date" }
    );
    if (!error) updated += 1;
  }

  return ok({ marked: updated, date, status });
});
