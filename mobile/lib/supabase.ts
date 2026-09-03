const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL ?? "";
const SUPABASE_KEY = process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? "";
const API_URL = process.env.EXPO_PUBLIC_API_URL ?? "";

export type Session = {
  access_token: string;
  refresh_token?: string;
  user?: { id?: string; email?: string };
};

export async function supabasePost(path: string, body: unknown, token?: string) {
  const headers: Record<string, string> = {
    apikey: SUPABASE_KEY,
    "Content-Type": "application/json",
  };
  if (token) headers["Authorization"] = `Bearer ${token}`;
  const res = await fetch(`${SUPABASE_URL}${path}`, {
    method: "POST",
    headers,
    body: JSON.stringify(body),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(json.error_description ?? json.msg ?? json.message ?? "Request failed");
  return json;
}

export async function apiPost(path: string, token: string, body: unknown) {
  const res = await fetch(`${API_URL}${path}`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok || json.error) throw new Error(json.message ?? json.error ?? "Request failed");
  return json.data ?? json;
}

export async function dbGet(table: string, query: string, token: string) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${table}?${query}`, {
    headers: {
      apikey: SUPABASE_KEY,
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
  });
  const json = await res.json().catch(() => []);
  return Array.isArray(json) ? json : [];
}
