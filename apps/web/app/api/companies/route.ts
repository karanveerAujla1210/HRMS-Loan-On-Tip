import "server-only";
import { withApi, jsonOk } from "@/lib/server/http";
import { adminClient } from "@/lib/server/supabase";
import { isSuperAdmin } from "@/lib/server/auth";

export const GET = withApi({
  permission: "organisation.manage",
  handler: async ({ ctx, requestId }) => {
    if (!isSuperAdmin(ctx)) {
      return jsonOk([], requestId);
    }

    const db = adminClient();
    const { data, error } = await db
      .from("companies")
      .select("id,company_code,display_name,legal_name,is_active,timezone,currency")
      .order("display_name");

    if (error) {
      throw error;
    }

    return jsonOk(data ?? [], requestId);
  },
});