import "server-only";
import { withApi, jsonOk } from "@/lib/server/http";
import { SessionResponseSchema } from "@hrms/api-contract";

export const GET = withApi({
  handler: async ({ ctx, requestId }) => {
    const session = SessionResponseSchema.parse({
      authUserId: ctx.authUserId,
      email: ctx.email,
      profileId: ctx.profileId,
      employeeId: ctx.employeeId,
      employeeCode: ctx.employeeCode,
      displayName: ctx.displayName,
      companyId: ctx.companyId,
      companyName: ctx.companyName,
      locationId: ctx.locationId,
      timezone: ctx.timezone,
      roles: ctx.roles,
      primaryRole: ctx.primaryRole,
      permissions: ctx.permissions,
      serverTime: new Date().toISOString(),
    });
    return jsonOk(session, requestId);
  },
});