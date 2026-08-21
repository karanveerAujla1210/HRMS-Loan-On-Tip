import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createApiClient, getSessionAndProfile } from "@/lib/api";
import { writeAudit } from "@/lib/audit";

const HALF_DAY_THRESHOLD = 240;

const Schema = z.object({
  latitude: z.number().optional(),
  longitude: z.number().optional(),
  accuracy_m: z.number().optional(),
  device_time: z.string().datetime({ offset: true }),
});

export async function POST(req: NextRequest) {
  const supabase = await createApiClient();
  const { session, profile } = await getSessionAndProfile(supabase);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!profile?.employee_id) return NextResponse.json({ error: "Employee not found" }, { status: 404 });

  const parsed = Schema.safeParse(await req.json());
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  const { latitude, longitude, accuracy_m, device_time } = parsed.data;
  const today = new Date(device_time).toISOString().slice(0, 10);

  const { data: att } = await supabase
    .from("attendance")
    .select("id,check_in_at,status,late_minutes")
    .eq("employee_id", profile.employee_id)
    .eq("attendance_date", today)
    .maybeSingle();

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
      check_out_latitude: latitude ?? null,
      check_out_longitude: longitude ?? null,
      check_out_accuracy: accuracy_m ?? null,
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
