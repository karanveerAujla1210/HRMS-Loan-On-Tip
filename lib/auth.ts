import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

export async function getServerSession() {
  const cookieStore = await cookies();
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    { cookies: { getAll: () => cookieStore.getAll() } }
  );
  const { data: { session } } = await supabase.auth.getSession();
  return { supabase, session };
}

export async function getProfile() {
  const { supabase, session } = await getServerSession();
  if (!session) return null;
  const { data } = await supabase
    .from("profiles")
    .select("id,employee_id,company_id,email")
    .eq("auth_user_id", session.user.id)
    .single();
  return data;
}
