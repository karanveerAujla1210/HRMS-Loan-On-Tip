import { route, resolveActor, requirePermission, requireCompany, ok, badRequest, dbError, readJson, serviceClient } from "@/lib/server";
import { writeAudit } from "@/lib/audit";

function shiftStartToday(startTime: string): Date | null {
  if (!startTime) return null;
  const [h, m] = startTime.split(":").map(Number);
  if (Number.isNaN(h)) return null;
  const d = new Date();
  d.setHours(h, m ?? 0, 0, 0);
  return d;
}

export const POST = route(async (req: Request) => {
  const actor = await resolveActor();
  requirePermission(actor, "attendance.mark_self");
  if (!actor.employeeId) throw badRequest("NO_EMPLOYEE", "No employee record linked to this account");
  const companyId = requireCompany(actor);

  const body = await readJson(req);
  const date = body.attendance_date ? String(body.attendance_date) : new Date().toISOString().slice(0, 10);
  const nowIso = new Date().toISOString();

  const db = serviceClient();
  const { data: existing } = await db
    .from("attendance")
    .select("id, check_in_at")
    .eq("employee_id", actor.employeeId)
    .eq("attendance_date", date)
    .maybeSingle();
  if (existing && (existing as { check_in_at: string | null }).check_in_at) {
    throw badRequest("ALREADY_CHECKED_IN", "You have already checked in for this date");
  }

  let late_minutes = 0;
  let status = "PRESENT";
  if (body.shift_id) {
    const { data: shift } = await db
      .from("shifts")
      .select("start_time, grace_minutes")
      .eq("id", String(body.shift_id))
      .maybeSingle();
    if (shift) {
      const start = shiftStartToday((shift as { start_time: string }).start_time);
      const grace = Number((shift as { grace_minutes: number }).grace_minutes ?? 15);
      if (start) {
        const diffMin = Math.floor((new Date(nowIso).getTime() - start.getTime()) / 60000);
        if (diffMin > grace) {
          late_minutes = diffMin;
          status = "LATE";
        }
      }
    }
  }

  if (existing) {
    const { data, error } = await db
      .from("attendance")
      .update({
        check_in_at: nowIso,
        check_in_latitude: body.latitude ?? null,
        check_in_longitude: body.longitude ?? null,
        check_in_accuracy: body.accuracy ?? null,
        late_minutes,
        status,
        source: "MOBILE",
        updated_at: nowIso,
      })
      .eq("id", (existing as { id: string }).id)
      .select("id, attendance_date, check_in_at, status")
      .single();
    if (error) throw dbError(error);
    return ok(data);
  }

  const { data, error } = await db
    .from("attendance")
    .insert({
      employee_id: actor.employeeId,
      company_id: companyId,
      attendance_date: date,
      shift_id: body.shift_id ?? null,
      location_id: body.location_id ?? null,
      check_in_at: nowIso,
      check_in_latitude: body.latitude ?? null,
      check_in_longitude: body.longitude ?? null,
      check_in_accuracy: body.accuracy ?? null,
      late_minutes,
      status,
      source: "MOBILE",
    })
    .select("id, attendance_date, check_in_at, status")
    .single();
  if (error) throw dbError(error);

  await db.from("attendance_events").insert({
    attendance_id: (data as { id: string }).id,
    employee_id: actor.employeeId,
    event_type: "CHECK_IN",
    event_at: nowIso,
    latitude: body.latitude ?? null,
    longitude: body.longitude ?? null,
    accuracy: body.accuracy ?? null,
    source: "MOBILE",
  }).then(() => {});

  return ok(data, { status: 201 });
});
