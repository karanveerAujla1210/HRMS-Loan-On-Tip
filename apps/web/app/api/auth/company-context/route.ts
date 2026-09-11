import "server-only";
import { withApi, jsonOk } from "@/lib/server/http";
import { z } from "zod";
import { isSuperAdmin } from "@/lib/server/auth";
import { adminClient } from "@/lib/server/supabase";
import { mapDatabaseError } from "@/lib/server/errors";

const SWITCHED_COMPANY_COOKIE = "lot_super_admin_company";

const SetCompanyContextSchema = z.object({
  companyId: z.string().uuid().nullable(),
});

export const POST = withApi<typeof SetCompanyContextSchema>({
  permission: "organisation.manage",
  body: SetCompanyContextSchema,
  handler: async ({ ctx, body, requestId }) => {
    if (!isSuperAdmin(ctx)) {
      return jsonOk({ success: false, error: "Not authorized" }, requestId, 403);
    }

    const { companyId } = body;

    if (companyId) {
      // Verify the company exists and is active
      const db = adminClient();
      const { data: company, error } = await db
        .from("companies")
        .select("id")
        .eq("id", companyId)
        .eq("is_active", true)
        .maybeSingle();

      if (error) throw mapDatabaseError(error);
      if (!company) {
        return jsonOk({ success: false, error: "Company not found" }, requestId, 404);
      }

      // Set cookie (expires in 30 days)
      const response = jsonOk({ success: true, companyId }, requestId);
      response.headers.set(
        "Set-Cookie",
        `${SWITCHED_COMPANY_COOKIE}=${encodeURIComponent(companyId)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${60 * 60 * 24 * 30}`
      );
      return response;
    } else {
      // Clear cookie
      const response = jsonOk({ success: true, companyId: null }, requestId);
      response.headers.set(
        "Set-Cookie",
        `${SWITCHED_COMPANY_COOKIE}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0`
      );
      return response;
    }
  },
});

export const GET = withApi({
  permission: "organisation.manage",
  handler: async ({ ctx, requestId }) => {
    if (!isSuperAdmin(ctx)) {
      return jsonOk({ companyId: null }, requestId);
    }

    return jsonOk({ companyId: ctx.companyId }, requestId);
  },
});