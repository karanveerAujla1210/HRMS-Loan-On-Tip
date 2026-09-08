import "server-only";
import { withApi, jsonOk } from "@/lib/server/http";
import { z } from "zod";
import { adminClient } from "@/lib/server/supabase";
import { mapDatabaseError } from "@/lib/server/errors";
import { assertOrgTab, mapOrgPayload, orgTable } from "@/lib/org";

const OrgCreateSchema = z
  .object({
    table: z.enum([
      "departments",
      "designations",
      "locations",
      "shifts",
      "leave_types",
      "holidays",
      "employment_types",
      "asset_categories",
      "asset_brands",
      "custom_fields",
      "salary_structures",
    ]),
    name: z.string().trim().min(1).max(200),
    code: z.string().trim().min(1).max(50).optional(),
    // Remaining per-tab fields are mapped and validated by mapOrgPayload.
    payload: z.record(z.unknown()).optional(),
  })
  .passthrough();

export const POST = withApi<typeof OrgCreateSchema>({
  permission: "organisation.manage",
  body: OrgCreateSchema,
  rateLimit: { limit: 60, windowMs: 60_000 },
  handler: async ({ ctx, body, audit, requestId }) => {
    const companyId = ctx.companyId!;
    const orgTab = assertOrgTab(body.table); // validated by schema; kept for type-safety
    const db = adminClient();

    const row = mapOrgPayload(orgTab, body as unknown as Record<string, unknown>, companyId);
    const { data, error } = await db
      .from(orgTable(orgTab)!)
      .insert(row)
      .select("id")
      .single();
    if (error) throw mapDatabaseError(error);

    await audit({
      action: "ORG_CREATE",
      entityType: orgTable(orgTab)!,
      entityId: (data as { id: string }).id,
      newValues: row,
    });

    return jsonOk(data, requestId, 201);
  },
});