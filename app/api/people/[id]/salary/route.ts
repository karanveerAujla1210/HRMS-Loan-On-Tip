import "server-only";
import { withApi, jsonOk } from "@/lib/server/http";
import { z } from "zod";
import { adminClient } from "@/lib/server/supabase";
import { mapDatabaseError, notFound as notFoundError } from "@/lib/server/errors";

type RouteParams = { id: string };

const SalaryAssignSchema = z
  .object({
    annual_ctc: z.number().positive().max(1_000_000_000),
    salary_structure_id: z.string().uuid().nullable().optional(),
    effective_from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
    reason: z.string().max(2000).nullable().optional(),
    idempotency_key: z.string().min(8).max(200).optional(),
  })
  .strict();

export const POST = withApi<typeof SalaryAssignSchema, z.ZodTypeAny, RouteParams>({
  permission: "employee.salary.manage",
  body: SalaryAssignSchema,
  idempotencyEndpoint: "people/salary/assign",
  idempotencyKey: (body) => body.idempotency_key,
  rateLimit: { limit: 20, windowMs: 60_000 },
  handler: async ({ ctx, body, params, audit, requestId }) => {
    const companyId = ctx.companyId!;
    const db = adminClient();

    const { data: emp, error: empErr } = await db
      .from("employees")
      .select("id, company_id")
      .eq("id", params.id)
      .eq("company_id", companyId)
      .maybeSingle();
    if (empErr) throw mapDatabaseError(empErr);
    if (!emp) throw notFoundError("Employee not found");

    const effective_from = body.effective_from ?? new Date().toISOString().slice(0, 10);

    // Capture the previous CTC for the history record before demoting it.
    const { data: prev } = await db
      .from("employee_salary_assignments")
      .select("annual_ctc")
      .eq("employee_id", params.id)
      .eq("is_current", true)
      .maybeSingle();

    const { error: updErr } = await db
      .from("employee_salary_assignments")
      .update({ is_current: false, effective_to: effective_from, updated_at: new Date().toISOString() })
      .eq("employee_id", params.id)
      .eq("is_current", true);
    if (updErr) throw mapDatabaseError(updErr);

    const { data, error } = await db
      .from("employee_salary_assignments")
      .insert({
        employee_id: params.id,
        salary_structure_id: body.salary_structure_id ?? null,
        annual_ctc: body.annual_ctc,
        effective_from,
        is_current: true,
        approved_by: ctx.employeeId,
      })
      .select("id, annual_ctc, monthly_ctc, effective_from")
      .single();
    if (error) throw mapDatabaseError(error);

    const { error: histErr } = await db.from("employee_salary_history").insert({
      employee_id: params.id,
      previous_ctc: prev ? Number((prev as { annual_ctc: number }).annual_ctc) : 0,
      new_ctc: body.annual_ctc,
      new_structure_id: body.salary_structure_id ?? null,
      effective_date: effective_from,
      reason: body.reason ?? null,
      approved_by: ctx.employeeId,
    });
    if (histErr) throw mapDatabaseError(histErr);

    await audit({
      action: "SALARY_ASSIGN",
      entityType: "employee_salary_assignments",
      entityId: (data as { id: string }).id,
      oldValues: { annual_ctc: prev ? Number((prev as { annual_ctc: number }).annual_ctc) : null },
      newValues: { annual_ctc: body.annual_ctc, effective_from },
    });

    return jsonOk(data, requestId, 201);
  },
});