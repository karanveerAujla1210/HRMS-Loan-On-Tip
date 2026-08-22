import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { z } from "zod";
import { createApiClient, getSessionAndProfile, getRole } from "@/lib/api";
import { writeAudit } from "@/lib/audit";

const PostSchema = z.object({
  asset_category_id: z.string().uuid(),
  location_id: z.string().uuid().optional().nullable(),
  asset_tag: z.string().optional().nullable(),
  model: z.string().optional().nullable(),
  serial_number: z.string().optional().nullable(),
  imei_1: z.string().optional().nullable(),
  mobile_number: z.string().optional().nullable(),
  sim_number: z.string().optional().nullable(),
  condition: z.string().default("GOOD"),
  vendor_name: z.string().optional().nullable(),
  invoice_number: z.string().optional().nullable(),
  purchase_date: z.string().optional().nullable(),
  purchase_cost: z.coerce.number().optional().nullable(),
  warranty_end: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),
});

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

  const parsed = PostSchema.safeParse(await req.json());
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  const { data: category } = await supabase
    .from("asset_categories")
    .select("prefix")
    .eq("id", parsed.data.asset_category_id)
    .single();

  if (!category) return NextResponse.json({ error: "Invalid asset category" }, { status: 400 });

  const prefix = String(category.prefix ?? "AST").toUpperCase();
  const { data: codeData, error: codeErr } = await supabase.rpc("generate_asset_code", { p_prefix: prefix });
  if (codeErr || !codeData) return NextResponse.json({ error: "Failed to generate asset code" }, { status: 500 });

  const { data: asset, error } = await supabase.from("assets").insert({
    company_id: profile.company_id,
    asset_category_id: parsed.data.asset_category_id,
    location_id: parsed.data.location_id || null,
    asset_code: String(codeData),
    asset_tag: parsed.data.asset_tag || null,
    model: parsed.data.model || null,
    serial_number: parsed.data.serial_number || null,
    imei_1: parsed.data.imei_1 || null,
    mobile_number: parsed.data.mobile_number || null,
    sim_number: parsed.data.sim_number || null,
    condition: parsed.data.condition,
    vendor_name: parsed.data.vendor_name || null,
    invoice_number: parsed.data.invoice_number || null,
    purchase_date: parsed.data.purchase_date || null,
    purchase_cost: parsed.data.purchase_cost || null,
    warranty_end: parsed.data.warranty_end || null,
    notes: parsed.data.notes || null,
    status: "AVAILABLE",
  }).select("id,asset_code,asset_tag,model,status").single();

  if (error || !asset) return NextResponse.json({ error: error?.message ?? "Failed to create asset" }, { status: 500 });

  await writeAudit(supabase, {
    company_id: profile.company_id,
    actor_employee_id: profile.employee_id,
    actor_auth_user_id: session.user.id,
    action: "ASSET_CREATED",
    entity_type: "assets",
    entity_id: asset.id,
    new_values: { asset_code: asset.asset_code, model: asset.model },
  });

  return NextResponse.json({ data: asset, error: null }, { status: 201 });
}
