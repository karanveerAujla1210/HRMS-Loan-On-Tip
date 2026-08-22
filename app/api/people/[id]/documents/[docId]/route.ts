import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { z } from "zod";
import { createApiClient, getSessionAndProfile, getRole } from "@/lib/api";
import { writeAudit } from "@/lib/audit";

const PatchSchema = z.object({
  is_verified: z.boolean().optional().default(true),
});

export async function PATCH(req: NextRequest, { params }: { params: { id: string; docId: string } }) {
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
    verified_by: profile.employee_id,
    verified_at: new Date().toISOString(),
    status: parsed.data.is_verified ? "VERIFIED" : "REJECTED",
  };

  const { data: updated, error } = await supabase
    .from("employee_documents")
    .update(updatePayload)
    .eq("id", params.docId)
    .eq("employee_id", params.id)
    .select("id,status,verified_at")
    .single();

  if (error || !updated) return NextResponse.json({ error: error?.message ?? "Failed to update document" }, { status: 500 });

  await writeAudit(supabase, {
    company_id: profile.company_id,
    actor_employee_id: profile.employee_id,
    actor_auth_user_id: session.user.id,
    action: parsed.data.is_verified ? "DOCUMENT_VERIFIED" : "DOCUMENT_REJECTED",
    entity_type: "employee_documents",
    entity_id: params.docId,
    new_values: { status: updated.status },
  });

  return NextResponse.json({ data: updated, error: null });
}
