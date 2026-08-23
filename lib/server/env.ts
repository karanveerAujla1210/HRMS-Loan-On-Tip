/**
 * Server-side environment access.
 *
 * Values are read lazily so that a production build never requires secrets to
 * be present. Missing configuration fails at request time with a clear error
 * instead of crashing the build.
 */

function read(name: string): string | undefined {
  const value = process.env[name];
  return value && value.length > 0 ? value : undefined;
}

export function supabaseUrl(): string {
  const value = read("NEXT_PUBLIC_SUPABASE_URL");
  if (!value) throw new Error("NEXT_PUBLIC_SUPABASE_URL is not configured");
  return value;
}

export function supabasePublishableKey(): string {
  const value =
    read("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY") ?? read("NEXT_PUBLIC_SUPABASE_ANON_KEY");
  if (!value) throw new Error("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY is not configured");
  return value;
}

/**
 * Service-role key. Server-only: this module must never be imported from a
 * client component. Guarded by an ESLint rule and by the `server-only` import.
 */
export function supabaseServiceRoleKey(): string | null {
  return read("SUPABASE_SERVICE_ROLE_KEY") ?? null;
}

export function cronSecret(): string | undefined {
  return read("CRON_SECRET");
}

export function appUrl(): string {
  return read("NEXT_PUBLIC_APP_URL") ?? "http://localhost:3000";
}

export function isProduction(): boolean {
  return process.env.NODE_ENV === "production";
}
