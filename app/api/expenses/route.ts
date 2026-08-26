import { route, resolveActor, requirePermission, requireCompany, ok, badRequest, dbError, readJson, serviceClient } from "@/lib/server";
import { writeAudit } from "@/lib/audit";

export const POST = route(async (req: Request) => {
  const actor = await resolveActor();
  requirePermission(actor, "expense.view");
  if (!actor.employeeId) throw badRequest("NO_EMPLOYEE", "No employee record linked to this account");
  const companyId = requireCompany(actor);

  const body = await readJson(req);
  const expense_date = body.expense_date ? String(body.expense_date) : new Date().toISOString().slice(0, 10);
  const category = body.category ? String(body.category) : null;
  const amount = body.amount ? Number(body.amount) : 0;
  if (!category || !(amount > 0)) throw badRequest("INVALID_INPUT", "category and a positive amount are required");

  const db = serviceClient();
  const { data, error } = await db
    .from("expenses")
    .insert({
      employee_id: actor.employeeId,
      company_id: companyId,
      expense_date,
      category,
      amount,
      description: body.description ?? null,
      receipt_path: body.receipt_path ?? null,
      status: "SUBMITTED",
      submitted_at: new Date().toISOString(),
    })
    .select("id, status")
    .single();
  if (error) throw dbError(error);

  await writeAudit(db, {
    company_id: companyId,
    actor_employee_id: actor.employeeId,
    actor_auth_user_id: actor.authUserId,
    action: "EXPENSE_SUBMIT",
    entity_type: "expenses",
    entity_id: (data as { id: string }).id,
    new_values: { category, amount },
  }).catch(() => {});

  return ok(data, { status: 201 });
});
