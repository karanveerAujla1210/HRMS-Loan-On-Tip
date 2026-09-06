import "server-only";
import { withApi, jsonOk } from "@/lib/server/http";
import { z } from "zod";
import { mapDatabaseError } from "@/lib/server/errors";
import { adminClient } from "@/lib/server/supabase";

const ExceptionListQuerySchema = z.object({
  page: z.coerce.number().int().min(1).optional().default(1),
  pageSize: z.coerce.number().int().min(1).max(100).optional().default(50),
  status: z.string().optional().nullable(),
  from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  employeeId: z.string().uuid().optional().nullable(),
});

export const GET = withApi({
  permission: "attendance.view",
  query: ExceptionListQuerySchema,
  handler: async ({ ctx, query, requestId }) => {
    const companyId = ctx.companyId!;
    const db = adminClient();

    const page = query.page ?? 1;
    const pageSize = Math.min(query.pageSize ?? 50, 100);
    const from = (page - 1) * pageSize;
    const to = from + pageSize - 1;

    let q = db
      .from("attendance_exceptions")
      .select("*, employees(display_name, employee_code)", { count: "exact" })
      .eq("company_id", companyId)
      .order("created_at", { ascending: false })
      .range(from, to);

    if (query.status) q = q.eq("status", query.status);
    if (query.employeeId) q = q.eq("employee_id", query.employeeId);
    if (query.from) q = q.gte("attendance_date", query.from);
    if (query.to) q = q.lte("attendance_date", query.to);

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