import { route, resolveActor, requirePermission, requireCompany, ok, badRequest, notFound, dbError, readJson, serviceClient } from "@/lib/server";
import { writeAudit } from "@/lib/audit";

export const POST = route(async (req: Request, ctx: { params: Promise<{ id: string }> }) => {
  const actor = await resolveActor();
  requirePermission(actor, "asset.repair");
  const companyId = requireCompany(actor);
  const { id: assetId } = await ctx.params;

  const body = await readJson(req);
  const maintenance_type = body.maintenance_type ? String(body.maintenance_type) : "Hardware Repair";
  const description = body.description ? String(body.description) : null;
  if (!description) throw badRequest("INVALID_INPUT", "description is required");

  const db = serviceClient();

  const { data: asset, error: assetErr } = await db
    .from("assets")
    .select("id, asset_code, company_id, status")
    .eq("id", assetId)
    .maybeSingle();
  if (assetErr) throw dbError(assetErr);
  if (!asset) throw notFound("Asset not found");
  if ((asset as { company_id: string }).company_id !== companyId) throw badRequest("FORBIDDEN", "Asset belongs to another company");

  const { data, error } = await db
    .from("asset_maintenance")
    .insert({
      asset_id: assetId,
      maintenance_type,
      vendor: body.vendor ?? null,
      cost: body.cost ?? null,
      description,
      status: "OPEN",
      started_at: new Date().toISOString(),
      created_by: actor.employeeId,
    })
    .select("id")
    .single();
  if (error) throw dbError(error);

  // Mark the asset as under repair unless it is currently assigned to someone.
  const currentStatus = (asset as { status: string }).status;
  if (currentStatus === "AVAILABLE" || currentStatus === "DAMAGED") {
    await db
      .from("assets")
      .update({ status: "UNDER_REPAIR", updated_at: new Date().toISOString() })
      .eq("id", assetId);
  }

  await writeAudit(db, {
    company_id: companyId,
    actor_employee_id: actor.employeeId,
    actor_auth_user_id: actor.authUserId,
    action: "ASSET_MAINTENANCE",
    entity_type: "assets",
    entity_id: assetId,
    new_values: { maintenance_type, vendor: body.vendor ?? null },
  }).catch(() => {});

  return ok({ id: assetId, maintenance_id: (data as { id: string }).id, status: "UNDER_REPAIR" }, { status: 201 });
});
