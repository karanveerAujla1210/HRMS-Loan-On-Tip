import "server-only";
import { withApi, jsonOk } from "@/lib/server/http";
import { z } from "zod";
import { adminClient } from "@/lib/server/supabase";
import { ApiError, mapDatabaseError, notFound as notFoundError } from "@/lib/server/errors";

type RouteParams = { id: string };

const nullableString = z.string().trim().min(1).nullable();
const nullableDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable();
const nullableUuid = z.string().uuid().nullable();

const EmployeePatchSchema = z
  .object({
    first_name: nullableString.optional(),
    middle_name: nullableString.optional(),
    last_name: nullableString.optional(),
    gender: z.enum(["MALE", "FEMALE", "OTHER", "PREFER_NOT_TO_SAY"]).nullable().optional(),
    date_of_birth: nullableDate.optional(),
    blood_group: z
      .enum(["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-"])
      .nullable()
      .optional(),
    official_email: z.string().trim().email().nullable().optional(),
    personal_email: z.string().trim().email().nullable().optional(),
    official_mobile: nullableString.optional(),
    personal_mobile: nullableString.optional(),
    joining_date: nullableDate.optional(),
    confirmation_date: nullableDate.optional(),
    employment_type_id: nullableUuid.optional(),
    department_id: nullableUuid.optional(),
    designation_id: nullableUuid.optional(),
    team_id: nullableUuid.optional(),
    location_id: nullableUuid.optional(),
    manager_id: nullableUuid.optional(),
    hr_manager_id: nullableUuid.optional(),
    employment_status: z
      .enum([
        "ACTIVE",
        "PROBATION",
        "ON_NOTICE",
        "ON_LEAVE",
        "INACTIVE",
        "EXITED",
        "TERMINATED",
        "SUSPENDED",
      ])
      .optional(),
    probation_end_date: nullableDate.optional(),
    notice_period_days: z.number().int().min(0).max(365).nullable().optional(),
    last_working_date: nullableDate.optional(),
    nationality: nullableString.optional(),
    marital_status: z.enum(["SINGLE", "MARRIED", "DIVORCED", "WIDOWED"]).nullable().optional(),
  })
  .strict();

async function loadEmployee(companyId: string, id: string) {
  const db = adminClient();
  const { data, error } = await db
    .from("employees")
    .select("*")
    .eq("id", id)
    .eq("company_id", companyId)
    .maybeSingle();
  if (error) throw mapDatabaseError(error);
  if (!data) throw notFoundError("Employee not found");
  return data;
}

export const GET = withApi<z.ZodTypeAny, z.ZodTypeAny, RouteParams>({
  permission: "employee.view",
  rateLimit: { limit: 120, windowMs: 60_000 },
  handler: async ({ ctx, params, requestId }) => {
    const data = await loadEmployee(ctx.companyId!, params.id);
    return jsonOk(data, requestId);
  },
});

export const PATCH = withApi<typeof EmployeePatchSchema, z.ZodTypeAny, RouteParams>({
  permission: "employee.update",
  body: EmployeePatchSchema,
  rateLimit: { limit: 30, windowMs: 60_000 },
  handler: async ({ ctx, body, params, audit, requestId }) => {
    const companyId = ctx.companyId!;
    const existing = await loadEmployee(companyId, params.id);

    // Guard against circular reporting chains: an employee can never be made
    // their own manager.
    if (body.manager_id && body.manager_id === params.id) {
      throw new ApiError("EMPLOYEE_MANAGER_CYCLE", "An employee cannot report to themselves.");
    }

    const db = adminClient();
    const update: Record<string, unknown> = {
      ...(body as Record<string, unknown>),
      updated_at: new Date().toISOString(),
    };

    const { data, error } = await db
      .from("employees")
      .update(update)
      .eq("id", params.id)
      .eq("company_id", companyId)
      .select("id, employee_code, display_name")
      .single();
    if (error) throw mapDatabaseError(error);

    await audit({
      action: "EMPLOYEE_UPDATE",
      entityType: "employees",
      entityId: params.id,
      oldValues: { employment_status: (existing as { employment_status?: string }).employment_status ?? null },
      newValues: update,
    });

    return jsonOk(data, requestId);
  },
});

export const DELETE = withApi<z.ZodTypeAny, z.ZodTypeAny, RouteParams>({
  permission: "employee.offboard",
  rateLimit: { limit: 10, windowMs: 60_000 },
  handler: async ({ ctx, params, audit, requestId }) => {
    const companyId = ctx.companyId!;
    const existing = await loadEmployee(companyId, params.id);

    const db = adminClient();
    const { data, error } = await db
      .from("employees")
      .update({
        employment_status: "TERMINATED",
        last_working_date: new Date().toISOString().slice(0, 10),
        updated_at: new Date().toISOString(),
      })
      .eq("id", params.id)
      .eq("company_id", companyId)
      .select("id, employee_code")
      .single();
    if (error) throw mapDatabaseError(error);

    await audit({
      action: "EMPLOYEE_OFFBOARD",
      entityType: "employees",
      entityId: params.id,
      oldValues: { employment_status: (existing as { employment_status?: string }).employment_status ?? null },
      newValues: { employment_status: "TERMINATED" },
    });

    return jsonOk(data, requestId);
  },
});