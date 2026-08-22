import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { z } from "zod";
import { createApiClient, getSessionAndProfile, getRole } from "@/lib/api";
import { writeAudit } from "@/lib/audit";

const PostSchema = z.object({
  asset_id: z.string().uuid(),
  maintenance_type: z.string().min(1),
  vendor: z.string().optional().nullable(),
  started_at: z.string().optional().nullable(),
  cost: z.coerce.number().optional().nullable(),
  description: z.string().min(1),
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

  const { data: asset } = await supabase.from("assets").select("id,company_id").eq("id", parsed.data.asset_id).single();
  if (!asset || asset.company_id !== profile.company_id) {
    return NextResponse.json({ error: "Asset not found" }, { status: 404 });
  }

  const { data: record, error } = await supabase.from("asset_maintenance").insert({
    asset_id: parsed.data.asset_id,
    maintenance_type: parsed.data.maintenance_type,
    vendor: parsed.data.vendor || null,
    started_at: parsed.data.started_at || new Date().toISOString().slice(0, 10),
    cost: parsed.data.cost || null,
    description: parsed.data.description,
    status: "IN_PROGRESS",
    created_by: profile.employee_id,
  }).select("id,status,asset_id").single();

  if (error || !record) return NextResponse.json({ error: error?.message ?? "Failed to log maintenance" }, { status: 500 });

  await supabase.from("assets").update({ status: "UNDER_REPAIR" }).eq("id", parsed.data.asset_id);

  await writeAudit(supabase, {
    company_id: profile.company_id,
    actor_employee_id: profile.employee_id,
    actor_auth_user_id: session.user.id,
    action: "ASSET_MAINTENANCE_LOGGED",
    entity_type: "asset_maintenance",
    entity_id: record.id,
    new_values: { asset_id: parsed.data.asset_id, maintenance_type: parsed.data.maintenance_type, cost: parsed.data.cost },
  });

  return NextResponse.json({ data: record, error: null }, { status: 201 });
}
