import "server-only";
import { withApi, jsonOk } from "@/lib/server/http";
import { DashboardMetricsSchema, IsoDateSchema } from "@hrms/api-contract";
import { mapDatabaseError } from "@/lib/server/errors";
import { adminClient } from "@/lib/server/supabase";
import { zonedParts } from "@hrms/domain";
import { z } from "zod";

const QuerySchema = z.object({
  as_of: IsoDateSchema.optional(),
});

export const GET = withApi({
  query: QuerySchema,
  handler: async ({ ctx, query, requestId }) => {
    const companyId = ctx.companyId!;
    const db = adminClient();
    const asOf = query.as_of ?? zonedParts(new Date(), ctx.timezone).date;

    const { data, error } = await db.rpc("get_dashboard_metrics", {
      p_company_id: companyId,
      p_as_of_date: asOf,
    });
    if (error) throw mapDatabaseError(error);

    const parsed = DashboardMetricsSchema.safeParse(data);
    if (!parsed.success) {
      // Fall back to a permissive shape when the DB view has not been migrated.
      return jsonOk(data ?? null, requestId);
    }
    return jsonOk(parsed.data, requestId);
  },
});