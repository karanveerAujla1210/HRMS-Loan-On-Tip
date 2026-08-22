import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { z } from "zod";
import { createApiClient, getSessionAndProfile, getRole } from "@/lib/api";
import { writeAudit } from "@/lib/audit";

const ALLOWED_TABLES = ["departments", "designations", "locations", "shifts", "leave_types", "holidays", "custom_fields"] as const;

const PostSchema = z.object({
  table: z.enum(ALLOWED_TABLES),
  code: z.string().optional().nullable(),
  name: z.string().min(1),
  level: z.coerce.number().optional().nullable(),
  city: z.string().optional().nullable(),
  state: z.string().optional().nullable(),
  latitude: z.coerce.number().optional().nullable(),
  longitude: z.coerce.number().optional().nullable(),
  attendance_radius_meters: z.coerce.number().optional().nullable(),
  start_time: z.string().optional().nullable(),
  end_time: z.string().optional().nullable(),
  grace_minutes: z.coerce.number().optional().nullable(),
  is_paid: z.boolean().optional().default(true),
  allows_half_day: z.boolean().optional().default(true),
  requires_document: z.boolean().optional().default(false),
  field_type: z.string().optional().nullable(),
  options: z.any().optional().nullable(),
  holiday_date: z.string().optional().nullable(),
  is_optional: z.boolean().optional().default(false),
  description: z.string().optional().nullable(),
});

export async function POST(req: NextRequest) {
  const supabase = await createApiClient();
  const { session, profile } = await getSessionAndProfile(supabase);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!profile?.company_id) return NextResponse.json({ error: "Profile not found" }, { status: 404 });
  if (!profile.employee_id) return NextResponse.json({ error: "Employee not found" }, { status: 404 });

  const role = await getRole(supabase, profile.employee_id);
  if (!role || !["SUPER_ADMIN", "HR_ADMIN"].includes(role)) {
    return NextResponse.json({ error: "Forbidden: insufficient role" }, { status: 403 });
  }

  const parsed = PostSchema.safeParse(await req.json());
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  const table = parsed.data.table;
  const payload: Record<string, unknown> = { company_id: profile.company_id, is_active: true };

  if (table === "departments") {
    payload.department_code = parsed.data.code;
    payload.name = parsed.data.name;
  } else if (table === "designations") {
    payload.designation_code = parsed.data.code;
    payload.name = parsed.data.name;
    payload.level = parsed.data.level ?? 1;
  } else if (table === "locations") {
    payload.location_code = parsed.data.code;
    payload.name = parsed.data.name;
    payload.city = parsed.data.city;
    payload.state = parsed.data.state;
    payload.latitude = parsed.data.latitude;
    payload.longitude = parsed.data.longitude;
    payload.attendance_radius_meters = parsed.data.attendance_radius_meters ?? 150;
  } else if (table === "shifts") {
    payload.shift_code = parsed.data.code;
    payload.name = parsed.data.name;
    payload.start_time = parsed.data.start_time;
    payload.end_time = parsed.data.end_time;
    payload.grace_minutes = parsed.data.grace_minutes ?? 15;
  } else if (table === "leave_types") {
    payload.code = parsed.data.code;
    payload.name = parsed.data.name;
    payload.is_paid = parsed.data.is_paid;
    payload.allows_half_day = parsed.data.allows_half_day;
    payload.requires_document = parsed.data.requires_document;
  } else if (table === "custom_fields") {
    payload.name = parsed.data.name;
    payload.field_type = parsed.data.field_type;
    payload.options = parsed.data.options;
  } else if (table === "holidays") {
    payload.name = parsed.data.name;
    payload.holiday_date = parsed.data.holiday_date;
    payload.is_optional = parsed.data.is_optional;
    payload.description = parsed.data.description;
  }

  const { data, error } = await supabase.from(table).insert(payload).select("id").single();

  if (error || !data) return NextResponse.json({ error: error?.message ?? "Failed to create record" }, { status: 500 });

  await writeAudit(supabase, {
    company_id: profile.company_id,
    actor_employee_id: profile.employee_id,
    actor_auth_user_id: session.user.id,
    action: `ORG_${table.toUpperCase()}_CREATED`,
    entity_type: table,
    entity_id: data.id,
    new_values: payload,
  });

  return NextResponse.json({ data: { id: data.id }, error: null }, { status: 201 });
}
