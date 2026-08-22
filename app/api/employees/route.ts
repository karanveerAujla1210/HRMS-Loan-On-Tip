import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { z } from "zod";
import { createApiClient, getSessionAndProfile, getRole } from "@/lib/api";
import { writeAudit } from "@/lib/audit";

const PostSchema = z.object({
  first_name: z.string().min(1),
  last_name: z.string().min(1),
  official_email: z.string().email().optional().nullable(),
  official_mobile: z.string().optional().nullable(),
  personal_email: z.string().email().optional().nullable(),
  personal_mobile: z.string().optional().nullable(),
  gender: z.string().optional().nullable(),
  date_of_birth: z.string().optional().nullable(),
  blood_group: z.string().optional().nullable(),
  joining_date: z.string(),
  confirmation_date: z.string().optional().nullable(),
  last_working_date: z.string().optional().nullable(),
  probation_end_date: z.string().optional().nullable(),
  notice_period_days: z.coerce.number().optional().nullable(),
  nationality: z.string().optional().nullable(),
  marital_status: z.string().optional().nullable(),
  employment_status: z.enum(["ACTIVE", "INACTIVE", "ON_NOTICE", "TERMINATED"]).default("ACTIVE"),
  department_id: z.string().uuid().optional().nullable(),
  designation_id: z.string().uuid().optional().nullable(),
  location_id: z.string().uuid().optional().nullable(),
  employment_type_id: z.string().uuid().optional().nullable(),
  manager_id: z.string().uuid().optional().nullable(),
  hr_manager_id: z.string().uuid().optional().nullable(),
  annual_ctc: z.coerce.number().positive().optional().nullable(),
  bank_name: z.string().optional().nullable(),
  account_number: z.string().optional().nullable(),
  ifsc_code: z.string().optional().nullable(),
  pan_number: z.string().optional().nullable(),
  aadhaar_last4: z.string().optional().nullable(),
  uan: z.string().optional().nullable(),
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

  const data = parsed.data;

  const { data: emp, error: empErr } = await supabase
    .from("employees")
    .insert({
      company_id: profile.company_id,
      first_name: data.first_name,
      last_name: data.last_name,
      official_email: data.official_email,
      official_mobile: data.official_mobile,
      personal_email: data.personal_email,
      personal_mobile: data.personal_mobile,
      gender: data.gender,
      date_of_birth: data.date_of_birth,
      blood_group: data.blood_group,
      joining_date: data.joining_date,
      confirmation_date: data.confirmation_date,
      last_working_date: data.last_working_date,
      probation_end_date: data.probation_end_date,
      notice_period_days: data.notice_period_days,
      nationality: data.nationality ?? "Indian",
      marital_status: data.marital_status,
      employment_status: data.employment_status,
      department_id: data.department_id,
      designation_id: data.designation_id,
      location_id: data.location_id,
      employment_type_id: data.employment_type_id,
      manager_id: data.manager_id,
      hr_manager_id: data.hr_manager_id,
    })
    .select("id,employee_code,display_name")
    .single();

  if (empErr || !emp) return NextResponse.json({ error: empErr?.message ?? "Failed to create employee" }, { status: 500 });

  // Insert bank account if provided
  if (data.bank_name && data.account_number && data.ifsc_code) {
    await supabase.from("employee_bank_accounts").insert({
      employee_id: emp.id,
      account_holder_name: `${data.first_name} ${data.last_name}`,
      bank_name: data.bank_name,
      account_number_encrypted: data.account_number,
      account_number_last4: data.account_number.slice(-4),
      ifsc_code: data.ifsc_code,
      account_type: "SAVINGS",
      is_primary: true,
    });
  }

  // Insert statutory details if provided
  if (data.pan_number || data.aadhaar_last4 || data.uan) {
    await supabase.from("employee_statutory_details").insert({
      employee_id: emp.id,
      pan_last4: data.pan_number ? data.pan_number.slice(-4) : null,
      uan: data.uan || null,
      aadhaar_last4: data.aadhaar_last4 || null,
    });
  }

  await writeAudit(supabase, {
    company_id: profile.company_id,
    actor_employee_id: profile.employee_id,
    actor_auth_user_id: session.user.id,
    action: "EMPLOYEE_CREATED",
    entity_type: "employees",
    entity_id: emp.id,
    new_values: { employee_code: emp.employee_code, display_name: emp.display_name },
  });

  return NextResponse.json({ data: emp, error: null }, { status: 201 });
}
