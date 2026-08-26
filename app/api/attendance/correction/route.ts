import { route, resolveActor, requirePermission, requireCompany, ok, badRequest, forbidden, dbError, readJson, serviceClient } from "@/lib/server";
import { writeAudit } from "@/lib/audit";

export const POST = route(async (req: Request) => {
  const actor = await resolveActor();
  const canAdjust = actor.permissions.has("attendance.adjust");
  if (!canAdjust && !actor.permissions.has("attendance.mark_self")) {
    throw forbidden("Not allowed to submit attendance corrections");
  }
  if (!actor.employeeId) throw badRequest("NO_EMPLOYEE", "No employee record linked to this account");
  const companyId = requireCompany(actor);

  const body = await readJson(req);
  const reason = body.reason ? String(body.reason) : null;
  if (!reason) throw badRequest("INVALID_INPUT", "A reason is required for a correction");

  const employee_id = canAdjust && body.employee_id ? String(body.employee_id) : actor.employeeId;
  const db = serviceClient();

  let attendanceId: string | null = null;
  if (body.attendance_id) {
    const { data: att } = await db
      .from("attendance")
      .select("id, company_id")
      .eq("id", String(body.attendance_id))
      .maybeSingle();
    if (att) {
      if ((att as { company_id: string }).company_id !== companyId) throw badRequest("FORBIDDEN", "Attendance belongs to another company");
      attendanceId = (att as { id: string }).id;
    }
  }
  if (!attendanceId) {
    const date = body.attendance_date ? String(body.attendance_date) : new Date().toISOString().slice(0, 10);
    const { data: att } = await db
      .from("attendance")
      .select("id")
      .eq("employee_id", employee_id)
      .eq("attendance_date", date)
      .maybeSingle();
    attendanceId = att ? (att as { id: string }).id : null;
  }

  let oldValues: Record<string, unknown> = {};
  if (!attendanceId) {
    const date = body.attendance_date ? String(body.attendance_date) : new Date().toISOString().slice(0, 10);
    const { data: created, error: cErr } = await db
      .from("attendance")
      .insert({ employee_id, company_id: companyId, attendance_date: date, status: "ABSENT", source: "MOBILE" })
      .select("id")
      .single();
    if (cErr) throw dbError(cErr);
    attendanceId = (created as { id: string }).id;
  } else {
    const { data: cur } = await db.from("attendance").select("*").eq("id", attendanceId).maybeSingle();
    oldValues = cur ?? {};
  }

  const newValues = {
    check_in_at: body.new_check_in ?? body.check_in_at ?? null,
    check_out_at: body.new_check_out ?? body.check_out_at ?? null,
  };

  const { data, error } = await db
    .from("attendance_adjustments")
    .insert({
      attendance_id: attendanceId,
      requested_by: actor.employeeId,
      old_values: oldValues,
      new_values: newValues,
      reason,
      status: "PENDING",
    })
    .select("id, status")
    .single();
  if (error) throw dbError(error);

  return ok(data, { status: 201 });
});
