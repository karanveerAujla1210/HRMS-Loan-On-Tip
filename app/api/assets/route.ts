import { route, resolveActor, requirePermission, requireCompany, ok, badRequest, notFound, dbError, readJson, serviceClient } from "@/lib/server";
import { writeAudit } from "@/lib/audit";

export const POST = route(async (req: Request) => {
  const actor = await resolveActor();
  requirePermission(actor, "asset.create");
  const companyId = requireCompany(actor);

  const body = await readJson(req);
  const asset_category_id = body.asset_category_id ? String(body.asset_category_id) : null;
  const model = body.model ? String(body.model).trim() : null;
  if (!asset_category_id || !model) {
    throw badRequest("INVALID_INPUT", "asset_category_id and model are required");
  }

  const db = serviceClient();

  const { data: category, error: catErr } = await db
    .from("asset_categories")
    .select("id, prefix")
    .eq("id", asset_category_id)
    .eq("company_id", companyId)
    .maybeSingle();
  if (catErr) throw dbError(catErr);
  if (!category) throw notFound("Asset category not found for this company");

  const { data: codeRes, error: codeErr } = await db.rpc("next_asset_code", {
    p_prefix: (category as { prefix: string }).prefix,
  });
  if (codeErr) throw dbError(codeErr);
  const asset_code = codeRes as string;

  const { data, error } = await db
    .from("assets")
    .insert({
      company_id: companyId,
      asset_category_id,
      brand_id: body.brand_id ?? null,
      location_id: body.location_id ?? null,
      asset_code,
      asset_tag: body.asset_tag ?? null,
      model,
      serial_number: body.serial_number ?? null,
      imei_1: body.imei_1 ?? null,
      mobile_number: body.mobile_number ?? null,
      sim_number: body.sim_number ?? null,
      purchase_date: body.purchase_date ?? null,
      purchase_cost: body.purchase_cost ?? null,
      warranty_end: body.warranty_end ?? null,
      condition: body.condition ?? "GOOD",
      status: "AVAILABLE",
      vendor_name: body.vendor_name ?? null,
      invoice_number: body.invoice_number ?? null,
      notes: body.notes ?? null,
    })
    .select("id, asset_code, model")
    .single();
  if (error) throw dbError(error);

  await writeAudit(db, {
    company_id: companyId,
    actor_employee_id: actor.employeeId,
    actor_auth_user_id: actor.authUserId,
    action: "ASSET_CREATE",
    entity_type: "assets",
    entity_id: data.id,
    new_values: { asset_code, model, category_id: asset_category_id },
  }).catch(() => {});

  return ok({ ...data, asset_code }, { status: 201 });
});
