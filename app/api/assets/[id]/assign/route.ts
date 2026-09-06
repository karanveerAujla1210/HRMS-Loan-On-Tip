import "server-only";
import { withApi, jsonOk } from "@/lib/server/http";
import { z } from "zod";
import { adminClient } from "@/lib/server/supabase";
import { ApiError, mapDatabaseError, notFound as notFoundError } from "@/lib/server/errors";

type RouteParams = { id: string };

const AssignSchema = z
  .object({
    employee_id: z.string().uuid(),
    expected_return_date: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/)
      .nullable()
      .optional(),
    condition_at_handover: z.enum(["NEW", "GOOD", "FAIR", "POOR", "DAMAGED"]).default("GOOD"),
    remarks: z.string().max(2000).nullable().optional(),
    idempotency_key: z.string().min(8).max(200).optional(),
  })
  .strict();

export const POST = withApi<typeof AssignSchema, z.ZodTypeAny, RouteParams>({
  permission: "asset.assign",
  body: AssignSchema,
  idempotencyEndpoint: "asset/assign",
  idempotencyKey: (body) => body.idempotency_key,
  rateLimit: { limit: 30, windowMs: 60_000 },
  handler: async ({ ctx, body, params, audit, requestId }) => {
    const companyId = ctx.companyId!;
    const assetId = params.id;
    const db = adminClient();

    // ── Verify the asset exists, belongs to the company and is AVAILABLE ──
    const { data: asset, error: assetErr } = await db
      .from("assets")
      .select("id, asset_code, status, company_id, current_employee_id")
      .eq("id", assetId)
      .eq("company_id", companyId)
      .maybeSingle();
    if (assetErr) throw mapDatabaseError(assetErr);
    if (!asset) throw notFoundError("Asset not found");
    if (asset.status !== "AVAILABLE") {
      throw new ApiError(
        "ASSET_NOT_AVAILABLE",
        `This asset is currently ${asset.status}, not available for assignment.`
      );
    }

    // ── Verify the target employee belongs to the same company ───────────
    const { data: emp, error: empErr } = await db
      .from("employees")
      .select("id, company_id")
      .eq("id", body.employee_id)
      .eq("company_id", companyId)
      .maybeSingle();
    if (empErr) throw mapDatabaseError(empErr);
    if (!emp) throw notFoundError("Employee not found");

    // ── Guard against a race: re-check availability immediately before the
    //    write. The partial unique index on active assignments provides the
    //    final database-level guarantee against double assignment. ─────────
    const { data: activeAsg } = await db
      .from("asset_assignments")
      .select("id")
      .eq("asset_id", assetId)
      .eq("status", "ACTIVE")
      .maybeSingle();
    if (activeAsg) {
      throw new ApiError("ASSET_NOT_AVAILABLE", "This asset was just assigned to another employee.");
    }

    const { data: assignment, error: asgErr } = await db
      .from("asset_assignments")
      .insert({
        asset_id: assetId,
        employee_id: body.employee_id,
        assigned_by: ctx.employeeId,
        expected_return_date: body.expected_return_date ?? null,
        remarks: body.remarks ?? null,
        status: "ACTIVE",
      })
      .select("id")
      .single();
    if (asgErr) throw mapDatabaseError(asgErr);

    const { error: handErr } = await db.from("asset_handover").insert({
      asset_assignment_id: (assignment as { id: string }).id,
      handover_date: new Date().toISOString().slice(0, 10),
      condition_at_handover: body.condition_at_handover,
      remarks: body.remarks ?? null,
    });
    if (handErr) throw mapDatabaseError(handErr);

    const { error: updErr } = await db
      .from("assets")
      .update({
        current_employee_id: body.employee_id,
        status: "ASSIGNED",
        updated_at: new Date().toISOString(),
      })
      .eq("id", assetId)
      .eq("status", "AVAILABLE"); // conditional update: fails if state changed concurrently
    if (updErr) throw mapDatabaseError(updErr);

    await audit({
      action: "ASSET_ASSIGN",
      entityType: "assets",
      entityId: assetId,
      newValues: { employee_id: body.employee_id, condition: body.condition_at_handover },
    });

    return jsonOk({ id: assetId, status: "ASSIGNED" }, requestId, 201);
  },
});