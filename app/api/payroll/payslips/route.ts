import "server-only";
import { withApi, jsonOk } from "@/lib/server/http";
import { PayslipListQuerySchema } from "@hrms/api-contract";
import { mapDatabaseError } from "@/lib/server/errors";
import { adminClient } from "@/lib/server/supabase";

export const GET = withApi({
  permission: "payroll.view",
  query: PayslipListQuerySchema,
  handler: async ({ ctx, query, requestId }) => {
    const companyId = ctx.companyId!;
    const db = adminClient();

    const page = query.page ?? 1;
    const pageSize = Math.min(query.pageSize ?? 50, 100);
    const from = (page - 1) * pageSize;
    const to = from + pageSize - 1;

    const scope = query.scope ?? "self";
    const employeeId = scope === "self" ? ctx.employeeId : query.employeeId;

    let q = db
      .from("payslips")
      .select("*, employees(display_name, employee_code), payroll_runs(payroll_month, payroll_year, status)", { count: "exact" })
      .eq("company_id", companyId)
      .order("generated_at", { ascending: false })
      .range(from, to);

    if (employeeId) q = q.eq("employee_id", employeeId);
    if (query.payrollRunId) q = q.eq("payroll_run_id", query.payrollRunId);
    if (query.year) q = q.eq("payroll_runs.payroll_year", query.year);

    // Employees may only see published payslips.
    if (scope === "self") q = q.not("published_at", "is", null);

    const { data, error, count } = await q;
    if (error) throw mapDatabaseError(error);

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