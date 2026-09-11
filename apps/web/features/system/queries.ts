import { apiFetch } from "@/lib/api/client";
import { API } from "@/lib/api/endpoints";

export type Company = { id: string; company_code: string; display_name: string };

/** All organizations in the system (super-admin gate in `/api/companies`). */
export async function fetchCompanies(): Promise<Company[]> {
  const res = await apiFetch<Company[]>(API.companies);
  return res.data ?? [];
}

/** A single organization by id (used by the context banner). */
export async function fetchCompanyById(id: string): Promise<Company | null> {
  const all = await fetchCompanies();
  return all.find((c) => c.id === id) ?? null;
}