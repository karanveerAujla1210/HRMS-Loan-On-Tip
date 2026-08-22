import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { z } from "zod";
import { createApiClient, getSessionAndProfile, getRole } from "@/lib/api";
import { writeAudit } from "@/lib/audit";

const PatchSchema = z.object({
  it_cleared: z.boolean().optional(),
  finance_cleared: z.boolean().optional(),
  hr_cleared: z.boolean().optional(),
  ff_amount: z.coerce.number().optional(),
  ff_notes: z.string().optional().nullable(),
  status: z.enum(["SUBMITTED", "IN_PROGRESS", "COMPLETED"]).optional(),
  approved_by: z.string().optional(),
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

  const updatePayload: Record<string, unknown> = {};
  if (parsed.data.it_cleared !== undefined) { updatePayload.it_cleared = parsed.data.it_cleared; updatePayload.it_cleared_by = parsed.data.it_cleared ? profile.employee_id : null; updatePayload.it_cleared_at = parsed.data.it_cleared ? new Date().toISOString() : null; }
  if (parsed.data.finance_cleared !== undefined) { updatePayload.finance_cleared = parsed.data.finance_cleared; updatePayload.finance_cleared_by = parsed.data.finance_cleared ? profile.employee_id : null; updatePayload.finance_cleared_at = parsed.data.finance_cleared ? new Date().toISOString() : null; }
  if (parsed.data.hr_cleared !== undefined) { updatePayload.hr_cleared = parsed.data.hr_cleared; updatePayload.hr_cleared_by = parsed.data.hr_cleared ? profile.employee_id : null; updatePayload.hr_cleared_at = parsed.data.hr_cleared ? new Date().toISOString() : null; }
  if (parsed.data.ff_amount !== undefined) updatePayload.ff_amount = parsed.data.ff_amount;
  if (parsed.data.ff_notes !== undefined) updatePayload.ff_notes = parsed.data.ff_notes;
  if (parsed.data.status !== undefined) updatePayload.status = parsed.data.status;
  if (parsed.data.status === "COMPLETED") { updatePayload.approved_by = profile.employee_id; updatePayload.approved_at = new Date().toISOString(); }

  const { data: updated, error } = await supabase
    .from("resignations")
    .update(updatePayload)
    .eq("employee_id", params.id)
    .select("id,status,it_cleared,finance_cleared,hr_cleared")
    .single();

  if (error || !updated) return NextResponse.json({ error: error?.message ?? "Failed to update resignation" }, { status: 500 });

  if (parsed.data.status === "COMPLETED") {
    await supabase.from("employees").update({ employment_status: "TERMINATED", updated_at: new Date().toISOString() }).eq("id", params.id);
  }

  await writeAudit(supabase, {
    company_id: profile.company_id,
    actor_employee_id: profile.employee_id,
    actor_auth_user_id: session.user.id,
    action: parsed.data.status === "COMPLETED" ? "RESIGNATION_COMPLETED" : "RESIGNATION_UPDATED",
    entity_type: "resignations",
    entity_id: params.id,
    new_values: updatePayload,
  });

  return NextResponse.json({ data: updated, error: null });
}
