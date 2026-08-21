import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { writeAudit } from "@/lib/audit";

const GEO_RADIUS_M = 150;
const GRACE_MINUTES = 15;
const SHIFT_START_H = 9;
const SHIFT_START_M = 30;

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
  const cookieStore = await cookies();
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    { cookies: { getAll: () => cookieStore.getAll() } }
  );

  const { data: { session } } = await supabase.auth.getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json() as {
    latitude: number;
    longitude: number;
    accuracy_m: number;
    device_time: string;
    idempotency_key: string;
  };

  const { latitude, longitude, accuracy_m, device_time, idempotency_key } = body;
  if (!latitude || !longitude || !device_time || !idempotency_key) {
    return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
  }

  // Get profile
  const { data: profile } = await supabase
    .from("profiles")
    .select("id,employee_id,company_id")
    .eq("auth_user_id", session.user.id)
    .single();
  if (!profile?.employee_id) return NextResponse.json({ error: "Employee not found" }, { status: 404 });

  // Idempotency check
  const { data: existing } = await supabase
    .from("idempotency_keys")
    .select("response_body")
    .eq("employee_id", profile.employee_id)
    .eq("idempotency_key", idempotency_key)
    .single();
  if (existing) return NextResponse.json(existing.response_body);

  // Get employee location
  const { data: emp } = await supabase
    .from("employees")
    .select("location_id")
    .eq("id", profile.employee_id)
    .single();

  let isException = false;
  if (emp?.location_id) {
    const { data: loc } = await supabase
      .from("locations")
      .select("latitude,longitude")
      .eq("id", emp.location_id)
      .single();
    if (loc?.latitude && loc?.longitude) {
      const dist = haversineM(latitude, longitude, Number(loc.latitude), Number(loc.longitude));
      if (dist > GEO_RADIUS_M) isException = true;
    }
  }

  // Determine status
  const checkInTime = new Date(device_time);
  const shiftStart = new Date(checkInTime);
  shiftStart.setHours(SHIFT_START_H, SHIFT_START_M, 0, 0);
  const lateMinutes = Math.max(0, Math.floor((checkInTime.getTime() - shiftStart.getTime()) / 60000));
  const status = lateMinutes > GRACE_MINUTES ? "LATE" : "PRESENT";
  const today = checkInTime.toISOString().slice(0, 10);

  // Upsert attendance
  const { data: att, error: attErr } = await supabase
    .from("attendance")
    .upsert({
      employee_id: profile.employee_id,
      company_id: profile.company_id,
      attendance_date: today,
      check_in_at: device_time,
      check_in_latitude: latitude,
      check_in_longitude: longitude,
      check_in_accuracy: accuracy_m,
      status,
      late_minutes: lateMinutes,
      source: "MOBILE",
    }, { onConflict: "employee_id,attendance_date" })
    .select("id")
    .single();

  if (attErr) return NextResponse.json({ error: attErr.message }, { status: 500 });

  // Create exception if outside radius
  if (isException && att) {
    await supabase.from("attendance_exceptions").insert({
      attendance_id: att.id,
      employee_id: profile.employee_id,
      exception_type: "GEO_OUTSIDE_RADIUS",
      description: `Check-in location outside ${GEO_RADIUS_M}m radius`,
      severity: "MEDIUM",
      status: "OPEN",
    });
  }

  // Flag poor GPS accuracy
  if (accuracy_m > 100 && att) {
    await supabase.from("attendance_exceptions").insert({
      attendance_id: att.id,
      employee_id: profile.employee_id,
      exception_type: "POOR_GPS_ACCURACY",
      description: `GPS accuracy ${accuracy_m}m exceeds 100m threshold`,
      severity: "LOW",
      status: "OPEN",
    });
  }

  await writeAudit(supabase, {
    company_id: profile.company_id,
    actor_employee_id: profile.employee_id,
    actor_auth_user_id: session.user.id,
    action: "CHECK_IN",
    entity_type: "attendance",
    entity_id: att?.id,
    new_values: { status, late_minutes: lateMinutes, is_exception: isException },
  });

  const response = { data: { attendance_id: att?.id, status, late_minutes: lateMinutes, is_exception: isException }, error: null };

  await supabase.from("idempotency_keys").insert({
    employee_id: profile.employee_id,
    idempotency_key,
    endpoint: "/api/attendance/check-in",
    response_status: 200,
    response_body: response,
  });

  return NextResponse.json(response);
}
