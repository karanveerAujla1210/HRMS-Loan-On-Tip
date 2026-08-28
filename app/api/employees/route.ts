import "server-only";
import { withApi, jsonOk } from "@/lib/server/http";
import { z } from "zod";
import { EmployeeCreateSchema, EmployeeListQuerySchema } from "@hrms/api-contract";
import { adminClient } from "@/lib/server/supabase";
import { writeAudit } from "@/lib/audit";

export const GET = withApi({
  permission: "employee.read",
  query: EmployeeListQuerySchema,
  handler: async ({ req, ctx, query, requestId }) => {
    const companyId = ctx.companyId!;
    const db = adminClient();

    const page = query.page ?? 1;
    const pageSize = Math.min(query.page_size ?? 50, 100);
    const from = (page - 1) * pageSize;
    const to = from + pageSize - 1;

    let q = db
      .from("v_employee_directory")
      .select("*", { count: "exact" })
      .eq("company_id", companyId)
      .order("display_name")
      .range(from, to);

    if (query.search) {
      q = q.or(`display_name.ilike.%${query.search}%,employee_code.ilike.%${query.search}%,official_email.ilike.%${query.search}%,department.ilike.%${query.search}%,designation.ilike.%${query.search}%`);
    }
    if (query.departmentId) q = q.eq("department_id", query.departmentId);
    if (query.designationId) q = q.eq("designation_id", query.designationId);
    if (query.locationId) q = q.eq("location_id", query.locationId);
    if (query.managerId) q = q.eq("manager_id", query.managerId);
    if (query.status) q = q.eq("employment_status", query.status);

    const { data, error, count } = await q;
    if (error) throw error;

    return jsonOk(
      {
        data: data ?? [],
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
  handler: async ({ req, ctx, body, audit, requestId }) => {
    const companyId = ctx.companyId!;
    const db = adminClient();

    const { data, error } = await db
      .from("employees")
      .insert({
        company_id: companyId,
        first_name: body.first_name,
        middle_name: body.middle_name,
        last_name: body.last_name,
        gender: body.gender,
        date_of_birth: body.date_of_birth,
        blood_group: body.blood_group,
        joining_date: body.joining_date,
        confirmation_date: body.confirmation_date,
        probation_end_date: body.probation_end_date,
        notice_period_days: body.notice_period_days,
        official_email: body.official_email,
        personal_email: body.personal_email,
        official_mobile: body.official_mobile,
        personal_mobile: body.personal_mobile,
        nationality: body.nationality,
        marital_status: body.marital_status,
        employment_status: body.employment_status ?? "ACTIVE",
        department_id: body.department_id,
        designation_id: body.designation_id,
        location_id: body.location_id,
        employment_type_id: body.employment_type_id,
        team_id: body.team_id,
        manager_id: body.manager_id,
        hr_manager_id: body.hr_manager_id,
        shift_id: body.shift_id,
        emergency_contact_name: body.emergency_contact_name,
        emergency_contact_relationship: body.emergency_contact_relationship,
        emergency_contact_mobile: body.emergency_contact_mobile,
        bank_name: body.bank_name,
        account_number: body.account_number,
        ifsc_code: body.ifsc_code,
        pan_number: body.pan_number,
        aadhaar_number: body.aadhaar_number,
        uan: body.uan,
        pf_number: body.pf_number,
        esi_number: body.esi_number,
      })
      .select("id, employee_code, display_name")
      .single();

    if (error) throw error;

    await audit({
      action: "EMPLOYEE_CREATE",
      entity_type: "employees",
      entity_id: data.id,
      new_values: { 
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