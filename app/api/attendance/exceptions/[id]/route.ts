import "server-only";
import { withApi, jsonOk } from "@/lib/server/http";
import { z } from "zod";
import { adminClient } from "@/lib/server/supabase";
import { mapDatabaseError, notFound as notFoundError } from "@/lib/server/errors";

type RouteParams = { id: string };

const ExceptionPatchSchema = z
  .object({
    status: z.enum(["RESOLVED", "REJECTED", "OPEN", "REVIEW"]).default("RESOLVED"),
    resolution_note: z.string().max(2000).nullable().optional(),
  })
  .strict();

export const PATCH = withApi<typeof ExceptionPatchSchema, z.ZodTypeAny, RouteParams>({
  permission: "attendance.approve",
  body: ExceptionPatchSchema,
  rateLimit: { limit: 30, windowMs: 60_000 },
  handler: async ({ ctx, body, params, audit, requestId }) => {
    const companyId = ctx.companyId!;
    const db = adminClient();

    const { data: exception, error: exErr } = await db
      .from("attendance_exceptions")
      .select("id, employee_id, company_id, status")
      .eq("id", params.id)
      .eq("company_id", companyId)
      .maybeSingle();
    if (exErr) throw mapDatabaseError(exErr);
    if (!exception) throw notFoundError("Exception not found");

    const { data, error } = await db
      .from("attendance_exceptions")
      .update({
        status: body.status,
        resolution_note: body.resolution_note ?? null,
        resolved_by: ctx.employeeId,
        resolved_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq("id", params.id)
      .eq("company_id", companyId)
      .select("id, status")
      .single();
    if (error) throw mapDatabaseError(error);

    await audit({
      action: "ATTENDANCE_EXCEPTION_RESOLVE",
      entityType: "attendance_exceptions",
      entityId: params.id,
      oldValues: { status: (exception as { status: string }).status },
      newValues: { status: body.status, resolution_note: body.resolution_note ?? null },
    });

    return jsonOk(data, requestId);
  },
});