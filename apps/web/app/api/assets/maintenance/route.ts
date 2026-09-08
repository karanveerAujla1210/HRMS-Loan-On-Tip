import "server-only";
import { withApi, jsonOk } from "@/lib/server/http";
import { z } from "zod";
import { adminClient } from "@/lib/server/supabase";
import { mapDatabaseError, notFound as notFoundError } from "@/lib/server/errors";

const MaintenanceLogSchema = z
  .object({
    asset_id: z.string().uuid(),
    maintenance_type: z.string().trim().min(1).max(50),
    vendor: z.string().max(255).nullable().optional(),
    started_at: z.string().min(1).optional(),
    cost: z.number().min(0).nullable().optional(),
    description: z.string().max(2000).nullable().optional(),
    idempotency_key: z.string().min(8).max(200).optional(),
  })
  .strict();

export const POST = withApi<typeof MaintenanceLogSchema, z.ZodTypeAny, Record<string, never>>({
  permission: "asset.repair",
  body: MaintenanceLogSchema,
  idempotencyEndpoint: "asset/maintenance/log",
  idempotencyKey: (body) => body.idempotency_key,
  rateLimit: { limit: 30, windowMs: 60_000 },
  handler: async ({ ctx, body, audit, requestId }) => {
    const companyId = ctx.companyId!;
    const db = adminClient();

    const { data: asset, error: assetErr } = await db
      .from("assets")
      .select("id, asset_code, status")
      .eq("id", body.asset_id)
      .eq("company_id", companyId)
      .maybeSingle();
    if (assetErr) throw mapDatabaseError(assetErr);
    if (!asset) throw notFoundError("Asset not found");

    const startedAt = body.started_at
      ? new Date(body.started_at).toISOString()
      : new Date().toISOString();

    const { data, error } = await db
      .from("asset_maintenance")
      .insert({
        asset_id: body.asset_id,
        maintenance_type: body.maintenance_type,
        vendor: body.vendor ?? null,
        started_at: startedAt,
        cost: body.cost ?? null,
        description: body.description ?? null,
        status: "OPEN",
        created_by: ctx.employeeId,
      })
      .select("id")
      .single();
    if (error) throw mapDatabaseError(error);

    // Mark the asset as under repair (conditional update, same as repair route).
    const currentStatus = (asset as { status: string }).status;
    let statusAfter = currentStatus;
    if (currentStatus === "AVAILABLE" || currentStatus === "DAMAGED") {
      const { error: updErr } = await db
        .from("assets")
        .update({ status: "UNDER_REPAIR", updated_at: new Date().toISOString() })
        .eq("id", body.asset_id)
        .in("status", ["AVAILABLE", "DAMAGED"]);
      if (updErr) throw mapDatabaseError(updErr);
      statusAfter = "UNDER_REPAIR";
    }

    await audit({
      action: "ASSET_MAINTENANCE",
      entityType: "assets",
      entityId: body.asset_id,
      newValues: { maintenance_type: body.maintenance_type, vendor: body.vendor ?? null, status: statusAfter },
    });

    return jsonOk(
      { maintenance_id: (data as { id: string }).id, asset_status: statusAfter },
      requestId,
      201
    );
  },
});