import "server-only";
import { withApi, jsonOk } from "@/lib/server/http";
import { z } from "zod";
import { adminClient } from "@/lib/server/supabase";
import { ApiError, mapDatabaseError } from "@/lib/server/errors";

const RunCreateSchema = z
  .object({
    payroll_month: z.number().int().min(1).max(12),
    payroll_year: z.number().int().min(2000).max(2100),
  })
  .strict();

const RunListQuery = z
  .object({
    payroll_month: z.coerce.number().int().min(1).max(12).optional(),
    payroll_year: z.coerce.number().int().min(2000).max(2100).optional(),
  })
  .strict();

function pad(n: number): string {
  return String(n).padStart(2, "0");
}
function lastDayOfMonth(year: number, month: number): string {
  const d = new Date(year, month, 0);
  return `${year}-${pad(month)}-${pad(d.getDate())}`;
}

export const POST = withApi<typeof RunCreateSchema>({
  permission: "payroll.create",
  body: RunCreateSchema,
  rateLimit: { limit: 20, windowMs: 60_000 },
  handler: async ({ ctx, body, requestId }) => {
    const companyId = ctx.companyId!;
    const db = adminClient();

    const period_start = `${body.payroll_year}-${pad(body.payroll_month)}-01`;
    const period_end = lastDayOfMonth(body.payroll_year, body.payroll_month);

    // Prevent duplicate payroll runs for the same period.
    const { data: existing } = await db
      .from("payroll_runs")
      .select("id")
      .eq("company_id", companyId)
      .eq("payroll_month", body.payroll_month)
      .eq("payroll_year", body.payroll_year)
      .maybeSingle();
    if (existing) {
      throw new ApiError("CONFLICT", "A payroll run already exists for this period.");
    }

    const { data, error } = await db
      .from("payroll_runs")
      .insert({
        company_id: companyId,
        payroll_month: body.payroll_month,
        payroll_year: body.payroll_year,
        period_start,
        period_end,
        status: "DRAFT",
        created_by: ctx.employeeId,
      })
      .select("id, status, payroll_month, payroll_year")
      .single();
    if (error) throw mapDatabaseError(error);

    return jsonOk(data, requestId, 201);
  },
});

export const GET = withApi<z.ZodTypeAny, typeof RunListQuery>({
  permission: "payroll.view",
  query: RunListQuery,
  rateLimit: { limit: 120, windowMs: 60_000 },
  handler: async ({ ctx, query, requestId }) => {
    const companyId = ctx.companyId!;
    const db = adminClient();
    let q = db
      .from("payroll_runs")
      .select(
        "id,payroll_month,payroll_year,status,employee_count,gross_pay,total_deductions,net_pay,created_at"
      )
      .eq("company_id", companyId)
      .order("created_at", { ascending: false })
      .limit(50);
    if (query.payroll_month) q = q.eq("payroll_month", query.payroll_month);
    if (query.payroll_year) q = q.eq("payroll_year", query.payroll_year);
    const { data, error } = await q;
    if (error) throw mapDatabaseError(error);
    return jsonOk(data ?? [], requestId);
  },
});