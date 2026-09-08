import "server-only";
import { withApi, jsonOk } from "@/lib/server/http";
import { z } from "zod";
import { adminClient } from "@/lib/server/supabase";
import { mapDatabaseError, notFound as notFoundError } from "@/lib/server/errors";
import { assertOrgTab, mapOrgPayload, orgTable } from "@/lib/org";

type RouteParams = { tab: string; id: string };

const OrgPatchSchema = z
  .object({
    name: z.string().trim().min(1).max(200).optional(),
    code: z.string().trim().min(1).max(50).optional(),
  })
  .passthrough();

function resolveTab(tab: string) {
  try {
    return assertOrgTab(tab);
  } catch {
    throw notFoundError(`Unknown organisation table: ${tab}`);
  }
}

export const PATCH = withApi<typeof OrgPatchSchema, z.ZodTypeAny, RouteParams>({
  permission: "organisation.manage",
  body: OrgPatchSchema,
  rateLimit: { limit: 60, windowMs: 60_000 },
  handler: async ({ ctx, body, params, audit, requestId }) => {
    const companyId = ctx.companyId!;
    const { tab, id } = params;
    const orgTab = resolveTab(tab);
    const db = adminClient();

    const row = mapOrgPayload(orgTab, body as unknown as Record<string, unknown>, companyId);
    delete (row as Record<string, unknown>).company_id;

    const { data, error } = await db
      .from(orgTable(orgTab)!)
      .update({ ...row, updated_at: new Date().toISOString() })
      .eq("id", id)
      .eq("company_id", companyId)
      .select("id")
      .single();
    if (error) throw mapDatabaseError(error);
    if (!data) throw notFoundError("Record not found");

    await audit({
      action: "ORG_UPDATE",
      entityType: orgTable(orgTab)!,
      entityId: id,
      newValues: row,
    });

    return jsonOk(data, requestId);
  },
});

export const DELETE = withApi<z.ZodTypeAny, z.ZodTypeAny, RouteParams>({
  permission: "organisation.manage",
  rateLimit: { limit: 30, windowMs: 60_000 },
  handler: async ({ ctx, params, audit, requestId }) => {
    const companyId = ctx.companyId!;
    const { tab, id } = params;
    const orgTab = resolveTab(tab);
    const db = adminClient();

    // Soft-delete when the table supports is_active; otherwise hard delete.
    const table = orgTable(orgTab)!;
    const { data: existing } = await db
      .from(table)
      .select("id")
      .eq("id", id)
      .eq("company_id", companyId)
      .maybeSingle();
    if (!existing) throw notFoundError("Record not found");

    const { error: softErr } = await db
      .from(table)
      .update({ is_active: false, updated_at: new Date().toISOString() })
      .eq("id", id)
      .eq("company_id", companyId);

    if (softErr) {
      // Table has no is_active column — fall back to a hard delete.
      const { error: delErr } = await db
        .from(table)
        .delete()
        .eq("id", id)
        .eq("company_id", companyId);
      if (delErr) throw mapDatabaseError(delErr);
    }

    await audit({
      action: "ORG_DELETE",
      entityType: table,
      entityId: id,
    });

    return jsonOk({ id, deleted: true }, requestId);
  },
});