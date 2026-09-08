import "server-only";
import { withApi, jsonOk } from "@/lib/server/http";
import { z } from "zod";
import { adminClient } from "@/lib/server/supabase";
import { mapDatabaseError, notFound as notFoundError } from "@/lib/server/errors";

type RouteParams = { id: string };

const RepairSchema = z
  .object({
    maintenance_type: z.string().trim().min(1).max(200).default("Hardware Repair"),
    description: z.string().trim().min(1).max(2000),
    vendor: z.string().max(200).nullable().optional(),
    cost: z.number().min(0).nullable().optional(),
    idempotency_key: z.string().min(8).max(200).optional(),
  })
  .strict();

export const POST = withApi<typeof RepairSchema, z.ZodTypeAny, RouteParams>({
  permission: "asset.repair",
  body: RepairSchema,
  idempotencyEndpoint: "asset/repair",
  idempotencyKey: (body) => body.idempotency_key,
  rateLimit: { limit: 30, windowMs: 60_000 },
  handler: async ({ ctx, body, params, audit, requestId }) => {
    const companyId = ctx.companyId!;
    const assetId = params.id;
    const db = adminClient();

    const { data: asset, error: assetErr } = await db
      .from("assets")
      .select("id, asset_code, company_id, status")
      .eq("id", assetId)
      .eq("company_id", companyId)
      .maybeSingle();
    if (assetErr) throw mapDatabaseError(assetErr);
    if (!asset) throw notFoundError("Asset not found");

    const { data, error } = await db
      .from("asset_maintenance")
      .insert({
        asset_id: assetId,
        maintenance_type: body.maintenance_type,
        vendor: body.vendor ?? null,
        cost: body.cost ?? null,
        description: body.description,
        status: "OPEN",
        started_at: new Date().toISOString(),
        created_by: ctx.employeeId,
      })
      .select("id")
      .single();
    if (error) throw mapDatabaseError(error);

    // Mark the asset as under repair unless it is currently assigned to someone.
    const currentStatus = (asset as { status: string }).status;
    let statusAfter = currentStatus;
    if (currentStatus === "AVAILABLE" || currentStatus === "DAMAGED") {
      const { error: updErr } = await db
        .from("assets")
        .update({ status: "UNDER_REPAIR", updated_at: new Date().toISOString() })
        .eq("id", assetId)
        .in("status", ["AVAILABLE", "DAMAGED"]); // conditional update
      if (updErr) throw mapDatabaseError(updErr);
      statusAfter = "UNDER_REPAIR";
    }

    await audit({
      action: "ASSET_MAINTENANCE",
      entityType: "assets",
      entityId: assetId,
      newValues: { maintenance_type: body.maintenance_type, vendor: body.vendor ?? null, status: statusAfter },
    });

    return jsonOk(
      { id: assetId, maintenance_id: (data as { id: string }).id, status: statusAfter },
      requestId,
      201
    );
  },
});