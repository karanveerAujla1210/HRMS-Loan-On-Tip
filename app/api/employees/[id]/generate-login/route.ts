import "server-only";
import { withApi, jsonOk } from "@/lib/server/http";
import { adminClient } from "@/lib/server/supabase";
import { mapDatabaseError, ApiError } from "@/lib/server/errors";
import { createClient } from "@supabase/supabase-js";

export const POST = withApi<never, never, { id: string }>({
  permission: "employee.create",
  requireEmployee: false,
  handler: async ({ req, ctx, params, requestId }) => {
    const companyId = ctx.companyId!;
    const { id } = params;
    const db = adminClient();

    const { data: emp, error: empErr } = await db
      .from("employees")
      .select("id, official_email, first_name, last_name")
      .eq("id", id)
      .eq("company_id", companyId)
      .maybeSingle();

    if (empErr) throw mapDatabaseError(empErr);
    if (!emp) throw new ApiError("NOT_FOUND", "Employee not found");
    if (!emp.official_email)
      throw new ApiError("VALIDATION_ERROR", "Employee must have an official email before generating a login");

    // Check if a profile+auth user already exists for this employee
    const { data: existing } = await db
      .from("profiles")
      .select("id, auth_user_id")
      .eq("employee_id", id)
      .maybeSingle();

    if (existing?.auth_user_id) {
      return jsonOk({ message: "Login already exists for this employee", email: emp.official_email, already_existed: true }, requestId);
    }

    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!serviceKey) throw new ApiError("INTERNAL_ERROR", "Service role key is not configured");

    const adminAuth = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      serviceKey,
      { auth: { autoRefreshToken: false, persistSession: false } }
    );

    // Derive the app URL from the incoming request headers (works on Vercel + localhost)
    const host = req.headers.get("x-forwarded-host") ?? req.headers.get("host") ?? "";
    const proto = req.headers.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");
    const redirectTo = `${proto}://${host}/auth/callback`;

    const { data: authData, error: authErr } = await adminAuth.auth.admin.inviteUserByEmail(
      emp.official_email,
      { redirectTo }
    );

    if (authErr) {
      const msg = authErr.message?.toLowerCase() ?? "";
      if (msg.includes("already been registered") || msg.includes("already registered")) {
        const { data: listData } = await adminAuth.auth.admin.listUsers({ perPage: 1000 });
        const found = listData?.users?.find((u) => u.email === emp.official_email);
        if (found) {
          await db.from("profiles").upsert(
            { auth_user_id: found.id, employee_id: id, company_id: companyId, email: emp.official_email },
            { onConflict: "auth_user_id" }
          );
          return jsonOk({ message: "Linked to existing auth account", email: emp.official_email, already_existed: true }, requestId);
        }
      }
      throw new ApiError("VALIDATION_ERROR", authErr.message);
    }

    const { error: profileErr } = await db.from("profiles").upsert(
      { auth_user_id: authData.user.id, employee_id: id, company_id: companyId, email: emp.official_email },
      { onConflict: "auth_user_id" }
    );

    if (profileErr) throw mapDatabaseError(profileErr);

    return jsonOk({ message: "Login created — invite email sent", email: emp.official_email, already_existed: false }, requestId);
  },
});
