import "server-only";
import { withApi, jsonOk } from "@/lib/server/http";
import { LeaveBalanceQuerySchema } from "@hrms/api-contract";
import { mapDatabaseError } from "@/lib/server/errors";
import { adminClient } from "@/lib/server/supabase";

export const GET = withApi({
  permission: "leave.view",
  query: LeaveBalanceQuerySchema,
  handler: async ({ ctx, query, requestId }) => {
    const db = adminClient();
    const employeeId = query.employeeId ?? ctx.employeeId;
    if (!employeeId) {
      return jsonOk({ data: [] }, requestId);
    }

    const year = query.year ?? new Date().getFullYear();

    const { data, error } = await db
      .from("v_leave_balances")
      .select("*")
      .eq("employee_id", employeeId)
      .eq("year", year);
    if (error) throw mapDatabaseError(error);

    return jsonOk({ data: data ?? [] }, requestId);
  },
});