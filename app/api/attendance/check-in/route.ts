import { route, resolveActor, requirePermission, requireCompany, ok, badRequest, dbError, readJson, serviceClient } from "@/lib/server";
import { writeAudit } from "@/lib/audit";
import { DEFAULT_TIMEZONE } from "@hrms/config";
import {
  evaluateGeoFence,
  parseTimeToMinutes,
  zonedParts,
} from "@hrms/domain";
import { loadCompanySettings, attendancePolicy } from "@/lib/server/settings";

type ShiftRow = {
  start_time: string;
  end_time: string;
  grace_minutes: number;
  break_minutes: number;
  half_day_after_minutes: number;
  full_day_after_minutes: number;
  is_overnight: boolean;
};

type LocationRow = {
  latitude: number | null;
  longitude: number | null;
  attendance_radius_meters: number | null;
  timezone: string | null;
};

export const POST = route(async (req: Request) => {
  const actor = await resolveActor();
  requirePermission(actor, "attendance.mark_self");
  if (!actor.employeeId) throw badRequest("NO_EMPLOYEE", "No employee record linked to this account");
  const companyId = requireCompany(actor);
  const employeeId = actor.employeeId;

  const body = await readJson(req);
  const date = body.attendance_date ? String(body.attendance_date) : new Date().toISOString().slice(0, 10);
  const nowIso = new Date().toISOString();

  const db = serviceClient();

  // ── Mock-location screening ────────────────────────────────────────────────
  if (body.is_mock_location) {
    throw badRequest("ATTENDANCE_MOCK_LOCATION", "Mock location detected. Attendance was not recorded.");
  }

  const settings = await loadCompanySettings(db, companyId);
  const policy = attendancePolicy(settings);

  // ── Resolve assigned location (geo-fence) and shift ────────────────────────
  const { data: emp, error: empErr } = await db
    .from("employees")
    .select("location_id")
    .eq("id", employeeId)
    .maybeSingle();
  if (empErr) throw dbError(empErr);

  let location: LocationRow | null = null;
  let timezone = DEFAULT_TIMEZONE;
  if ((emp as { location_id: string | null } | null)?.location_id) {
    const { data: loc } = await db
      .from("locations")
      .select("latitude, longitude, attendance_radius_meters, timezone")
      .eq("id", (emp as { location_id: string }).location_id)
      .maybeSingle();
    location = (loc as LocationRow) ?? null;
    if (location?.timezone) timezone = location.timezone;
  }

  let shift: ShiftRow | null = null;
  if (body.shift_id) {
    const { data: sh } = await db
      .from("shifts")
      .select("start_time, end_time, grace_minutes, break_minutes, half_day_after_minutes, full_day_after_minutes, is_overnight")
      .eq("id", String(body.shift_id))
      .maybeSingle();
    shift = (sh as ShiftRow) ?? null;
  }

  // ── Geo-fence evaluation ───────────────────────────────────────────────────
  let distance_m: number | null = null;
  const exceptions: string[] = [];
  const lat = typeof body.latitude === "number" ? body.latitude : null;
  const lon = typeof body.longitude === "number" ? body.longitude : null;
  const accuracy = typeof body.accuracy_m === "number" ? body.accuracy_m : null;

  if (location?.latitude != null && location?.longitude != null && lat != null && lon != null) {
    const fence = evaluateGeoFence(
      { latitude: lat, longitude: lon },
      { latitude: location.latitude, longitude: location.longitude },
      location.attendance_radius_meters ?? policy.geoRadiusMeters
    );
    distance_m = fence.distanceM;
    if (!fence.withinFence) {
      if (policy.rejectOutsideRadius) {
        throw badRequest("ATTENDANCE_OUTSIDE_RADIUS", "You are outside the permitted office radius.");
      }
      exceptions.push("OUTSIDE_RADIUS");
    }
  }

  // ── Accuracy screening ─────────────────────────────────────────────────────
  if (accuracy != null && accuracy > policy.maxAccuracyMeters) {
    if (policy.maxAccuracyMeters > 0) {
      throw badRequest("ATTENDANCE_LOW_ACCURACY", "Location accuracy is too low to record attendance.");
    }
    exceptions.push("LOW_ACCURACY");
  }

  // ── Late computation in the company/location timezone ──────────────────────
  let late_minutes = 0;
  let status = "PRESENT";
  if (shift) {
    const shiftStart = parseTimeToMinutes(shift.start_time);
    const { minutesOfDay } = zonedParts(new Date(nowIso), timezone);
    late_minutes = Math.max(0, minutesOfDay - shiftStart);
    status = late_minutes > shift.grace_minutes ? "LATE" : "PRESENT";
  }

  // ── Upsert attendance (dedupe same-day check-in) ───────────────────────────
  const { data: existing } = await db
    .from("attendance")
    .select("id, check_in_at")
    .eq("employee_id", employeeId)
    .eq("attendance_date", date)
    .maybeSingle();

  let attendanceId: string;
  let saved: { id: string; attendance_date: string; check_in_at: string; status: string };

  if (existing && (existing as { check_in_at: string | null }).check_in_at) {
    throw badRequest("ATTENDANCE_ALREADY_CHECKED_IN", "You have already checked in for this date.");
  }

  if (existing) {
    attendanceId = (existing as { id: string }).id;
    const { data, error } = await db
      .from("attendance")
      .update({
        check_in_at: nowIso,
        check_in_latitude: lat,
        check_in_longitude: lon,
        check_in_accuracy: accuracy,
        late_minutes,
        status,
        source: "MOBILE",
        updated_at: nowIso,
      })
      .eq("id", attendanceId)
      .select("id, attendance_date, check_in_at, status")
      .single();
    if (error) throw dbError(error);
    saved = data as { id: string; attendance_date: string; check_in_at: string; status: string };
  } else {
    const { data, error } = await db
      .from("attendance")
      .insert({
        employee_id: employeeId,
        company_id: companyId,
        attendance_date: date,
        shift_id: body.shift_id ?? null,
        location_id: (emp as { location_id: string | null } | null)?.location_id ?? null,
        check_in_at: nowIso,
        check_in_latitude: lat,
        check_in_longitude: lon,
        check_in_accuracy: accuracy,
        late_minutes,
        status,
        source: "MOBILE",
      })
      .select("id, attendance_date, check_in_at, status")
      .single();
    if (error) throw dbError(error);
    saved = data as { id: string; attendance_date: string; check_in_at: string; status: string };
    attendanceId = saved.id;
  }

  await db
    .from("attendance_events")
    .insert({
      attendance_id: attendanceId,
      employee_id: employeeId,
      event_type: "CHECK_IN",
      event_at: nowIso,
      latitude: lat,
      longitude: lon,
      accuracy,
      source: "MOBILE",
    })
    .then(() => {});

  await writeAudit(db, {
    company_id: companyId,
    actor_employee_id: employeeId,
    actor_auth_user_id: actor.authUserId,
    action: "ATTENDANCE_CHECK_IN",
    entity_type: "attendance",
    entity_id: attendanceId,
    new_values: { attendance_date: date, status, late_minutes, distance_m, exceptions },
  }).catch(() => {});

  return ok(
    {
      attendance_id: saved.id,
      attendance_date: saved.attendance_date,
      status: saved.status,
      check_in_at: saved.check_in_at,
      check_out_at: null,
      late_minutes,
      worked_minutes: 0,
      distance_m,
      server_time: nowIso,
      exceptions,
    },
    { status: existing ? 200 : 201 }
  );
});
