import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { z } from "zod";
import { createApiClient, getSessionAndProfile, getRole } from "@/lib/api";
import { writeAudit } from "@/lib/audit";

const PatchSchema = z.object({
  first_name: z.string().min(1).optional(),
  last_name: z.string().min(1).optional(),
  official_email: z.string().email().optional().nullable(),
  official_mobile: z.string().optional().nullable(),
  personal_email: z.string().email().optional().nullable(),
  personal_mobile: z.string().optional().nullable(),
  gender: z.string().optional().nullable(),
  date_of_birth: z.string().optional().nullable(),
  blood_group: z.string().optional().nullable(),
  joining_date: z.string().optional().nullable(),
  confirmation_date: z.string().optional().nullable(),
  last_working_date: z.string().optional().nullable(),
  probation_end_date: z.string().optional().nullable(),
  notice_period_days: z.coerce.number().optional().nullable(),
  nationality: z.string().optional().nullable(),
  marital_status: z.string().optional().nullable(),
  employment_status: z.enum(["ACTIVE", "INACTIVE", "ON_NOTICE", "TERMINATED"]).optional(),
  department_id: z.string().uuid().optional().nullable(),
  designation_id: z.string().uuid().optional().nullable(),
  location_id: z.string().uuid().optional().nullable(),
  employment_type_id: z.string().uuid().optional().nullable(),
  manager_id: z.string().uuid().optional().nullable(),
  hr_manager_id: z.string().uuid().optional().nullable(),
});

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const supabase = await createApiClient();
  const { session, profile } = await getSessionAndProfile(supabase);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!profile?.company_id) return NextResponse.json({ error: "Profile not found" }, { status: 404 });
  if (!profile.employee_id) return NextResponse.json({ error: "Employee not found" }, { status: 404 });

  const role = await getRole(supabase, profile.employee_id);
  if (!role || !["SUPER_ADMIN", "HR_ADMIN"].includes(role)) {
    return NextResponse.json({ error: "Forbidden: insufficient role" }, { status: 403 });
  }

  const parsed = PatchSchema.safeParse(await req.json());
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  const updateData = parsed.data;

  const { data: emp, error: empErr } = await supabase
    .from("employees")
    .update(updateData)
    .eq("id", params.id)
    .eq("company_id", profile.company_id)
    .select("id,employee_code,display_name")
    .single();

  if (empErr || !emp) return NextResponse.json({ error: empErr?.message ?? "Failed to update employee" }, { status: 500 });

  await writeAudit(supabase, {
    company_id: profile.company_id,
    actor_employee_id: profile.employee_id,
    actor_auth_user_id: session.user.id,
    action: "EMPLOYEE_UPDATED",
    entity_type: "employees",
    entity_id: emp.id,
    old_values: {},
    new_values: updateData,
  });

  return NextResponse.json({ data: emp, error: null });
}
