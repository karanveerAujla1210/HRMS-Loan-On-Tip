import { route, resolveActor, requirePermission, ok, badRequest, dbError, readJson, serviceClient } from "@/lib/server";

export const POST = route(async (req: Request) => {
  const actor = await resolveActor();
  requirePermission(actor, "attendance.mark_self");
  if (!actor.employeeId) throw badRequest("NO_EMPLOYEE", "No employee record linked to this account");

  const body = await readJson(req);
  const date = body.attendance_date ? String(body.attendance_date) : new Date().toISOString().slice(0, 10);
  const nowIso = new Date().toISOString();

  const db = serviceClient();
  const { data: existing, error: findErr } = await db
    .from("attendance")
    .select("id, check_in_at, check_out_at")
    .eq("employee_id", actor.employeeId)
    .eq("attendance_date", date)
    .maybeSingle();
  if (findErr) throw dbError(findErr);
  if (!existing) throw badRequest("NO_CHECK_IN", "No check-in found for this date");
  if ((existing as { check_out_at: string | null }).check_out_at) {
    throw badRequest("ALREADY_CHECKED_OUT", "You have already checked out for this date");
  }
  const checkIn = (existing as { check_in_at: string | null }).check_in_at;
  if (!checkIn) throw badRequest("NO_CHECK_IN", "No check-in timestamp recorded");

  const workedMs = new Date(nowIso).getTime() - new Date(checkIn).getTime();
  const workedMinutes = Math.max(0, Math.round(workedMs / 60000));
  const breakMinutes = body.break_minutes ? Number(body.break_minutes) : 0;
  const netMinutes = Math.max(0, workedMinutes - breakMinutes);

  const { data: statusRes } = await db.rpc("calculate_attendance_status", {
    p_worked_minutes: netMinutes,
    p_late_minutes: 0,
  });
  const status = (statusRes as string) ?? "PRESENT";

  const { data, error } = await db
    .from("attendance")
    .update({
      check_out_at: nowIso,
      check_out_latitude: body.latitude ?? null,
      check_out_longitude: body.longitude ?? null,
      check_out_accuracy: body.accuracy ?? null,
      worked_minutes: netMinutes,
      break_minutes: breakMinutes,
      status,
      updated_at: nowIso,
    })
    .eq("id", (existing as { id: string }).id)
    .select("id, attendance_date, check_in_at, check_out_at, worked_minutes, status")
    .single();
  if (error) throw dbError(error);

  await db.from("attendance_events").insert({
    attendance_id: (existing as { id: string }).id,
    employee_id: actor.employeeId,
    event_type: "CHECK_OUT",
    event_at: nowIso,
    latitude: body.latitude ?? null,
    longitude: body.longitude ?? null,
    accuracy: body.accuracy ?? null,
    source: "MOBILE",
  }).then(() => {});

  return ok(data);
});
