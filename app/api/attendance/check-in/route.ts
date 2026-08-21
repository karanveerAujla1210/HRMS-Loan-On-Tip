import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createApiClient, getSessionAndProfile } from "@/lib/api";
import { writeAudit } from "@/lib/audit";

const Schema = z.object({
  latitude: z.number(),
  longitude: z.number(),
  accuracy_m: z.number(),
  device_time: z.string().datetime({ offset: true }),
  idempotency_key: z.string().min(1),
  is_mock_location: z.boolean().optional(),
  device_id: z.string().optional(),
});

function haversineM(lat1: number, lon1: number, lat2: number, lon2: number) {
  const R = 6371000;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export async function POST(req: NextRequest) {
  const supabase = await createApiClient();
  const { session, profile } = await getSessionAndProfile(supabase);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!profile?.employee_id) return NextResponse.json({ error: "Employee not found" }, { status: 404 });

  const parsed = Schema.safeParse(await req.json());
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  const { latitude, longitude, accuracy_m, device_time, idempotency_key, is_mock_location, device_id } = parsed.data;

  // Idempotency check
  const { data: existing } = await supabase
    .from("idempotency_keys")
    .select("response_body")
    .eq("employee_id", profile.employee_id)
    .eq("idempotency_key", idempotency_key)
    .maybeSingle();
  if (existing) return NextResponse.json(existing.response_body);

  // Duplicate device check
  if (device_id) {
    const today = new Date(device_time).toISOString().slice(0, 10);
    const { data: dupDevice } = await supabase
      .from("attendance")
      .select("id,employee_id")
      .eq("device_id", device_id)
      .eq("attendance_date", today)
      .neq("employee_id", profile.employee_id)
      .limit(1);
    if (dupDevice?.length) {
      await supabase.from("attendance_exceptions").insert({
        employee_id: profile.employee_id,
        exception_type: "DUPLICATE_DEVICE",
        description: `Device ${device_id} already used by another employee today`,
        severity: "HIGH",
        status: "OPEN",
      });
    }
  }

  // Get employee location and shift settings
  const { data: emp } = await supabase
    .from("employees")
    .select("location_id")
    .eq("id", profile.employee_id)
    .single();

  let geoRadius = 150;
  let graceMinutes = 15;
  let shiftStartH = 9;
  let shiftStartM = 30;
  let isException = false;

  if (emp?.location_id) {
    const { data: loc } = await supabase
      .from("locations")
      .select("latitude,longitude,attendance_radius_meters")
      .eq("id", emp.location_id)
      .single();

    if (loc?.attendance_radius_meters) geoRadius = loc.attendance_radius_meters;

    if (loc?.latitude && loc?.longitude) {
      const dist = haversineM(latitude, longitude, Number(loc.latitude), Number(loc.longitude));
      if (dist > geoRadius) isException = true;
    }
  }

  // Read employee's assigned shift
  const { data: sa } = await supabase
    .from("shift_assignments")
    .select("shifts(start_time,grace_minutes)")
    .eq("employee_id", profile.employee_id)
    .eq("is_current", true)
    .single();
  const shift = (sa as { shifts: { start_time: string; grace_minutes: number } | null } | null)?.shifts;
  if (shift?.start_time) {
    const [h, m] = shift.start_time.split(":").map(Number);
    shiftStartH = h;
    shiftStartM = m;
  }
  if (shift?.grace_minutes) graceMinutes = shift.grace_minutes;

  const checkInTime = new Date(device_time);
  const shiftStart = new Date(checkInTime);
  shiftStart.setHours(shiftStartH, shiftStartM, 0, 0);
  const lateMinutes = Math.max(0, Math.floor((checkInTime.getTime() - shiftStart.getTime()) / 60000));
  const status = lateMinutes > graceMinutes ? "LATE" : "PRESENT";
  const today = checkInTime.toISOString().slice(0, 10);

  const { data: att, error: attErr } = await supabase
    .from("attendance")
    .upsert({
      employee_id: profile.employee_id,
      company_id: profile.company_id,
      location_id: emp?.location_id ?? null,
      attendance_date: today,
      check_in_at: device_time,
      check_in_latitude: latitude,
      check_in_longitude: longitude,
      check_in_accuracy: accuracy_m,
      device_id: device_id ?? null,
      status,
      late_minutes: lateMinutes,
      source: "MOBILE",
    }, { onConflict: "employee_id,attendance_date" })
    .select("id")
    .single();

  if (attErr) return NextResponse.json({ error: attErr.message }, { status: 500 });

  const exceptions: Promise<unknown>[] = [];

  if (isException && att) {
    exceptions.push(Promise.resolve(supabase.from("attendance_exceptions").insert({
      attendance_id: att.id,
      employee_id: profile.employee_id,
      exception_type: "GEO_OUTSIDE_RADIUS",
      description: `Check-in location outside ${geoRadius}m radius`,
      severity: "MEDIUM",
      status: "OPEN",
    })));
  }

  if (accuracy_m > 100 && att) {
    exceptions.push(Promise.resolve(supabase.from("attendance_exceptions").insert({
      attendance_id: att.id,
      employee_id: profile.employee_id,
      exception_type: "POOR_GPS_ACCURACY",
      description: `GPS accuracy ${accuracy_m}m exceeds 100m threshold`,
      severity: "LOW",
      status: "OPEN",
    })));
  }

  if (is_mock_location && att) {
    exceptions.push(Promise.resolve(supabase.from("attendance_exceptions").insert({
      attendance_id: att.id,
      employee_id: profile.employee_id,
      exception_type: "MOCK_LOCATION",
      description: "Mock location detected on device",
      severity: "HIGH",
      status: "OPEN",
    })));
  }

  await Promise.all(exceptions);

  await writeAudit(supabase, {
    company_id: profile.company_id,
    actor_employee_id: profile.employee_id,
    actor_auth_user_id: session.user.id,
    action: "CHECK_IN",
    entity_type: "attendance",
    entity_id: att?.id,
    new_values: { status, late_minutes: lateMinutes, is_exception: isException },
  });

  const response = {
    data: { attendance_id: att?.id, status, late_minutes: lateMinutes, is_exception: isException },
    error: null,
  };

  await supabase.from("idempotency_keys").insert({
    employee_id: profile.employee_id,
    idempotency_key,
    endpoint: "/api/attendance/check-in",
    response_status: 200,
    response_body: response,
  });

  return NextResponse.json(response);
}
