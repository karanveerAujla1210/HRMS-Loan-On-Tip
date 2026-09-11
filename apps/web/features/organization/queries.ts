import { supabase } from "@/lib/supabase";

/** Shared org-master lookups used by people list, detail and import pages. */
export type OrgLookup = { id: string; name: string };
export type OrgLookups = {
  departments: OrgLookup[];
  designations: OrgLookup[];
  locations: OrgLookup[];
  employment_types: OrgLookup[];
};

/**
 * Fetches the org-master rows for a company in one round trip.
 * `onlyActive` filters `is_active = true` (import flows need inactive rows too,
 * so the filter is opt-in).
 */
export async function fetchOrgLookups(
  companyId: string,
  opts?: { onlyActive?: boolean }
): Promise<OrgLookups> {
  const onlyActive = opts?.onlyActive ?? false;

  const [deptRes, desigRes, locRes, empTypeRes] = await Promise.all([
    supabase.from("departments").select("id,name,is_active").eq("company_id", companyId).order("name"),
    supabase.from("designations").select("id,name,is_active").eq("company_id", companyId).order("name"),
    supabase.from("locations").select("id,name,is_active").eq("company_id", companyId).order("name"),
    supabase.from("employment_types").select("id,name,is_active").eq("company_id", companyId).order("name"),
  ]);

  const pick = (data: unknown): OrgLookup[] => {
    const rows = (data ?? []) as (OrgLookup & { is_active: boolean })[];
    return onlyActive ? rows.filter((r) => r.is_active) : rows;
  };

  return {
    departments: pick(deptRes.data),
    designations: pick(desigRes.data),
    locations: pick(locRes.data),
    employment_types: pick(empTypeRes.data),
  };
}
