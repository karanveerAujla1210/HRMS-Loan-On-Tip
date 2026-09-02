import "server-only";
import { withApi, jsonOk } from "@/lib/server/http";
import { z } from "zod";
import { adminClient } from "@/lib/server/supabase";
import { mapDatabaseError, notFound as notFoundError } from "@/lib/server/errors";

const AssetCreateSchema = z.object({
  asset_category_id: z.string().uuid(),
  model: z.string().min(1),
  brand_id: z.string().uuid().nullable().optional(),
  location_id: z.string().uuid().nullable().optional(),
  asset_tag: z.string().nullable().optional(),
  serial_number: z.string().nullable().optional(),
  imei_1: z.string().nullable().optional(),
  mobile_number: z.string().nullable().optional(),
  sim_number: z.string().nullable().optional(),
  purchase_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional(),
  purchase_cost: z.number().nullable().optional(),
  warranty_end: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional(),
  condition: z.enum(["GOOD", "FAIR", "POOR"]).default("GOOD"),
  vendor_name: z.string().nullable().optional(),
  invoice_number: z.string().nullable().optional(),
  notes: z.string().nullable().optional(),
  idempotency_key: z.string().min(8).max(200).optional(),
});

export const POST = withApi({
  permission: "asset.create",
  body: AssetCreateSchema,
  idempotencyEndpoint: "asset/create",
  idempotencyKey: (body) => body.idempotency_key,
  rateLimit: { limit: 30, windowMs: 60_000 },
  handler: async ({ ctx, body, audit, requestId }) => {
    const companyId = ctx.companyId!;
    const db = adminClient();

    const { data: category, error: catErr } = await db
      .from("asset_categories")
      .select("id, prefix")
      .eq("id", body.asset_category_id)
      .eq("company_id", companyId)
      .maybeSingle();
    if (catErr) throw mapDatabaseError(catErr);
    if (!category) throw notFoundError("Asset category not found for this company");

    const { data: codeRes, error: codeErr } = await db.rpc("next_asset_code", {
      p_prefix: (category as { prefix: string }).prefix,
    });
    if (codeErr) throw mapDatabaseError(codeErr);
    const asset_code = codeRes as string;

    const { data, error } = await db
      .from("assets")
      .insert({
        company_id: companyId,
        asset_category_id: body.asset_category_id,
        brand_id: body.brand_id ?? null,
        location_id: body.location_id ?? null,
        asset_code,
        asset_tag: body.asset_tag ?? null,
        model: body.model,
        serial_number: body.serial_number ?? null,
        imei_1: body.imei_1 ?? null,
        mobile_number: body.mobile_number ?? null,
        sim_number: body.sim_number ?? null,
        purchase_date: body.purchase_date ?? null,
        purchase_cost: body.purchase_cost ?? null,
        warranty_end: body.warranty_end ?? null,
        condition: body.condition,
        status: "AVAILABLE",
        vendor_name: body.vendor_name ?? null,
        invoice_number: body.invoice_number ?? null,
        notes: body.notes ?? null,
      })
      .select("id, asset_code, model")
      .single();
    if (error) throw mapDatabaseError(error);

    await audit({
      action: "ASSET_CREATE",
      entityType: "assets",
      entityId: (data as { id: string }).id,
      newValues: { asset_code, model: body.model, category_id: body.asset_category_id },
    });

    return jsonOk({ ...data, asset_code }, requestId, 201);
  },
});
