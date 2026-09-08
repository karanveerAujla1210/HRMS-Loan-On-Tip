import { createBrowserClient } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Lazily-created Supabase browser client.
 *
 * Creating the client at module scope would crash `next build` static
 * generation (and any server context) whenever the environment variables are
 * not present, e.g. before Vercel/CI inject them. We therefore defer client
 * creation until the first real property access — which only ever happens at
 * runtime inside the browser — and surface a clear, actionable error if the
 * project is misconfigured.
 */
type BrowserClient = SupabaseClient;

function createClient(): BrowserClient {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

  if (!url || !key) {
    throw new Error(
      "[supabase] NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY must be set before using Supabase."
    );
  }

  return createBrowserClient(url, key, {
    auth: {
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: true,
    },
  });
}

let client: BrowserClient | null = null;

/** Returns the cached browser client, creating it on first use. */
export function getSupabaseClient(): BrowserClient {
  client ??= createClient();
  return client;
}

/**
 * Proxy that defers `createBrowserClient()` until a property is accessed.
 * Methods are rebound so callers can destructure without losing `this`.
 */
export const supabase: BrowserClient = new Proxy({} as BrowserClient, {
  get(_target, prop: keyof BrowserClient) {
    const source = getSupabaseClient();
    const value = source[prop];
    return typeof value === "function" ? value.bind(source) : value;
  },
});
