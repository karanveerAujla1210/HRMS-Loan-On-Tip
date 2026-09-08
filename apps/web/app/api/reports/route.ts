import "server-only";
import { withApi, jsonOk, csvResponse } from "@/lib/server/http";
import { ReportQuerySchema } from "@hrms/api-contract";
import { mapDatabaseError } from "@/lib/server/errors";
import { toCsv } from "@/lib/csv";
import { adminClient } from "@/lib/server/supabase";

const REPORT_TABLES: Record<string, string> = {
  employee: "v_employee_directory",
  attendance: "attendance",
  late: "attendance",
  absence: "attendance",
  leave: "leave_requests",
  payroll: "payroll_runs",
  payslip: "payslips",
  "asset-inventory": "assets",
  "asset-assignment": "asset_assignments",
  "asset-repair": "asset_maintenance",
  "asset-return": "asset_returns",
  department: "departments",
  location: "locations",
  audit: "audit_logs",
};

export const GET = withApi({
  permission: "reports.view",
  query: ReportQuerySchema,
  handler: async ({ ctx, query, requestId }) => {
    const companyId = ctx.companyId!;
    const db = adminClient();

    const table = REPORT_TABLES[query.kind];
    if (!table) {
      return jsonOk({ error: "INVALID_KIND", message: `Unsupported report kind: ${query.kind}` }, requestId, 400);
    }

    const page = query.page ?? 1;
    const pageSize = Math.min(query.pageSize ?? 500, 1000);
    const from = (page - 1) * pageSize;
    const to = from + pageSize - 1;

    let q = db.from(table).select("*", { count: "exact" }).eq("company_id", companyId).range(from, to);

    if (query.from && query.kind === "attendance") q = q.gte("attendance_date", query.from);
    if (query.to && query.kind === "attendance") q = q.lte("attendance_date", query.to);
    if (query.status && query.kind !== "audit") q = q.eq("status", query.status);
    if (query.employeeId && query.kind === "attendance") q = q.eq("employee_id", query.employeeId);

    const { data, error, count } = await q;
    if (error) throw mapDatabaseError(error);

    const rows = (data ?? []) as Record<string, unknown>[];

    if (query.format === "csv") {
      const headers = rows.length > 0 ? Object.keys(rows[0] ?? {}) : [];
      const csv = toCsv(headers, rows);
      return csvResponse(`${query.kind}-report-${new Date().toISOString().slice(0, 10)}.csv`, csv, requestId);
    }

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