import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { z } from "zod";
import { createApiClient, getSessionAndProfile, getRole } from "@/lib/api";
import { writeAudit } from "@/lib/audit";

const PatchSchema = z.object({
  status: z.enum(["RESOLVED", "DISMISSED"]),
  resolution_note: z.string().min(1),
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

  const updatePayload: Record<string, unknown> = {
    status: parsed.data.status,
    resolved_by: profile.employee_id,
    resolved_at: new Date().toISOString(),
    resolution_note: parsed.data.resolution_note,
  };

  const { data: updated, error } = await supabase
    .from("attendance_exceptions")
    .update(updatePayload)
    .eq("id", params.id)
    .select("id,status,resolution_note")
    .single();

  if (error || !updated) return NextResponse.json({ error: error?.message ?? "Failed to resolve exception" }, { status: 500 });

  await writeAudit(supabase, {
    company_id: profile.company_id,
    actor_employee_id: profile.employee_id,
    actor_auth_user_id: session.user.id,
    action: "ATTENDANCE_EXCEPTION_RESOLVED",
    entity_type: "attendance_exceptions",
    entity_id: params.id,
    new_values: { status: updated.status, resolution_note: updated.resolution_note },
  });

  return NextResponse.json({ data: updated, error: null });
}
