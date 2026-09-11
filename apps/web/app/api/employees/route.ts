import "server-only";
import { withApi, jsonOk } from "@/lib/server/http";
import { EmployeeCreateSchema, EmployeeListQuerySchema } from "@hrms/api-contract";
import { mapDatabaseError } from "@/lib/server/errors";
import { adminClient } from "@/lib/server/supabase";

export const GET = withApi({
  permission: "employee.view",
  query: EmployeeListQuerySchema,
  handler: async ({ ctx, query, requestId }) => {
    const companyId = ctx.companyId!;
    const db = adminClient();

    const page = query.page ?? 1;
    const pageSize = Math.min(query.pageSize ?? 50, 100);
    const from = (page - 1) * pageSize;
    const to = from + pageSize - 1;

    let q = db
      .from("employees")
      .select(
        "id,employee_code,first_name,last_name,display_name,official_email,official_mobile,employment_status,joining_date,department_id,designation_id,location_id,departments(name),designations(name),locations(name)",
        { count: "exact" }
      )
      .eq("company_id", companyId)
      .order("display_name")
      .range(from, to);

    if (query.search) {
      q = q.or(`display_name.ilike.%${query.search}%,employee_code.ilike.%${query.search}%,official_email.ilike.%${query.search}%`);
    }
    if (query.status) q = q.eq("employment_status", query.status);
    if (query.departmentId) q = q.eq("department_id", query.departmentId);
    if (query.locationId) q = q.eq("location_id", query.locationId);

    const { data, error, count } = await q;
    if (error) throw mapDatabaseError(error);

    // Flatten joined names for DataTable display
    const rows = (data ?? []).map((e: Record<string, unknown>) => ({
      ...e,
      department: (e.departments as { name?: string } | null)?.name ?? null,
      designation: (e.designations as { name?: string } | null)?.name ?? null,
      location: (e.locations as { name?: string } | null)?.name ?? null,
    }));

    return jsonOk(
      {
        data: rows,
        pagination: {
          page,
          page_size: pageSize,
          total: count ?? 0,
          total_pages: Math.ceil((count ?? 0) / pageSize),
        },
      },
      requestId
    );
  },
});

export const POST = withApi({
  permission: "employee.create",
  body: EmployeeCreateSchema,
  idempotencyEndpoint: "employees/create",
  idempotencyKey: (body) => body.idempotency_key,
  rateLimit: { limit: 30, windowMs: 60_000 },
  handler: async ({ ctx, body, audit, requestId }) => {
    const companyId = ctx.companyId!;
    const db = adminClient();

    const { data, error } = await db
      .from("employees")
      .insert({
        company_id: companyId,
        first_name: body.first_name,
        middle_name: body.middle_name ?? null,
        last_name: body.last_name,
        gender: body.gender ?? null,
        date_of_birth: body.date_of_birth ?? null,
        blood_group: body.blood_group ?? null,
        joining_date: body.joining_date,
        confirmation_date: body.confirmation_date ?? null,
        probation_end_date: body.probation_end_date ?? null,
        notice_period_days: body.notice_period_days ?? null,
        official_email: body.official_email ?? null,
        personal_email: body.personal_email ?? null,
        official_mobile: body.official_mobile ?? null,
        personal_mobile: body.personal_mobile ?? null,
        nationality: body.nationality ?? "Indian",
        marital_status: body.marital_status ?? null,
        employment_status: body.employment_status ?? "ACTIVE",
        department_id: body.department_id ?? null,
        designation_id: body.designation_id ?? null,
        location_id: body.location_id ?? null,
        employment_type_id: body.employment_type_id ?? null,
        team_id: body.team_id ?? null,
        manager_id: body.manager_id ?? null,
        hr_manager_id: body.hr_manager_id ?? null,
      })
      .select("id, employee_code, display_name")
      .single();

    if (error) throw mapDatabaseError(error);

    // Insert shift assignment if provided
    if (body.shift_id && data?.id) {
      await db.from("shift_assignments").insert({
        employee_id: data.id,
        shift_id: body.shift_id,
        effective_from: body.joining_date,
        is_current: true,
        assigned_by: ctx.employeeId ?? null,
      });
    }

    // Insert emergency contact if provided
    if (body.emergency_contact_name && data?.id) {
      await db.from("employee_emergency_contacts").insert({
        employee_id: data.id,
        name: body.emergency_contact_name,
        relationship: body.emergency_contact_relationship ?? null,
        mobile: body.emergency_contact_mobile ?? "",
        is_primary: true,
      });
    }

    // Insert bank account if provided
    if (body.bank_name && body.account_number && body.ifsc_code && data?.id) {
      await db.from("employee_bank_accounts").insert({
        employee_id: data.id,
        account_holder_name: `${body.first_name} ${body.last_name}`,
        bank_name: body.bank_name,
        account_number_encrypted: body.account_number,
        account_number_last4: body.account_number.slice(-4),
        ifsc_code: body.ifsc_code,
        is_primary: true,
      });
    }

    // Insert statutory details if provided
    if ((body.pan_number || body.aadhaar_number || body.uan || body.pf_number || body.esi_number) && data?.id) {
      await db.from("employee_statutory_details").insert({
        employee_id: data.id,
        pan_encrypted: body.pan_number ?? null,
        pan_last4: body.pan_number ? body.pan_number.slice(-4) : null,
        uan: body.uan ?? null,
        pf_number: body.pf_number ?? null,
        esi_number: body.esi_number ?? null,
        aadhaar_last4: body.aadhaar_number ? body.aadhaar_number.slice(-4) : null,
      });
    }

    await audit({
      action: "EMPLOYEE_CREATE",
      entityType: "employees",
      entityId: data.id,
      newValues: { 
        first_name: body.first_name, 
        last_name: body.last_name, 
        official_email: body.official_email,
        employee_code: data.employee_code,
        display_name: data.display_name,
      },
    });

    return jsonOk(data, requestId, 201);
  },
});