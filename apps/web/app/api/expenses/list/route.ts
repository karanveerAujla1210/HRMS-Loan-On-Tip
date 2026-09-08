import "server-only";
import { withApi, jsonOk } from "@/lib/server/http";
import { z } from "zod";
import { mapDatabaseError } from "@/lib/server/errors";
import { adminClient } from "@/lib/server/supabase";

const ExpenseListQuerySchema = z.object({
  page: z.coerce.number().int().min(1).optional().default(1),
  pageSize: z.coerce.number().int().min(1).max(100).optional().default(50),
  status: z.string().optional().nullable(),
  from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  employeeId: z.string().uuid().optional().nullable(),
  scope: z.enum(["self", "company"]).optional().default("self"),
});

export const GET = withApi({
  permission: "expense.view",
  query: ExpenseListQuerySchema,
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
      .from("expenses")
      .select("*, employees(display_name, employee_code)", { count: "exact" })
      .eq("company_id", companyId)
      .order("submitted_at", { ascending: false })
      .range(from, to);

    if (employeeId) q = q.eq("employee_id", employeeId);
    if (query.status) q = q.eq("status", query.status);
    if (query.from) q = q.gte("expense_date", query.from);
    if (query.to) q = q.lte("expense_date", query.to);

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