import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { writeAudit } from "@/lib/audit";

const HALF_DAY_THRESHOLD = 240;

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
  };

  const { latitude, longitude, accuracy_m, device_time } = body;
  if (!device_time) return NextResponse.json({ error: "device_time required" }, { status: 400 });

  const { data: profile } = await supabase
    .from("profiles")
    .select("id,employee_id,company_id")
    .eq("auth_user_id", session.user.id)
    .single();
  if (!profile?.employee_id) return NextResponse.json({ error: "Employee not found" }, { status: 404 });

  const today = new Date(device_time).toISOString().slice(0, 10);

  const { data: att } = await supabase
    .from("attendance")
    .select("id,check_in_at,status,late_minutes")
    .eq("employee_id", profile.employee_id)
    .eq("attendance_date", today)
    .single();

  if (!att?.check_in_at) return NextResponse.json({ error: "No check-in found for today" }, { status: 400 });

  const workedMinutes = Math.max(
    0,
    Math.floor((new Date(device_time).getTime() - new Date(att.check_in_at).getTime()) / 60000)
  );

  let status = att.status as string;
  if (workedMinutes < HALF_DAY_THRESHOLD) status = "HALF_DAY";

  const { error } = await supabase
    .from("attendance")
    .update({
      check_out_at: device_time,
      check_out_latitude: latitude,
      check_out_longitude: longitude,
      check_out_accuracy: accuracy_m,
      worked_minutes: workedMinutes,
      status,
    })
    .eq("id", att.id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  await writeAudit(supabase, {
    company_id: profile.company_id,
    actor_employee_id: profile.employee_id,
    actor_auth_user_id: session.user.id,
    action: "CHECK_OUT",
    entity_type: "attendance",
    entity_id: att.id,
    new_values: { status, worked_minutes: workedMinutes },
  });

  return NextResponse.json({ data: { attendance_id: att.id, worked_minutes: workedMinutes, status }, error: null });
}
