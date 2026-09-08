import "server-only";
import { withApi, jsonOk } from "@/lib/server/http";
import { AssetListQuerySchema } from "@hrms/api-contract";
import { mapDatabaseError } from "@/lib/server/errors";
import { adminClient } from "@/lib/server/supabase";

export const GET = withApi({
  permission: "asset.view",
  query: AssetListQuerySchema,
  handler: async ({ ctx, query, requestId }) => {
    const companyId = ctx.companyId!;
    const db = adminClient();

    const page = query.page ?? 1;
    const pageSize = Math.min(query.pageSize ?? 50, 100);
    const from = (page - 1) * pageSize;
    const to = from + pageSize - 1;

    const scope = query.scope ?? "company";
    const employeeId = scope === "self" ? ctx.employeeId : query.employeeId;

    let q = db
      .from("assets")
      .select(
        "*, asset_categories(name), asset_brands(name), employees:current_employee_id(display_name, employee_code)",
        { count: "exact" }
      )
      .eq("company_id", companyId)
      .order("created_at", { ascending: false })
      .range(from, to);

    if (employeeId) q = q.eq("current_employee_id", employeeId);
    if (query.categoryId) q = q.eq("asset_category_id", query.categoryId);
    if (query.locationId) q = q.eq("location_id", query.locationId);
    if (query.status) q = q.eq("status", query.status);
    if (query.search) {
      q = q.or(
        `model.ilike.%${query.search}%,asset_code.ilike.%${query.search}%,asset_tag.ilike.%${query.search}%,serial_number.ilike.%${query.search}%`
      );
    }

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