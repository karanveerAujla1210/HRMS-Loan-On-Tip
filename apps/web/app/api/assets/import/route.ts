import "server-only";
import { withApi, jsonOk } from "@/lib/server/http";
import { z } from "zod";
import { adminClient } from "@/lib/server/supabase";
import { mapDatabaseError, validationError } from "@/lib/server/errors";

const ImportSchema = z
  .object({
    assets: z
      .array(z.record(z.string(), z.unknown()))
      .min(1)
      .max(500),
  })
  .strict();

const CONDITION_MAP: Record<string, string> = {
  NEW: "NEW",
  EXCELLENT: "NEW",
  GOOD: "GOOD",
  FAIR: "FAIR",
  POOR: "POOR",
  DAMAGED: "DAMAGED",
};

const nullable = (v: unknown): string | null => {
  const s = typeof v === "string" ? v.trim() : "";
  return s.length > 0 ? s : null;
};

const nullableNumber = (v: unknown): number | null => {
  const s = nullable(v);
  if (s === null) return null;
  const n = Number(s.replace(/,/g, ""));
  return Number.isFinite(n) ? n : null;
};

const nullableDate = (v: unknown): string | null => {
  const s = nullable(v);
  return s !== null && /^\d{4}-\d{2}-\d{2}$/.test(s) ? s : null;
};

export const POST = withApi<typeof ImportSchema, z.ZodTypeAny, Record<string, never>>({
  permission: "asset.create",
  body: ImportSchema,
  rateLimit: { limit: 5, windowMs: 60_000 },
  handler: async ({ ctx, body, audit, requestId }) => {
    const companyId = ctx.companyId!;
    const db = adminClient();

    // Preload name → id lookups so each CSV row can be resolved quickly.
    const [catRes, brandRes, locRes] = await Promise.all([
      db.from("asset_categories").select("id,name,prefix").eq("company_id", companyId),
      db.from("asset_brands").select("id,name").eq("company_id", companyId),
      db.from("locations").select("id,name").eq("company_id", companyId),
    ]);
    if (catRes.error) throw mapDatabaseError(catRes.error);
    if (brandRes.error) throw mapDatabaseError(brandRes.error);
    if (locRes.error) throw mapDatabaseError(locRes.error);

    const toMap = (rows: { name: string }[] | null) =>
      new Map((rows ?? []).map((r) => [r.name.toLowerCase().trim(), r]));
    const categories = toMap(catRes.data as { name: string }[]);
    const brands = toMap(brandRes.data as { name: string }[]);
    const locations = toMap(locRes.data as { name: string }[]);

    let success = 0;
    let failed = 0;
    const failedRows: string[] = [];

    for (let i = 0; i < body.assets.length; i++) {
      const row = body.assets[i] as Record<string, unknown>;
      const rowNum = i + 2; // +2 accounts for the CSV header row
      const model = nullable(row.model);
      const categoryName = nullable(row.category);

      try {
        if (!categoryName || !model) {
          throw new Error(`"category" and "model" are required`);
        }
        const category = categories.get(categoryName.toLowerCase());
        if (!category) throw new Error(`category "${categoryName}" not found`);

        const brand = nullable(row.brand);
        const brandId = brand ? (brands.get(brand.toLowerCase()) as { id: string } | undefined)?.id ?? null : null;
        const location = nullable(row.location);
        const locationId = location ? (locations.get(location.toLowerCase()) as { id: string } | undefined)?.id ?? null : null;

        const { data: codeRes, error: codeErr } = await db.rpc("next_asset_code", {
          p_prefix: (category as { prefix: string }).prefix,
        });
        if (codeErr) throw mapDatabaseError(codeErr);

        const condition = CONDITION_MAP[String(row.condition ?? "").toUpperCase()] ?? "GOOD";

        const { error } = await db.from("assets").insert({
          company_id: companyId,
          asset_category_id: (category as { id: string }).id,
          brand_id: brandId,
          location_id: locationId,
          asset_code: codeRes as string,
          asset_tag: nullable(row.asset_tag),
          model,
          serial_number: nullable(row.serial_number),
          imei_1: nullable(row.imei_1),
          imei_2: nullable(row.imei_2),
          mobile_number: nullable(row.mobile_number),
          sim_number: nullable(row.sim_number),
          purchase_date: nullableDate(row.purchase_date),
          purchase_cost: nullableNumber(row.purchase_cost),
          warranty_start: nullableDate(row.warranty_start),
          warranty_end: nullableDate(row.warranty_end),
          condition,
          status: "AVAILABLE",
          vendor_name: nullable(row.vendor_name),
          invoice_number: nullable(row.invoice_number),
          notes: nullable(row.notes),
        });
        if (error) throw mapDatabaseError(error);

        success++;
      } catch (err) {
        failed++;
        const message =
          err instanceof Error && err.name === "ApiError"
            ? err.message
            : err instanceof Error
              ? err.message
              : "Unknown error";
        failedRows.push(`Row ${rowNum} (${model ?? categoryName ?? "untitled"}): ${message}`);
      }
    }

    if (success === 0) {
      throw validationError(failedRows, "No assets were imported — fix the errors and try again.");
    }

    await audit({
      action: "ASSET_BULK_IMPORT",
      entityType: "assets",
      entityId: null,
      newValues: { success, failed },
    });

    return jsonOk({ success, failed, failedRows }, requestId);
  },
});