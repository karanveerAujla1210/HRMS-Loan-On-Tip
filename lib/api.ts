import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

export async function createApiClient() {
  const cookieStore = await cookies();
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    { cookies: { getAll: () => cookieStore.getAll() } }
  );
}

export async function getSessionAndProfile(supabase: Awaited<ReturnType<typeof createApiClient>>) {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) return { session: null, profile: null };

  const { data: profile } = await supabase
    .from("profiles")
    .select("id,employee_id,company_id")
    .eq("auth_user_id", session.user.id)
    .single();

  return { session, profile };
}

export async function getRole(
  supabase: Awaited<ReturnType<typeof createApiClient>>,
  employeeId: string
): Promise<string | null> {
  const { data } = await supabase
    .from("employee_roles")
    .select("roles(code)")
    .eq("employee_id", employeeId)
    .eq("is_active", true)
    .limit(1)
    .single();
  const r = data as { roles: { code: string } | null } | null;
  return r?.roles?.code ?? null;
}
