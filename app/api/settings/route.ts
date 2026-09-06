import "server-only";
import { withApi, jsonOk } from "@/lib/server/http";
import { SettingsUpdateSchema } from "@hrms/api-contract";
import { mapDatabaseError } from "@/lib/server/errors";
import { SETTING_KEYS } from "@hrms/config";
import { adminClient } from "@/lib/server/supabase";
import { z } from "zod";

const SettingsGetQuerySchema = z.object({
  prefix: z.string().trim().max(100).optional(),
});

export const GET = withApi({
  permission: "settings.manage",
  query: SettingsGetQuerySchema,
  handler: async ({ ctx, query, requestId }) => {
    const companyId = ctx.companyId!;
    const db = adminClient();

    let q = db
      .from("system_settings")
      .select("setting_key, setting_value, data_type, description")
      .eq("company_id", companyId);

    if (query.prefix) q = q.like("setting_key", `${query.prefix}%`);

    const { data, error } = await q;
    if (error) throw mapDatabaseError(error);

    return jsonOk({ data: data ?? [] }, requestId);
  },
});

export const PATCH = withApi({
  permission: "settings.manage",
  body: SettingsUpdateSchema,
  handler: async ({ ctx, body, audit, requestId }) => {
    const companyId = ctx.companyId!;
    const db = adminClient();

    const nowIso = new Date().toISOString();
    const rows = body.settings.map((s) => ({
      company_id: companyId,
      setting_key: s.setting_key,
      setting_value: s.setting_value,
      updated_at: nowIso,
    }));

    const { error } = await db
      .from("system_settings")
      .upsert(rows, { onConflict: "company_id,setting_key" });
    if (error) throw mapDatabaseError(error);

    await audit({
      action: "SETTINGS_UPDATE",
      entityType: "system_settings",
      entityId: null,
      newValues: { settings: body.settings },
    });

    return jsonOk({ updated: rows.length }, requestId);
  },
});

export const SETTING_KEYS_EXPORT = SETTING_KEYS;