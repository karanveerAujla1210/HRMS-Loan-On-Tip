import { route, resolveActor, requirePermission, requireCompany, ok, badRequest, notFound, dbError, readJson, serviceClient } from "@/lib/server";
import { writeAudit } from "@/lib/audit";

export const PATCH = route(async (req: Request, ctx: { params: Promise<{ id: string; docId: string }> }) => {
  const actor = await resolveActor();
  requirePermission(actor, "employee.document.manage");
  const companyId = requireCompany(actor);
  const { id, docId } = await ctx.params;
  const db = serviceClient();

  const { data: doc, error: docErr } = await db
    .from("employee_documents")
    .select("id, employee_id")
    .eq("id", docId)
    .maybeSingle();
  if (docErr) throw dbError(docErr);
  if (!doc) throw notFound("Document not found");
  if ((doc as { employee_id: string }).employee_id !== id) throw badRequest("FORBIDDEN", "Document does not belong to this employee");

  const body = await readJson(req);
  const update: Record<string, unknown> = {};
  if (body.is_verified === true) {
    update.status = "VERIFIED";
    update.verified_by = actor.employeeId;
    update.verified_at = new Date().toISOString();
  }
  if (Object.keys(update).length === 0) throw badRequest("INVALID_INPUT", "No supported fields provided");

  const { data, error } = await db
    .from("employee_documents")
    .update(update)
    .eq("id", docId)
    .select("id, status")
    .single();
  if (error) throw dbError(error);

  await writeAudit(db, {
    company_id: companyId,
    actor_employee_id: actor.employeeId,
    actor_auth_user_id: actor.authUserId,
    action: "DOCUMENT_VERIFY",
    entity_type: "employee_documents",
    entity_id: docId,
  }).catch(() => {});

  return ok(data);
});
