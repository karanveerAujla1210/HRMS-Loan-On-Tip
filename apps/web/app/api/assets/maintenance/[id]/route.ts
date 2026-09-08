import "server-only";
import { withApi, jsonOk } from "@/lib/server/http";
import { z } from "zod";
import { adminClient } from "@/lib/server/supabase";
import { mapDatabaseError, notFound as notFoundError } from "@/lib/server/errors";

type RouteParams = { id: string };

const MaintenanceCompleteSchema = z
  .object({
    cost: z.number().min(0).nullable().optional(),
    completed_at: z.string().min(1).optional(),
    description: z.string().max(2000).optional(),
    condition: z.enum(["NEW", "EXCELLENT", "GOOD", "FAIR", "POOR"]).optional(),
  })
  .strict();

export const PATCH = withApi<typeof MaintenanceCompleteSchema, z.ZodTypeAny, RouteParams>({
  permission: "asset.repair",
  body: MaintenanceCompleteSchema,
  rateLimit: { limit: 30, windowMs: 60_000 },
  handler: async ({ ctx, body, params, audit, requestId }) => {
    const companyId = ctx.companyId!;
    const db = adminClient();

    // Verify the maintenance record belongs to an asset in this company.
    const { data: record, error: recErr } = await db
      .from("asset_maintenance")
      .select("id, asset_id, status, description, assets!inner(company_id, status)")
      .eq("id", params.id)
      .maybeSingle<{ id: string; asset_id: string; status: string; description: string | null; assets: { company_id: string; status: string } }>();
    if (recErr) throw mapDatabaseError(recErr);
    if (!record || record.assets.company_id !== companyId) throw notFoundError("Maintenance record not found");

    const completedAt = body.completed_at
      ? new Date(body.completed_at).toISOString()
      : new Date().toISOString();

    const resolution = body.description
      ? [record.description, body.description].filter(Boolean).join(" — ")
      : record.description;

    const { error: updErr } = await db
      .from("asset_maintenance")
      .update({
        status: "COMPLETED",
        completed_at: completedAt,
        cost: body.cost ?? undefined,
        description: resolution,
      })
      .eq("id", params.id);
    if (updErr) throw mapDatabaseError(updErr);

    // Return the asset to stock unless it is actively assigned to an employee.
    const assetStatus = record.assets.status;
    if (assetStatus === "UNDER_REPAIR") {
      const { error: assetErr } = await db
        .from("assets")
        .update({
          status: "AVAILABLE",
          condition: body.condition ?? undefined,
          updated_at: new Date().toISOString(),
        })
        .eq("id", record.asset_id);
      if (assetErr) throw mapDatabaseError(assetErr);
    } else if (body.condition) {
      const { error: assetErr } = await db
        .from("assets")
        .update({ condition: body.condition, updated_at: new Date().toISOString() })
        .eq("id", record.asset_id);
      if (assetErr) throw mapDatabaseError(assetErr);
    }

    await audit({
      action: "ASSET_MAINTENANCE_COMPLETE",
      entityType: "assets",
      entityId: record.asset_id,
      newValues: { maintenance_id: params.id, cost: body.cost ?? null, condition: body.condition ?? null },
    });

    return jsonOk({ id: params.id, status: "COMPLETED" }, requestId);
  },
});