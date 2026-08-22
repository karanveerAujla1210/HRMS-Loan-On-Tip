import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { z } from "zod";
import { createApiClient, getSessionAndProfile, getRole } from "@/lib/api";
import { writeAudit } from "@/lib/audit";

const ApplySchema = z.object({
  leave_type_id: z.string().uuid(),
  from_date: z.string(),
  to_date: z.string(),
  reason: z.string().optional().nullable(),
});

export async function POST(req: NextRequest) {
  const supabase = await createApiClient();
  const { session, profile } = await getSessionAndProfile(supabase);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!profile?.employee_id) return NextResponse.json({ error: "Employee not found" }, { status: 404 });

  const parsed = ApplySchema.safeParse(await req.json());
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  const fromDate = parsed.data.from_date;
  const toDate = parsed.data.to_date;
  const totalDays = Math.max(1, Math.round((new Date(toDate).getTime() - new Date(fromDate).getTime()) / 86400000) + 1);

  const { data: lr, error } = await supabase
    .from("leave_requests")
    .insert({
      employee_id: profile.employee_id,
      leave_type_id: parsed.data.leave_type_id,
      from_date: fromDate,
      to_date: toDate,
      total_days: totalDays,
      reason: parsed.data.reason || null,
      status: "PENDING",
    })
    .select("id")
    .single();

  if (error || !lr) return NextResponse.json({ error: error?.message ?? "Failed to submit leave" }, { status: 500 });

  await writeAudit(supabase, {
    company_id: profile.company_id,
    actor_employee_id: profile.employee_id,
    actor_auth_user_id: session.user.id,
    action: "LEAVE_APPLIED",
    entity_type: "leave_requests",
    entity_id: lr.id,
    new_values: { leave_type_id: parsed.data.leave_type_id, from_date: fromDate, to_date: toDate, total_days: totalDays },
  });

  return NextResponse.json({ data: { id: lr.id }, error: null }, { status: 201 });
}
