import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { z } from "zod";
import { createApiClient, getSessionAndProfile, getRole } from "@/lib/api";
import { writeAudit } from "@/lib/audit";

const PatchSchema = z.object({
  status: z.enum(["COMPLETED"]).default("COMPLETED"),
  cost: z.coerce.number().optional().nullable(),
  completed_at: z.string().min(1),
  description: z.string().optional().nullable(),
  condition: z.enum(["EXCELLENT", "GOOD", "FAIR"]).default("GOOD"),
});

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const supabase = await createApiClient();
  const { session, profile } = await getSessionAndProfile(supabase);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!profile?.company_id) return NextResponse.json({ error: "Profile not found" }, { status: 404 });
  if (!profile.employee_id) return NextResponse.json({ error: "Employee not found" }, { status: 404 });

  const role = await getRole(supabase, profile.employee_id);
  if (!role || !["SUPER_ADMIN", "HR_ADMIN", "MANAGER"].includes(role)) {
    return NextResponse.json({ error: "Forbidden: insufficient role" }, { status: 403 });
  }

  const parsed = PatchSchema.safeParse(await req.json());
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  const { data: record } = await supabase.from("asset_maintenance").select("id,asset_id,description,status").eq("id", params.id).single();
  if (!record) return NextResponse.json({ error: "Maintenance record not found" }, { status: 404 });

  const fullDesc = record.description ? `${record.description}\n[Resolved]: ${parsed.data.description || ""}` : parsed.data.description;

  const { data: updated, error } = await supabase.from("asset_maintenance").update({
    status: "COMPLETED",
    cost: parsed.data.cost,
    completed_at: parsed.data.completed_at,
    description: fullDesc,
  }).eq("id", params.id).select("id,status").single();

  if (error || !updated) return NextResponse.json({ error: error?.message ?? "Failed to complete maintenance" }, { status: 500 });

  await supabase.from("assets").update({ status: "AVAILABLE", condition: parsed.data.condition }).eq("id", record.asset_id);

  await writeAudit(supabase, {
    company_id: profile.company_id,
    actor_employee_id: profile.employee_id,
    actor_auth_user_id: session.user.id,
    action: "ASSET_MAINTENANCE_COMPLETED",
    entity_type: "asset_maintenance",
    entity_id: params.id,
    new_values: { status: "COMPLETED", cost: parsed.data.cost, condition: parsed.data.condition },
  });

  return NextResponse.json({ data: updated, error: null });
}
