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

/**
 * Request-scoped Supabase client that carries the caller's session.
 *
 * All domain reads and writes go through this client so Row Level Security
 * remains a second line of defence behind API authorisation.
 */
export async function createUserClient(): Promise<Db> {
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
          // Session refresh is handled by middleware, so this is safe to ignore.
        }
      },
    },
  });
}

/**
 * Privileged client that bypasses Row Level Security.
 *
 * Restricted to cross-cutting infrastructure that a user session legitimately
 * cannot perform: resolving the auth context, append-only audit writes,
 * idempotency bookkeeping, API logs and scheduled jobs. Never expose it to the
 * browser and never use it to skip an authorisation check.
 */
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

/** Memoised admin client for hot paths such as audit logging. */
export function adminClient(): Db {
  if (!cachedAdmin) cachedAdmin = createAdminClient();
  return cachedAdmin;
}

export function hasAdminCredentials(): boolean {
  return supabaseServiceRoleKey() !== null;
}
