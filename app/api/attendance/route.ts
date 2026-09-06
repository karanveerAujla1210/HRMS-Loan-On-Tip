import "server-only";
import { withApi, jsonOk } from "@/lib/server/http";
import { AttendanceListQuerySchema } from "@hrms/api-contract";
import { mapDatabaseError } from "@/lib/server/errors";
import { adminClient } from "@/lib/server/supabase";

export const GET = withApi({
  permission: "attendance.view",
  query: AttendanceListQuerySchema,
  handler: async ({ ctx, query, requestId }) => {
    const companyId = ctx.companyId!;
    const db = adminClient();

    const page = query.page ?? 1;
    const pageSize = Math.min(query.pageSize ?? 50, 100);
    const from = (page - 1) * pageSize;
    const to = from + pageSize - 1;

    const scope = query.scope ?? "company";
    let employeeIdFilter: string | null | string[] = ctx.employeeId;

    if (scope === "company") {
      employeeIdFilter = null;
    } else if (scope === "team" && ctx.employeeId) {
      const { data: reports } = await db
        .from("employees")
        .select("id")
        .eq("manager_id", ctx.employeeId);
      employeeIdFilter = reports?.map((r) => r.id) ?? [];
    } else if (scope === "self") {
      employeeIdFilter = ctx.employeeId;
    }

    let q = db
      .from("attendance")
      .select("*, employees(display_name, employee_code)", { count: "exact" })
      .order("attendance_date", { ascending: false })
      .range(from, to);

    if (scope === "company") {
      q = q.eq("company_id", companyId);
    } else if (Array.isArray(employeeIdFilter)) {
      q = q.in("employee_id", employeeIdFilter);
    } else if (employeeIdFilter) {
      q = q.eq("employee_id", employeeIdFilter);
    }

    if (query.from) q = q.gte("attendance_date", query.from);
    if (query.to) q = q.lte("attendance_date", query.to);
    if (query.status) q = q.eq("status", query.status);
    if (query.employeeId && scope === "company") q = q.eq("employee_id", query.employeeId);
    if (query.departmentId) q = q.eq("employees.department_id", query.departmentId);
    if (query.locationId) q = q.eq("employees.location_id", query.locationId);

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