import { route, resolveActor, requirePermission, requireCompany, ok, badRequest, notFound, dbError, readJson, serviceClient } from "@/lib/server";
import { writeAudit } from "@/lib/audit";

async function assertEmployeeInCompany(db: ReturnType<typeof serviceClient>, companyId: string, employeeId: string) {
  const { data, error } = await db
    .from("employees")
    .select("id, company_id")
    .eq("id", employeeId)
    .maybeSingle();
  if (error) throw dbError(error);
  if (!data) throw notFound("Employee not found");
  if ((data as { company_id: string }).company_id !== companyId) throw badRequest("FORBIDDEN", "Employee belongs to another company");
}

export const POST = route(async (req: Request, ctx: { params: Promise<{ id: string }> }) => {
  const actor = await resolveActor();
  requirePermission(actor, "employee.document.manage");
  const companyId = requireCompany(actor);
  const { id } = await ctx.params;
  const db = serviceClient();
  await assertEmployeeInCompany(db, companyId, id);

  const body = await readJson(req);
  const document_type_id = body.document_type_id ? String(body.document_type_id) : null;
  const file_name = body.file_name ? String(body.file_name) : null;
  if (!document_type_id || !file_name) throw badRequest("INVALID_INPUT", "document_type_id and file_name are required");

  const { data, error } = await db
    .from("employee_documents")
    .insert({
      employee_id: id,
      document_type_id,
      file_name,
      storage_path: body.storage_path ?? "pending-upload",
      issue_date: body.issue_date ?? null,
      expiry_date: body.expiry_date ?? null,
      uploaded_by: actor.employeeId,
      status: "PENDING",
    })
    .select("id")
    .single();
  if (error) throw dbError(error);

  await writeAudit(db, {
    company_id: companyId,
    actor_employee_id: actor.employeeId,
    actor_auth_user_id: actor.authUserId,
    action: "DOCUMENT_ADD",
    entity_type: "employee_documents",
    entity_id: id,
    new_values: { file_name, document_type_id },
  }).catch(() => {});

  return ok(data, { status: 201 });
});
