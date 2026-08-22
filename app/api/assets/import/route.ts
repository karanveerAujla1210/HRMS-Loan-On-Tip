import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { z } from "zod";
import { createApiClient, getSessionAndProfile, getRole } from "@/lib/api";
import { writeAudit } from "@/lib/audit";

const AssetRowSchema = z.object({
  category: z.string().min(1),
  model: z.string().min(1),
  serial_number: z.string().optional().nullable(),
  asset_tag: z.string().optional().nullable(),
  imei_1: z.string().optional().nullable(),
  imei_2: z.string().optional().nullable(),
  mobile_number: z.string().optional().nullable(),
  sim_number: z.string().optional().nullable(),
  brand: z.string().optional().nullable(),
  purchase_date: z.string().optional().nullable(),
  purchase_cost: z.coerce.number().optional().nullable(),
  warranty_end: z.string().optional().nullable(),
  vendor_name: z.string().optional().nullable(),
  invoice_number: z.string().optional().nullable(),
  location: z.string().optional().nullable(),
  condition: z.string().optional().default("GOOD"),
  notes: z.string().optional().nullable(),
});

const ImportSchema = z.object({ assets: z.array(AssetRowSchema).min(1).max(500) });

export async function POST(req: NextRequest) {
  const supabase = await createApiClient();
  const { session, profile } = await getSessionAndProfile(supabase);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!profile?.company_id) return NextResponse.json({ error: "Profile not found" }, { status: 404 });
  if (!profile.employee_id) return NextResponse.json({ error: "Employee not found" }, { status: 404 });

  const role = await getRole(supabase, profile.employee_id);
  if (!role || !["SUPER_ADMIN", "HR_ADMIN", "MANAGER"].includes(role)) {
    return NextResponse.json({ error: "Forbidden: insufficient role" }, { status: 403 });
  }

  const parsed = ImportSchema.safeParse(await req.json());
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  const companyId = profile.company_id;

  const [catRes, locRes] = await Promise.all([
    supabase.from("asset_categories").select("id,name,prefix").eq("company_id", companyId).eq("is_active", true),
    supabase.from("locations").select("id,name").eq("company_id", companyId).eq("is_active", true),
  ]);

  const catMap = Object.fromEntries((catRes.data ?? []).map((c: { id: string; name: string; prefix: string }) => [c.name.toLowerCase().trim(), { id: c.id, prefix: c.prefix }]));
  const locMap = Object.fromEntries((locRes.data ?? []).map((l: { id: string; name: string }) => [l.name.toLowerCase().trim(), l.id]));

  let success = 0, failed = 0;
  const failedRows: string[] = [];

  for (const row of parsed.data.assets) {
    const catKey = row.category.toLowerCase().trim();
    const cat = catMap[catKey];
    if (!cat) { failedRows.push(`${row.model} — category not found`); failed++; continue; }

    const { data: codeData, error: codeErr } = await supabase.rpc("generate_asset_code", { p_prefix: String(cat.prefix ?? "AST").toUpperCase() });
    if (codeErr || !codeData) { failedRows.push(`${row.model} — code generation failed`); failed++; continue; }

    const { error } = await supabase.from("assets").insert({
      company_id: companyId,
      asset_code: String(codeData),
      asset_category_id: cat.id,
      location_id: row.location ? (locMap[row.location.toLowerCase().trim()] ?? null) : null,
      model: row.model || null,
      serial_number: row.serial_number || null,
      asset_tag: row.asset_tag || null,
      imei_1: row.imei_1 || null,
      imei_2: row.imei_2 || null,
      mobile_number: row.mobile_number || null,
      sim_number: row.sim_number || null,
      purchase_date: row.purchase_date || null,
      purchase_cost: row.purchase_cost || null,
      warranty_end: row.warranty_end || null,
      vendor_name: row.vendor_name || null,
      invoice_number: row.invoice_number || null,
      condition: row.condition || "GOOD",
      notes: row.notes || null,
      status: "AVAILABLE",
    });

    if (error) {
      failedRows.push(`${row.model} (${row.serial_number || "no serial"}) — ${error.message}`);
      failed++;
    } else {
      success++;
    }
  }

  await writeAudit(supabase, {
    company_id: profile.company_id,
    actor_employee_id: profile.employee_id,
    actor_auth_user_id: session.user.id,
    action: "ASSET_BULK_IMPORT",
    entity_type: "assets",
    new_values: { success, failed, total: parsed.data.assets.length },
  });

  return NextResponse.json({ success, failed, failedRows, total: parsed.data.assets.length });
}
