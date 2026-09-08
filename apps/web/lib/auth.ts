import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

export async function getServerSession() {
  const cookieStore = await cookies();
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll: () => cookieStore.getAll(),
        setAll: (cookiesToSet: { name: string; value: string; options: import("@supabase/ssr").CookieOptions }[]) => {
          cookiesToSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options));
        },
      },
    }
  );
  // getUser() performs a verified round-trip to the auth server — never trust
  // the JWT payload from the cookie alone.
  const { data: { user } } = await supabase.auth.getUser();
  return { supabase, user };
}

export type ServerSession = Awaited<ReturnType<typeof getServerSession>>;

export async function getProfile() {
  const { supabase, user } = await getServerSession();
  if (!user) return null;
  const { data } = await supabase
    .from("profiles")
    .select("id,employee_id,company_id,email")
    .eq("auth_user_id", user.id)
    .maybeSingle();
  return data ?? null;
}
