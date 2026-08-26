import { route, resolveActor, requirePermission, requireCompany, ok, badRequest, dbError, readJson, serviceClient } from "@/lib/server";
import { writeAudit } from "@/lib/audit";

export const POST = route(async (req: Request) => {
  const actor = await resolveActor();
  requirePermission(actor, "employee.create");
  const companyId = requireCompany(actor);

  const body = await readJson(req);
  const first_name = String(body.first_name ?? "").trim();
  const last_name = String(body.last_name ?? "").trim();
  const joining_date = body.joining_date ? String(body.joining_date) : null;

  if (!first_name || !last_name || !joining_date) {
    throw badRequest("INVALID_INPUT", "first_name, last_name and joining_date are required");
  }

  const db = serviceClient();
  const { data, error } = await db
    .from("employees")
    .insert({
      company_id: companyId,
      first_name,
      last_name,
      middle_name: body.middle_name ? String(body.middle_name) : null,
      official_email: body.official_email ? String(body.official_email) : null,
      official_mobile: body.official_mobile ? String(body.official_mobile) : null,
      personal_mobile: body.personal_mobile ? String(body.personal_mobile) : null,
      personal_email: body.personal_email ? String(body.personal_email) : null,
      joining_date,
      department_id: body.department_id ?? null,
      designation_id: body.designation_id ?? null,
      employment_type_id: body.employment_type_id ?? null,
      location_id: body.location_id ?? null,
      manager_id: body.manager_id ?? null,
      gender: body.gender ?? null,
      employment_status: "ACTIVE",
    })
    .select("id, employee_code, display_name")
    .single();

  if (error) throw dbError(error);

  await writeAudit(db, {
    company_id: companyId,
    actor_employee_id: actor.employeeId,
    actor_auth_user_id: actor.authUserId,
    action: "EMPLOYEE_CREATE",
    entity_type: "employees",
    entity_id: data.id,
    new_values: { first_name, last_name, official_email: body.official_email ?? null },
  }).catch(() => {});

  return ok(data, { status: 201 });
});
