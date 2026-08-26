import { route, resolveActor, requirePermission, requireCompany, ok, badRequest, notFound, dbError, readJson, serviceClient } from "@/lib/server";
import { assertOrgTab, mapOrgPayload, orgTable } from "@/lib/org";
import { writeAudit } from "@/lib/audit";

export const PATCH = route(async (req: Request, ctx: { params: Promise<{ tab: string; id: string }> }) => {
  const actor = await resolveActor();
  requirePermission(actor, "organisation.manage");
  const companyId = requireCompany(actor);
  const { tab, id } = await ctx.params;

  let orgTab;
  try {
    orgTab = assertOrgTab(tab);
  } catch {
    throw badRequest("INVALID_TABLE", `Unknown organisation table: ${tab}`);
  }

  const body = await readJson(req);
  const db = serviceClient();
  const row = mapOrgPayload(orgTab, body, companyId);
  delete (row as Record<string, unknown>).company_id;

  const { data, error } = await db
    .from(orgTable(orgTab)!)
    .update({ ...row, updated_at: new Date().toISOString() })
    .eq("id", id)
    .eq("company_id", companyId)
    .select("id")
    .single();
  if (error) throw dbError(error);
  if (!data) throw notFound("Record not found");

  await writeAudit(db, {
    company_id: companyId,
    actor_employee_id: actor.employeeId,
    actor_auth_user_id: actor.authUserId,
    action: "ORG_UPDATE",
    entity_type: orgTable(orgTab)!,
    entity_id: id,
    new_values: row,
  }).catch(() => {});

  return ok(data);
});

export const DELETE = route(async (_req: Request, ctx: { params: Promise<{ tab: string; id: string }> }) => {
  const actor = await resolveActor();
  requirePermission(actor, "organisation.manage");
  const companyId = requireCompany(actor);
  const { tab, id } = await ctx.params;

  let orgTab;
  try {
    orgTab = assertOrgTab(tab);
  } catch {
    throw badRequest("INVALID_TABLE", `Unknown organisation table: ${tab}`);
  }

  const db = serviceClient();
  const { error } = await db
    .from(orgTable(orgTab)!)
    .delete()
    .eq("id", id)
    .eq("company_id", companyId);
  if (error) throw dbError(error);

  await writeAudit(db, {
    company_id: companyId,
    actor_employee_id: actor.employeeId,
    actor_auth_user_id: actor.authUserId,
    action: "ORG_DELETE",
    entity_type: orgTable(orgTab)!,
    entity_id: id,
  }).catch(() => {});

  return ok({ id, deleted: true });
});
