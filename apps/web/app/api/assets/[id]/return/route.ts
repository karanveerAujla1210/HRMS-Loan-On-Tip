import "server-only";
import { withApi, jsonOk } from "@/lib/server/http";
import { z } from "zod";
import { adminClient } from "@/lib/server/supabase";
import { ApiError, mapDatabaseError, notFound as notFoundError } from "@/lib/server/errors";

type RouteParams = { id: string };

const ReturnSchema = z
  .object({
    condition: z.enum(["NEW", "GOOD", "FAIR", "POOR", "DAMAGED"]).default("GOOD"),
    damage_description: z.string().max(2000).nullable().optional(),
    missing_items: z.string().max(2000).nullable().optional(),
    recovery_amount: z.number().min(0).nullable().optional(),
    remarks: z.string().max(2000).nullable().optional(),
    idempotency_key: z.string().min(8).max(200).optional(),
  })
  .strict();

export const POST = withApi<typeof ReturnSchema, z.ZodTypeAny, RouteParams>({
  permission: "asset.return",
  body: ReturnSchema,
  idempotencyEndpoint: "asset/return",
  idempotencyKey: (body) => body.idempotency_key,
  rateLimit: { limit: 30, windowMs: 60_000 },
  handler: async ({ ctx, body, params, audit, requestId }) => {
    const companyId = ctx.companyId!;
    const assetId = params.id;
    const db = adminClient();

    // ── Verify the asset exists, belongs to the company and is ASSIGNED ──
    const { data: asset, error: assetErr } = await db
      .from("assets")
      .select("id, asset_code, status, company_id, current_employee_id")
      .eq("id", assetId)
      .eq("company_id", companyId)
      .maybeSingle();
    if (assetErr) throw mapDatabaseError(assetErr);
    if (!asset) throw notFoundError("Asset not found");
    if (asset.status !== "ASSIGNED") {
      throw new ApiError("ASSET_NOT_ASSIGNED", `This asset is currently ${asset.status}, not assigned.`);
    }

    // ── Locate the active assignment ─────────────────────────────────────
    const { data: assignment, error: asgErr } = await db
      .from("asset_assignments")
      .select("id, employee_id")
      .eq("asset_id", assetId)
      .eq("status", "ACTIVE")
      .maybeSingle();
    if (asgErr) throw mapDatabaseError(asgErr);
    if (!assignment) {
      throw new ApiError("ASSET_NOT_ASSIGNED", "This asset has no active assignment to return.");
    }

    const today = new Date().toISOString().slice(0, 10);
    const now = new Date().toISOString();

    const { error: retErr } = await db.from("asset_returns").insert({
      asset_assignment_id: (assignment as { id: string }).id,
      return_date: today,
      received_by: ctx.employeeId,
      condition_at_return: body.condition,
      damage_description: body.damage_description ?? null,
      missing_items: body.missing_items ?? null,
      recovery_amount: body.recovery_amount ?? null,
      remarks: body.remarks ?? null,
    });
    if (retErr) throw mapDatabaseError(retErr);

    const { error: asgUpd } = await db
      .from("asset_assignments")
      .update({ status: "RETURNED", returned_at: now, updated_at: now })
      .eq("id", (assignment as { id: string }).id)
      .eq("status", "ACTIVE");
    if (asgUpd) throw mapDatabaseError(asgUpd);

    const newStatus = body.condition === "DAMAGED" ? "DAMAGED" : "AVAILABLE";
    const { error: assetUpd } = await db
      .from("assets")
      .update({ current_employee_id: null, status: newStatus, updated_at: now })
      .eq("id", assetId)
      .eq("status", "ASSIGNED"); // conditional update: fails if state changed concurrently
    if (assetUpd) throw mapDatabaseError(assetUpd);

    await audit({
      action: "ASSET_RETURN",
      entityType: "assets",
      entityId: assetId,
      oldValues: { status: "ASSIGNED", employee_id: (assignment as { employee_id: string }).employee_id },
      newValues: { condition: body.condition, status: newStatus },
    });

    return jsonOk({ id: assetId, status: newStatus }, requestId);
  },
});