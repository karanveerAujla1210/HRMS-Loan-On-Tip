import { route, resolveActor, requirePermission, requireCompany, ok, badRequest, forbidden, notFound, dbError, readJson, serviceClient } from "@/lib/server";
import { writeAudit } from "@/lib/audit";

export const POST = route(async (req: Request, ctx: { params: Promise<{ id: string }> }) => {
  const actor = await resolveActor();
  requirePermission(actor, "asset.assign");
  const companyId = requireCompany(actor);
  const { id: assetId } = await ctx.params;

  const body = await readJson(req);
  const employee_id = body.employee_id ? String(body.employee_id) : null;
  if (!employee_id) throw badRequest("INVALID_INPUT", "employee_id is required");

  const db = serviceClient();

  const { data: asset, error: assetErr } = await db
    .from("assets")
    .select("id, asset_code, status, company_id, current_employee_id")
    .eq("id", assetId)
    .maybeSingle();
  if (assetErr) throw dbError(assetErr);
  if (!asset) throw notFound("Asset not found");
  if ((asset as { company_id: string }).company_id !== companyId) throw forbidden("Asset belongs to another company");
  if ((asset as { status: string }).status !== "AVAILABLE") {
    throw badRequest("ASSET_NOT_AVAILABLE", `Asset is ${String((asset as { status: string }).status)}, not AVAILABLE`);
  }

  const { data: assignment, error: asgErr } = await db
    .from("asset_assignments")
    .insert({
      asset_id: assetId,
      employee_id,
      assigned_by: actor.employeeId,
      expected_return_date: body.expected_return_date ?? null,
      remarks: body.remarks ?? null,
      status: "ACTIVE",
    })
    .select("id")
    .single();
  if (asgErr) throw dbError(asgErr);

  const { error: handErr } = await db.from("asset_handover").insert({
    asset_assignment_id: (assignment as { id: string }).id,
    handover_date: new Date().toISOString().slice(0, 10),
    condition_at_handover: body.condition_at_handover ?? "GOOD",
    remarks: body.remarks ?? null,
  });
  if (handErr) throw dbError(handErr);

  const { error: updErr } = await db
    .from("assets")
    .update({ current_employee_id: employee_id, status: "ASSIGNED", updated_at: new Date().toISOString() })
    .eq("id", assetId);
  if (updErr) throw dbError(updErr);

  await writeAudit(db, {
    company_id: companyId,
    actor_employee_id: actor.employeeId,
    actor_auth_user_id: actor.authUserId,
    action: "ASSET_ASSIGN",
    entity_type: "assets",
    entity_id: assetId,
    new_values: { employee_id, condition: body.condition_at_handover ?? "GOOD" },
  }).catch(() => {});

  return ok({ id: assetId, status: "ASSIGNED" }, { status: 201 });
});
