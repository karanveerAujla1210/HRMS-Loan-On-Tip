import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { z } from "zod";
import { createApiClient, getSessionAndProfile, getRole } from "@/lib/api";
import { writeAudit } from "@/lib/audit";

const PatchSchema = z.object({
  action: z.enum(["APPROVED", "REJECTED"]),
});

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const supabase = await createApiClient();
  const { session, profile } = await getSessionAndProfile(supabase);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!profile?.company_id) return NextResponse.json({ error: "Profile not found" }, { status: 404 });
  if (!profile.employee_id) return NextResponse.json({ error: "Employee not found" }, { status: 404 });

  const role = await getRole(supabase, profile.employee_id);
  if (!role || !["SUPER_ADMIN", "HR_ADMIN", "FINANCE_ADMIN"].includes(role)) {
    return NextResponse.json({ error: "Forbidden: insufficient role" }, { status: 403 });
  }

  const parsed = PatchSchema.safeParse(await req.json());
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  const { data: run } = await supabase
    .from("payroll_runs")
    .select("id,status,company_id")
    .eq("id", params.id)
    .eq("company_id", profile.company_id)
    .single();

  if (!run) return NextResponse.json({ error: "Payroll run not found" }, { status: 404 });
  if (run.status !== "CALCULATED") return NextResponse.json({ error: "Only CALCULATED runs can be approved" }, { status: 400 });

  const newStatus = parsed.data.action === "APPROVED" ? "APPROVED" : "DRAFT";

  const { error: updateErr } = await supabase
    .from("payroll_runs")
    .update({
      status: newStatus,
      approved_by: profile.employee_id,
      approved_at: new Date().toISOString(),
    })
    .eq("id", params.id);

  if (updateErr) return NextResponse.json({ error: updateErr.message }, { status: 500 });

  await writeAudit(supabase, {
    company_id: profile.company_id,
    actor_employee_id: profile.employee_id,
    actor_auth_user_id: session.user.id,
    action: `PAYROLL_RUN_${parsed.data.action}`,
    entity_type: "payroll_runs",
    entity_id: params.id,
    new_values: { status: newStatus },
  });

  return NextResponse.json({ data: { status: newStatus }, error: null });
}
