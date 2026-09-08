import "server-only";
import { withApi, jsonOk } from "@/lib/server/http";
import { z } from "zod";
import { adminClient } from "@/lib/server/supabase";
import { mapDatabaseError, validationError } from "@/lib/server/errors";

const ImportSchema = z
  .object({
    employees: z
      .array(z.record(z.string(), z.unknown()))
      .min(1)
      .max(500),
  })
  .strict();

const nullable = (v: unknown): string | null => {
  const s = typeof v === "string" ? v.trim() : "";
  return s.length > 0 ? s : null;
};

const nullableNumber = (v: unknown): number | null => {
  const s = nullable(v);
  if (s === null) return null;
  const n = Number(s.replace(/,/g, ""));
  return Number.isFinite(n) ? n : null;
};

const nullableDate = (v: unknown): string | null => {
  const s = nullable(v);
  return s !== null && /^\d{4}-\d{2}-\d{2}$/.test(s) ? s : null;
};

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export const POST = withApi<typeof ImportSchema, z.ZodTypeAny, Record<string, never>>({
  permission: "employee.create",
  body: ImportSchema,
  rateLimit: { limit: 5, windowMs: 60_000 },
  handler: async ({ ctx, body, audit, requestId }) => {
    const companyId = ctx.companyId!;
    const db = adminClient();

    // Preload name → id lookups for the whole batch.
    const [deptRes, desigRes, locRes, typeRes, empRes] = await Promise.all([
      db.from("departments").select("id,name").eq("company_id", companyId),
      db.from("designations").select("id,name").eq("company_id", companyId),
      db.from("locations").select("id,name").eq("company_id", companyId),
      db.from("employment_types").select("id,name").eq("company_id", companyId),
      db.from("employees").select("id,official_email").eq("company_id", companyId),
    ]);
    for (const res of [deptRes, desigRes, locRes, typeRes, empRes]) {
      if (res.error) throw mapDatabaseError(res.error);
    }

    const toMap = (rows: { name: string }[] | null) =>
      new Map((rows ?? []).map((r) => [String(r.name).toLowerCase().trim(), r.id]));
    const departments = toMap(deptRes.data as { name: string }[]);
    const designations = toMap(desigRes.data as { name: string }[]);
    const locations = toMap(locRes.data as { name: string }[]);
    const employmentTypes = toMap(typeRes.data as { name: string }[]);
    const employeesByEmail = new Map(
      ((empRes.data ?? []) as { id: string; official_email: string }[]).map((e) => [
        e.official_email.toLowerCase().trim(),
        e.id,
      ])
    );

    let success = 0;
    let failed = 0;
    const failedRows: string[] = [];

    for (let i = 0; i < body.employees.length; i++) {
      const row = body.employees[i] as Record<string, unknown>;
      const rowNum = i + 2; // +2 accounts for the CSV header row
      const firstName = nullable(row.first_name);
      const lastName = nullable(row.last_name);
      const email = nullable(row.official_email);

      try {
        if (!firstName || !lastName) throw new Error(`"first_name" and "last_name" are required`);
        if (!email || !EMAIL_RE.test(email)) throw new Error(`a valid "official_email" is required`);
        if (employeesByEmail.has(email.toLowerCase())) {
          throw new Error(`official_email "${email}" already exists`);
        }
        const managerEmail = nullable(row.manager_email);
        const hrManagerEmail = nullable(row.hr_manager_email);
        const managerId = managerEmail ? employeesByEmail.get(managerEmail.toLowerCase()) ?? null : null;
        const hrManagerId = hrManagerEmail ? employeesByEmail.get(hrManagerEmail.toLowerCase()) ?? null : null;

        const department = nullable(row.department);
        const designation = nullable(row.designation);
        const location = nullable(row.location);
        const employmentType = nullable(row.employment_type);

        const { data, error } = await db
          .from("employees")
          .insert({
            company_id: companyId,
            first_name: firstName,
            middle_name: nullable(row.middle_name),
            last_name: lastName,
            official_email: email,
            personal_email: nullable(row.personal_email),
            official_mobile: nullable(row.official_mobile),
            personal_mobile: nullable(row.personal_mobile),
            gender: nullable(row.gender),
            date_of_birth: nullableDate(row.date_of_birth),
            blood_group: nullable(row.blood_group),
            joining_date: nullableDate(row.joining_date),
            confirmation_date: nullableDate(row.confirmation_date),
            probation_end_date: nullableDate(row.probation_end_date),
            notice_period_days: nullableNumber(row.notice_period_days),
            nationality: nullable(row.nationality),
            marital_status: nullable(row.marital_status),
            employment_status: (nullable(row.employment_status) ?? "ACTIVE").toUpperCase(),
            department_id: department ? departments.get(department.toLowerCase()) ?? null : null,
            designation_id: designation ? designations.get(designation.toLowerCase()) ?? null : null,
            location_id: location ? locations.get(location.toLowerCase()) ?? null : null,
            employment_type_id: employmentType
              ? employmentTypes.get(employmentType.toLowerCase()) ?? null
              : null,
            manager_id: managerId,
            hr_manager_id: hrManagerId,
            bank_name: nullable(row.bank_name),
            account_number: nullable(row.account_number),
            ifsc_code: nullable(row.ifsc_code),
            pan_number: nullable(row.pan_number),
            aadhaar_number: nullable(row.aadhaar_last4),
            uan: nullable(row.uan),
          })
          .select("id, employee_code, display_name")
          .single();
        if (error) throw mapDatabaseError(error);

        const employeeId = (data as { id: string }).id;

        // Optional starting salary assignment.
        const annualCtc = nullableNumber(row.annual_ctc);
        if (annualCtc !== null) {
          const effectiveFrom = nullableDate(row.joining_date) ?? new Date().toISOString().slice(0, 10);
          const { error: salErr } = await db.from("employee_salary_assignments").insert({
            employee_id: employeeId,
            annual_ctc: annualCtc,
            effective_from: effectiveFrom,
            is_current: true,
            approved_by: ctx.employeeId,
          });
          if (salErr) throw mapDatabaseError(salErr);
        }

        // Register the new email so later rows in the same file can reference
        // this employee as their manager.
        employeesByEmail.set(email.toLowerCase(), employeeId);
        success++;
      } catch (err) {
        failed++;
        const message = err instanceof Error ? err.message : "Unknown error";
        failedRows.push(`Row ${rowNum} (${firstName ?? ""} ${lastName ?? ""}): ${message}`);
      }
    }

    if (success === 0) {
      throw validationError(failedRows, "No employees were imported — fix the errors and try again.");
    }

    await audit({
      action: "EMPLOYEE_BULK_IMPORT",
      entityType: "employees",
      entityId: null,
      newValues: { success, failed },
    });

    return jsonOk({ success, failed, failedRows }, requestId);
  },
});