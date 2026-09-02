import "server-only";
import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";
import {
  supabasePublishableKey,
  supabaseServiceRoleKey,
  supabaseUrl,
} from "./env";

export type Db = SupabaseClient;

export async function createUserClient(accessToken?: string): Promise<Db> {
  if (accessToken) {
    return createClient(supabaseUrl(), supabasePublishableKey(), {
      auth: { autoRefreshToken: false, persistSession: false },
      global: { headers: { Authorization: `Bearer ${accessToken}` } },
    });
  }
  const cookieStore = await cookies();
  return createServerClient(supabaseUrl(), supabasePublishableKey(), {
    cookies: {
      getAll: () => cookieStore.getAll(),
      setAll: (cookiesToSet: { name: string; value: string; options: CookieOptions }[]) => {
        try {
          for (const { name, value, options } of cookiesToSet) {
            cookieStore.set(name, value, options);
          }
        } catch {
          // Route handlers may run in a context where cookies are read-only.
        }
      },
    },
  });
}

export function createAdminClient(): Db {
  const key = supabaseServiceRoleKey();
  if (!key) {
    throw new Error(
      "SUPABASE_SERVICE_ROLE_KEY is not configured; privileged server operations are unavailable"
    );
  }
  return createClient(supabaseUrl(), key, {
    auth: { autoRefreshToken: false, persistSession: false },
    global: { headers: { "X-Client-Info": "loanontip-hrms-server" } },
  });
}

let cachedAdmin: Db | null = null;

export function adminClient(): Db {
  if (!cachedAdmin) cachedAdmin = createAdminClient();
  return cachedAdmin;
}

export function hasAdminCredentials(): boolean {
  return supabaseServiceRoleKey() !== null;
}
