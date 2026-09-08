"use client";

import { supabase } from "@/lib/supabase";

/**
 * Thin fetch wrapper used by every client page.
 *
 * Responsibilities:
 * - attaches the current Supabase access token as a Bearer header (the token
 *   is auto-refreshed by the browser client and the SessionKeeper provider),
 * - always sends same-origin credentials so cookie sessions still work,
 * - normalises every response into the standard `{ data, error }` envelope so
 *   pages never parse raw responses or leak HTTP details.
 */
export type ApiErrorBody = { code: string; message: string; details?: unknown };

export type ApiEnvelope<T> = {
  data: T | null;
  error: ApiErrorBody | null;
  requestId?: string;
};

export async function apiFetch<T = unknown>(
  path: string,
  init: RequestInit = {}
): Promise<ApiEnvelope<T>> {
  const headers = new Headers(init.headers);
  if (init.body && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }

  // Attach a fresh access token when a session exists.
  try {
    const { data } = await supabase.auth.getSession();
    const token = data.session?.access_token;
    if (token && !headers.has("Authorization")) {
      headers.set("Authorization", `Bearer ${token}`);
    }
  } catch {
    // Supabase env not configured (e.g. preview build) — fall through and
    // rely on the cookie session instead.
  }

  let res: Response;
  try {
    res = await fetch(path, { ...init, headers, credentials: "same-origin" });
  } catch {
    return {
      data: null,
      error: { code: "NETWORK_ERROR", message: "Network error. Check your connection and try again." },
    };
  }

  const json = (await res.json().catch(() => null)) as ApiEnvelope<T> | null;
  if (!json) {
    return {
      data: null,
      error: {
        code: "INTERNAL_ERROR",
        message: `Server error (${res.status}). Please try again.`,
      },
    };
  }
  return json;
}
