import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { z } from "zod";
import { createApiClient, getSessionAndProfile, getRole } from "@/lib/api";
import { writeAudit } from "@/lib/audit";

const PostSchema = z.object({
  category: z.string().min(1),
  subject: z.string().min(1),
  description: z.string().optional().nullable(),
  priority: z.enum(["LOW", "NORMAL", "HIGH", "URGENT"]).default("NORMAL"),
});

export async function POST(req: NextRequest) {
  const supabase = await createApiClient();
  const { session, profile } = await getSessionAndProfile(supabase);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!profile?.employee_id) return NextResponse.json({ error: "Employee not found" }, { status: 404 });
  if (!profile.company_id) return NextResponse.json({ error: "Company not found" }, { status: 404 });

  const parsed = PostSchema.safeParse(await req.json());
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  const { data: ticket, error } = await supabase.from("helpdesk_tickets").insert({
    company_id: profile.company_id,
    employee_id: profile.employee_id,
    category: parsed.data.category,
    subject: parsed.data.subject,
    description: parsed.data.description || null,
    priority: parsed.data.priority,
    status: "OPEN",
  }).select("id,status,subject").single();

  if (error || !ticket) return NextResponse.json({ error: error?.message ?? "Failed to create ticket" }, { status: 500 });

  await writeAudit(supabase, {
    company_id: profile.company_id,
    actor_employee_id: profile.employee_id,
    actor_auth_user_id: session.user.id,
    action: "HELPDESK_TICKET_CREATED",
    entity_type: "helpdesk_tickets",
    entity_id: ticket.id,
    new_values: { subject: ticket.subject, category: parsed.data.category, priority: parsed.data.priority },
  });

  return NextResponse.json({ data: ticket, error: null }, { status: 201 });
}
