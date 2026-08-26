import type { SupabaseClient } from "@supabase/supabase-js";

export type OrgTab =
  | "departments"
  | "designations"
  | "locations"
  | "shifts"
  | "leave_types"
  | "holidays"
  | "custom_fields";

const TAB_TABLE: Record<OrgTab, string> = {
  departments: "departments",
  designations: "designations",
  locations: "locations",
  shifts: "shifts",
  leave_types: "leave_types",
  holidays: "holidays",
  custom_fields: "custom_fields",
};

const VALID_TABS = new Set<string>(Object.keys(TAB_TABLE));

export function orgTable(tab: string): string | null {
  return VALID_TABS.has(tab) ? TAB_TABLE[tab as OrgTab] : null;
}

/** Maps the generic organisation form payload to a per-table insert/update row. */
export function mapOrgPayload(
  tab: OrgTab,
  body: Record<string, unknown>,
  companyId: string
): Record<string, unknown> {
  const base: Record<string, unknown> = { company_id: companyId };
  switch (tab) {
    case "departments":
      return { ...base, department_code: body.code, name: body.name, is_active: body.is_active ?? true };
    case "designations":
      return { ...base, designation_code: body.code, name: body.name, level: body.level ?? null, is_active: body.is_active ?? true };
    case "locations":
      return {
        ...base,
        location_code: body.code,
        name: body.name,
        city: body.city ?? null,
        state: body.state ?? null,
        latitude: body.latitude ?? null,
        longitude: body.longitude ?? null,
        attendance_radius_meters: body.attendance_radius_meters ?? 150,
        is_active: body.is_active ?? true,
      };
    case "shifts":
      return {
        ...base,
        shift_code: body.code,
        name: body.name,
        start_time: body.start_time ?? null,
        end_time: body.end_time ?? null,
        grace_minutes: body.grace_minutes ?? 15,
        is_active: body.is_active ?? true,
      };
    case "leave_types":
      return {
        ...base,
        code: body.code,
        name: body.name,
        is_paid: body.is_paid ?? true,
        allows_half_day: body.allows_half_day ?? true,
        requires_document: body.requires_document ?? false,
        is_active: body.is_active ?? true,
      };
    case "custom_fields":
      return { ...base, name: body.name, field_type: body.field_type, options: body.options ?? null, is_active: body.is_active ?? true };
    case "holidays":
      return {
        ...base,
        name: body.name,
        holiday_date: body.holiday_date,
        is_optional: body.is_optional ?? false,
        description: body.description ?? null,
      };
    default:
      return base;
  }
}

export function assertOrgTab(tab: string): OrgTab {
  if (!VALID_TABS.has(tab)) throw new Error("UNKNOWN_TAB");
  return tab as OrgTab;
}

export type OrgDb = SupabaseClient;
