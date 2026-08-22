import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { z } from "zod";
import { createApiClient, getSessionAndProfile, getRole } from "@/lib/api";
import { writeAudit } from "@/lib/audit";

const RepairSchema = z.object({
  maintenance_type: z.string().min(1),
  vendor: z.string().optional().nullable(),
  cost: z.coerce.number().min(0).optional().nullable(),
  description: z.string().min(1),
});

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const supabase = await createApiClient();
  const { session, profile } = await getSessionAndProfile(supabase);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!profile?.company_id) return NextResponse.json({ error: "Profile not found" }, { status: 404 });
  if (!profile.employee_id) return NextResponse.json({ error: "Employee not found" }, { status: 404 });

  const role = await getRole(supabase, profile.employee_id);
  if (!role || !["SUPER_ADMIN", "HR_ADMIN", "OPERATIONS_ADMIN", "ASSET_ADMIN"].includes(role)) {
    return NextResponse.json({ error: "Forbidden: insufficient role" }, { status: 403 });
  }

  const parsed = RepairSchema.safeParse(await req.json());
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  const { error: maintErr } = await supabase.from("asset_maintenance").insert({
    asset_id: params.id,
    maintenance_type: parsed.data.maintenance_type,
    vendor: parsed.data.vendor,
    started_at: new Date().toISOString().slice(0, 10),
    cost: parsed.data.cost,
    description: parsed.data.description,
    status: "IN_PROGRESS",
    created_by: profile.employee_id,
  });

  if (maintErr) return NextResponse.json({ error: maintErr.message }, { status: 500 });

  await supabase.from("assets").update({ status: "UNDER_REPAIR" }).eq("id", params.id);

  await writeAudit(supabase, {
    company_id: profile.company_id,
    actor_employee_id: profile.employee_id,
    actor_auth_user_id: session.user.id,
    action: "ASSET_SENT_TO_REPAIR",
    entity_type: "asset_maintenance",
    entity_id: params.id,
    new_values: { asset_id: params.id, maintenance_type: parsed.data.maintenance_type },
  });

  return NextResponse.json({ data: { message: "Asset sent for repair" }, error: null }, { status: 201 });
}
