import { route, resolveActor, requirePermission, requireCompany, ok, badRequest, notFound, dbError, serviceClient } from "@/lib/server";
import { createClient } from "@supabase/supabase-js";

export const POST = route(async (req: Request, ctx: { params: Promise<{ id: string }> }) => {
  const actor = await resolveActor();
  requirePermission(actor, "employee.create");
  const companyId = requireCompany(actor);
  const { id } = await ctx.params;

  const db = serviceClient();

  const { data: emp, error: empErr } = await db
    .from("employees")
    .select("id, official_email, first_name, last_name")
    .eq("id", id)
    .eq("company_id", companyId)
    .maybeSingle();

  if (empErr) throw dbError(empErr);
  if (!emp) throw notFound("Employee not found");
  if (!emp.official_email)
    throw badRequest("NO_EMAIL", "Employee must have an official email before generating a login");

  // Check if a profile+auth user already exists for this employee
  const { data: existing } = await db
    .from("profiles")
    .select("id, auth_user_id")
    .eq("employee_id", id)
    .maybeSingle();

  if (existing?.auth_user_id) {
    return ok({ message: "Login already exists for this employee", email: emp.official_email, already_existed: true });
  }

  const adminAuth = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );

  const host = req.headers.get("x-forwarded-host") ?? req.headers.get("host") ?? "";
  const proto = req.headers.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");
  const appUrl = `${proto}://${host}`;

  const { data: authData, error: authErr } = await adminAuth.auth.admin.inviteUserByEmail(
    emp.official_email,
    { redirectTo: `${appUrl}/auth/callback` }
  );

  if (authErr) {
    // User already exists in auth.users — find and link them
    const msg = authErr.message?.toLowerCase() ?? "";
    if (msg.includes("already been registered") || msg.includes("already registered")) {
      const { data: listData } = await adminAuth.auth.admin.listUsers({ perPage: 1000 });
      const found = listData?.users?.find((u) => u.email === emp.official_email);
      if (found) {
        await db.from("profiles").upsert(
          { auth_user_id: found.id, employee_id: id, company_id: companyId, email: emp.official_email },
          { onConflict: "auth_user_id" }
        );
        return ok({ message: "Linked to existing auth account", email: emp.official_email, already_existed: true });
      }
    }
    throw badRequest("AUTH_ERROR", authErr.message);
  }

  const { error: profileErr } = await db.from("profiles").upsert(
    { auth_user_id: authData.user.id, employee_id: id, company_id: companyId, email: emp.official_email },
    { onConflict: "auth_user_id" }
  );

  if (profileErr) throw dbError(profileErr);

  return ok({ message: "Login created — invite email sent", email: emp.official_email, already_existed: false });
});
