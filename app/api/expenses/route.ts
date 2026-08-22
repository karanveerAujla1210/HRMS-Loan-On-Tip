import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { z } from "zod";
import { createApiClient, getSessionAndProfile, getRole } from "@/lib/api";
import { writeAudit } from "@/lib/audit";

const PostSchema = z.object({
  expense_date: z.string().min(1),
  category: z.string().min(1),
  amount: z.coerce.number(),
  description: z.string().optional().nullable(),
  receipt_path: z.string().optional().nullable(),
});

export async function POST(req: NextRequest) {
  const supabase = await createApiClient();
  const { session, profile } = await getSessionAndProfile(supabase);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!profile?.employee_id) return NextResponse.json({ error: "Employee not found" }, { status: 404 });
  if (!profile.company_id) return NextResponse.json({ error: "Company not found" }, { status: 404 });

  const parsed = PostSchema.safeParse(await req.json());
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  const { data: expense, error } = await supabase.from("expenses").insert({
    company_id: profile.company_id,
    employee_id: profile.employee_id,
    expense_date: parsed.data.expense_date,
    category: parsed.data.category,
    amount: parsed.data.amount,
    description: parsed.data.description || null,
    receipt_path: parsed.data.receipt_path || null,
    status: "PENDING",
  }).select("id,status,amount").single();

  if (error || !expense) return NextResponse.json({ error: error?.message ?? "Failed to submit expense" }, { status: 500 });

  await writeAudit(supabase, {
    company_id: profile.company_id,
    actor_employee_id: profile.employee_id,
    actor_auth_user_id: session.user.id,
    action: "EXPENSE_SUBMITTED",
    entity_type: "expenses",
    entity_id: expense.id,
    new_values: { amount: expense.amount, category: parsed.data.category },
  });

  return NextResponse.json({ data: expense, error: null }, { status: 201 });
}
