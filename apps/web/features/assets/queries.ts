import { supabase } from "@/lib/supabase";

export type AssetSetupLookups = {
  categories: { id: string; name: string; prefix: string | null }[];
  locations: { id: string; name: string }[];
};

/** Category + location lookups shared by the asset list and bulk-import pages. */
export async function fetchAssetSetupLookups(companyId: string): Promise<AssetSetupLookups> {
  const [catRes, locRes] = await Promise.all([
    supabase
      .from("asset_categories")
      .select("id,name,prefix")
      .eq("company_id", companyId)
      .eq("is_active", true)
      .order("name"),
    supabase
      .from("locations")
      .select("id,name")
      .eq("company_id", companyId)
      .eq("is_active", true)
      .order("name"),
  ]);

  return {
    categories: (catRes.data as AssetSetupLookups["categories"]) ?? [],
    locations: (locRes.data as AssetSetupLookups["locations"]) ?? [],
  };
}

/** Active (in-possession) asset assignments for one employee. */
export async function fetchActiveAssetAssignments(employeeId: string) {
  const res = await supabase
    .from("asset_assignments")
    .select("id,status,assigned_at,assets(asset_code,brand,model,serial_number,asset_categories(name))")
    .eq("employee_id", employeeId)
    .eq("status", "ACTIVE");

  return (res.data as Record<string, unknown>[]) ?? [];
}
