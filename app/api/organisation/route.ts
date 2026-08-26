import { route, resolveActor, requirePermission, requireCompany, ok, badRequest, dbError, readJson, serviceClient } from "@/lib/server";
import { assertOrgTab, mapOrgPayload, orgTable } from "@/lib/org";
import { writeAudit } from "@/lib/audit";

export const POST = route(async (req: Request) => {
  const actor = await resolveActor();
  requirePermission(actor, "organisation.manage");
  const companyId = requireCompany(actor);

  const body = await readJson(req);
  const tab = typeof body.table === "string" ? body.table : null;
  if (!tab) throw badRequest("INVALID_INPUT", "table is required");
  let orgTab;
  try {
    orgTab = assertOrgTab(tab);
  } catch {
    throw badRequest("INVALID_TABLE", `Unknown organisation table: ${tab}`);
  }

  const db = serviceClient();
  const row = mapOrgPayload(orgTab, body, companyId);
  const { data, error } = await db
    .from(orgTable(orgTab)!)
    .insert(row)
    .select("id")
    .single();
  if (error) throw dbError(error);

  await writeAudit(db, {
    company_id: companyId,
    actor_employee_id: actor.employeeId,
    actor_auth_user_id: actor.authUserId,
    action: "ORG_CREATE",
    entity_type: orgTable(orgTab)!,
    entity_id: (data as { id: string }).id,
    new_values: row,
  }).catch(() => {});

  return ok(data, { status: 201 });
});
