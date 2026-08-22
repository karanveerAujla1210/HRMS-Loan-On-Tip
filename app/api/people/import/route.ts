import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { z } from "zod";
import { createApiClient, getSessionAndProfile, getRole } from "@/lib/api";
import { writeAudit } from "@/lib/audit";

const EmployeeRowSchema = z.object({
  first_name: z.string().min(1),
  last_name: z.string().min(1),
  middle_name: z.string().optional().nullable(),
  official_email: z.string().email().optional().nullable(),
  personal_email: z.string().email().optional().nullable(),
  official_mobile: z.string().optional().nullable(),
  personal_mobile: z.string().optional().nullable(),
  gender: z.string().optional().nullable(),
  date_of_birth: z.string().optional().nullable(),
  blood_group: z.string().optional().nullable(),
  joining_date: z.string().min(1),
  confirmation_date: z.string().optional().nullable(),
  last_working_date: z.string().optional().nullable(),
  probation_end_date: z.string().optional().nullable(),
  notice_period_days: z.coerce.number().optional().nullable(),
  nationality: z.string().optional().default("Indian"),
  marital_status: z.string().optional().nullable(),
  employment_status: z.string().optional().default("ACTIVE"),
  department: z.string().optional().nullable(),
  designation: z.string().optional().nullable(),
  location: z.string().optional().nullable(),
  employment_type: z.string().optional().nullable(),
  manager_email: z.string().optional().nullable(),
  hr_manager_email: z.string().optional().nullable(),
  annual_ctc: z.coerce.number().optional().nullable(),
  bank_name: z.string().optional().nullable(),
  account_number: z.string().optional().nullable(),
  ifsc_code: z.string().optional().nullable(),
  pan_number: z.string().optional().nullable(),
  aadhaar_last4: z.string().optional().nullable(),
  uan: z.string().optional().nullable(),
});

const ImportSchema = z.object({ employees: z.array(EmployeeRowSchema).min(1).max(500) });

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

  const parsed = ImportSchema.safeParse(await req.json());
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  const companyId = profile.company_id;

  const [deptRes, desigRes, locRes, empTypeRes] = await Promise.all([
    supabase.from("departments").select("id,name").eq("company_id", companyId),
    supabase.from("designations").select("id,name").eq("company_id", companyId),
    supabase.from("locations").select("id,name").eq("company_id", companyId),
    supabase.from("employment_types").select("id,name").eq("company_id", companyId),
  ]);

  const toMap = (data: { id: string; name: string }[] | null) =>
    Object.fromEntries((data ?? []).map((r) => [r.name.toLowerCase().trim(), r.id]));

  const deptMap = toMap(deptRes.data as { id: string; name: string }[]);
  const desigMap = toMap(desigRes.data as { id: string; name: string }[]);
  const locMap = toMap(locRes.data as { id: string; name: string }[]);
  const empTypeMap = toMap(empTypeRes.data as { id: string; name: string }[]);

  const { data: existingEmps } = await supabase.from("employees").select("official_email").eq("company_id", companyId);
  const existingEmails = new Set((existingEmps ?? []).map((e: { official_email: string }) => (e.official_email ?? "").toLowerCase().trim()));

  let success = 0, failed = 0;
  const failedRows: string[] = [];

  for (const row of parsed.data.employees) {
    const emailKey = (row.official_email ?? "").toLowerCase().trim();
    if (emailKey && existingEmails.has(emailKey)) {
      failedRows.push(`${row.first_name} ${row.last_name} — duplicate email`);
      failed++;
      continue;
    }

    const empPayload: Record<string, unknown> = {
      company_id: companyId,
      first_name: row.first_name,
      last_name: row.last_name,
      middle_name: row.middle_name || null,
      official_email: row.official_email || null,
      personal_email: row.personal_email || null,
      official_mobile: row.official_mobile || null,
      personal_mobile: row.personal_mobile || null,
      gender: row.gender || null,
      date_of_birth: row.date_of_birth || null,
      blood_group: row.blood_group || null,
      joining_date: row.joining_date,
      confirmation_date: row.confirmation_date || null,
      last_working_date: row.last_working_date || null,
      probation_end_date: row.probation_end_date || null,
      notice_period_days: row.notice_period_days ?? null,
      nationality: row.nationality || "Indian",
      marital_status: row.marital_status || null,
      employment_status: (row.employment_status || "ACTIVE").toUpperCase(),
      department_id: row.department ? (deptMap[row.department.toLowerCase().trim()] ?? null) : null,
      designation_id: row.designation ? (desigMap[row.designation.toLowerCase().trim()] ?? null) : null,
      location_id: row.location ? (locMap[row.location.toLowerCase().trim()] ?? null) : null,
      employment_type_id: row.employment_type ? (empTypeMap[row.employment_type.toLowerCase().trim()] ?? null) : null,
    };

    const { data: empData, error: empError } = await supabase.from("employees").insert(empPayload).select("id").single();

    if (empError) {
      failedRows.push(`${row.first_name} ${row.last_name} — ${empError.message}`);
      failed++;
      continue;
    }

    const empId = empData.id;
    if (emailKey) existingEmails.add(emailKey);

    if (row.account_number && row.bank_name && row.ifsc_code) {
      await supabase.from("employee_bank_accounts").insert({
        employee_id: empId,
        account_holder_name: `${row.first_name} ${row.last_name}`,
        bank_name: row.bank_name,
        account_number_encrypted: row.account_number,
        account_number_last4: row.account_number.slice(-4),
        ifsc_code: row.ifsc_code,
        account_type: "SAVINGS",
        is_primary: true,
      });
    }

    if (row.pan_number || row.aadhaar_last4 || row.uan) {
      await supabase.from("employee_statutory_details").insert({
        employee_id: empId,
        pan_last4: row.pan_number ? row.pan_number.slice(-4) : null,
        uan: row.uan || null,
        aadhaar_last4: row.aadhaar_last4 || null,
      });
    }

    success++;
  }

  await writeAudit(supabase, {
    company_id: profile.company_id,
    actor_employee_id: profile.employee_id,
    actor_auth_user_id: session.user.id,
    action: "EMPLOYEE_BULK_IMPORT",
    entity_type: "employees",
    new_values: { success, failed, total: parsed.data.employees.length },
  });

  return NextResponse.json({ success, failed, failedRows, total: parsed.data.employees.length });
}
