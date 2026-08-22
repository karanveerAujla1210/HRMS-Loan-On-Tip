import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { z } from "zod";
import { createApiClient, getSessionAndProfile, getRole } from "@/lib/api";
import { writeAudit } from "@/lib/audit";

const PatchSchema = z.object({
  action: z.enum(["APPROVED", "REJECTED"]),
  note: z.string().optional().nullable(),
});

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const supabase = await createApiClient();
  const { session, profile } = await getSessionAndProfile(supabase);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!profile?.employee_id) return NextResponse.json({ error: "Employee not found" }, { status: 404 });

  const role = await getRole(supabase, profile.employee_id);
  if (!role || !["SUPER_ADMIN", "HR_ADMIN", "MANAGER"].includes(role)) {
    return NextResponse.json({ error: "Forbidden: insufficient role" }, { status: 403 });
  }

  const parsed = PatchSchema.safeParse(await req.json());
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  const { data: lr } = await supabase
    .from("leave_requests")
    .select("id,employee_id,from_date,to_date,leave_type_id")
    .eq("id", params.id)
    .single();

  if (!lr) return NextResponse.json({ error: "Leave request not found" }, { status: 404 });

  // Use the transactional database function for approval
  if (parsed.data.action === "APPROVED") {
    const { error: rpcErr } = await supabase.rpc("approve_leave_request", {
      p_leave_request_id: params.id,
      p_approver_id: profile.employee_id,
    });
    if (rpcErr) return NextResponse.json({ error: rpcErr.message }, { status: 500 });
  } else {
    await supabase
      .from("leave_requests")
      .update({ status: "REJECTED", updated_at: new Date().toISOString() })
      .eq("id", params.id);

    await supabase.from("leave_approvals").insert({
      leave_request_id: params.id,
      approver_id: profile.employee_id,
      action: "REJECTED",
      approval_level: 1,
      comments: parsed.data.note || null,
    });
  }

  await writeAudit(supabase, {
    company_id: profile.company_id,
    actor_employee_id: profile.employee_id,
    actor_auth_user_id: session.user.id,
    action: `LEAVE_${parsed.data.action}`,
    entity_type: "leave_requests",
    entity_id: params.id,
    new_values: { action: parsed.data.action, note: parsed.data.note },
  });

  return NextResponse.json({ data: { action: parsed.data.action }, error: null });
}
