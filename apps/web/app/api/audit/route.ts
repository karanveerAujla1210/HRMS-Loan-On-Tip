import "server-only";
import { withApi, jsonOk } from "@/lib/server/http";
import { z } from "zod";
import { mapDatabaseError } from "@/lib/server/errors";
import { adminClient } from "@/lib/server/supabase";

const AuditListQuerySchema = z.object({
  page: z.coerce.number().int().min(1).optional().default(1),
  pageSize: z.coerce.number().int().min(1).max(100).optional().default(50),
  action: z.string().optional().nullable(),
  entityType: z.string().optional().nullable(),
  entityId: z.string().uuid().optional().nullable(),
  actorEmployeeId: z.string().uuid().optional().nullable(),
  from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
});

export const GET = withApi({
  permission: "audit.view",
  query: AuditListQuerySchema,
  handler: async ({ ctx, query, requestId }) => {
    const companyId = ctx.companyId!;
    const db = adminClient();

    const page = query.page ?? 1;
    const pageSize = Math.min(query.pageSize ?? 50, 100);
    const from = (page - 1) * pageSize;
    const to = from + pageSize - 1;

    let q = db
      .from("audit_logs")
      .select("*, employees(display_name, employee_code)", { count: "exact" })
      .eq("company_id", companyId)
      .order("created_at", { ascending: false })
      .range(from, to);

    if (query.action) q = q.eq("action", query.action);
    if (query.entityType) q = q.eq("entity_type", query.entityType);
    if (query.entityId) q = q.eq("entity_id", query.entityId);
    if (query.actorEmployeeId) q = q.eq("actor_employee_id", query.actorEmployeeId);
    if (query.from) q = q.gte("created_at", `${query.from}T00:00:00Z`);
    if (query.to) q = q.lte("created_at", `${query.to}T23:59:59Z`);

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