import { route, resolveActor, requirePermission, requireCompany, ok, badRequest, notFound, dbError, readJson, serviceClient } from "@/lib/server";
import { writeAudit } from "@/lib/audit";

export const POST = route(async (req: Request, ctx: { params: Promise<{ id: string }> }) => {
  const actor = await resolveActor();
  requirePermission(actor, "asset.return");
  const companyId = requireCompany(actor);
  const { id: assetId } = await ctx.params;

  const body = await readJson(req);
  const condition = body.condition ? String(body.condition) : "GOOD";

  const db = serviceClient();

  const { data: asset, error: assetErr } = await db
    .from("assets")
    .select("id, asset_code, status, company_id, current_employee_id")
    .eq("id", assetId)
    .maybeSingle();
  if (assetErr) throw dbError(assetErr);
  if (!asset) throw notFound("Asset not found");
  if ((asset as { company_id: string }).company_id !== companyId) throw badRequest("FORBIDDEN", "Asset belongs to another company");
  if ((asset as { status: string }).status !== "ASSIGNED") {
    throw badRequest("ASSET_NOT_ASSIGNED", `Asset is ${String((asset as { status: string }).status)}, not ASSIGNED`);
  }

  const { data: assignment, error: asgErr } = await db
    .from("asset_assignments")
    .select("id, employee_id")
    .eq("asset_id", assetId)
    .eq("status", "ACTIVE")
    .maybeSingle();
  if (asgErr) throw dbError(asgErr);
  if (!assignment) throw badRequest("NO_ACTIVE_ASSIGNMENT", "No active assignment to return");

  const { error: retErr } = await db.from("asset_returns").insert({
    asset_assignment_id: (assignment as { id: string }).id,
    return_date: new Date().toISOString().slice(0, 10),
    received_by: actor.employeeId,
    condition_at_return: condition,
    damage_description: body.damage_description ?? null,
    missing_items: body.missing_items ?? null,
    recovery_amount: body.recovery_amount ?? null,
    remarks: body.remarks ?? null,
  });
  if (retErr) throw dbError(retErr);

  const { error: asgUpd } = await db
    .from("asset_assignments")
    .update({ status: "RETURNED", returned_at: new Date().toISOString(), updated_at: new Date().toISOString() })
    .eq("id", (assignment as { id: string }).id);
  if (asgUpd) throw dbError(asgUpd);

  const newStatus = condition === "DAMAGED" ? "DAMAGED" : "AVAILABLE";
  const { error: assetUpd } = await db
    .from("assets")
    .update({ current_employee_id: null, status: newStatus, updated_at: new Date().toISOString() })
    .eq("id", assetId);
  if (assetUpd) throw dbError(assetUpd);

  await writeAudit(db, {
    company_id: companyId,
    actor_employee_id: actor.employeeId,
    actor_auth_user_id: actor.authUserId,
    action: "ASSET_RETURN",
    entity_type: "assets",
    entity_id: assetId,
    new_values: { condition, status: newStatus },
  }).catch(() => {});

  return ok({ id: assetId, status: newStatus });
});
