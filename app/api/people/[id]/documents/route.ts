import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { z } from "zod";
import { createApiClient, getSessionAndProfile, getRole } from "@/lib/api";
import { writeAudit } from "@/lib/audit";

const PostSchema = z.object({
  document_type_id: z.string().uuid(),
  document_name: z.string().min(1),
  file_path: z.string().min(1),
  file_size: z.coerce.number().int().optional().nullable(),
  mime_type: z.string().optional().nullable(),
  expires_at: z.string().optional().nullable(),
  is_verified: z.boolean().optional().default(false),
});

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const supabase = await createApiClient();
  const { session, profile } = await getSessionAndProfile(supabase);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!profile?.company_id) return NextResponse.json({ error: "Profile not found" }, { status: 404 });
  if (!profile.employee_id) return NextResponse.json({ error: "Employee not found" }, { status: 404 });

  const role = await getRole(supabase, profile.employee_id);
  if (!role || !["SUPER_ADMIN", "HR_ADMIN", "MANAGER", "EMPLOYEE"].includes(role)) {
    return NextResponse.json({ error: "Forbidden: insufficient role" }, { status: 403 });
  }

  const parsed = PostSchema.safeParse(await req.json());
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  const { data: emp } = await supabase
    .from("employees")
    .select("id,company_id")
    .eq("id", params.id)
    .eq("company_id", profile.company_id)
    .single();

  if (!emp) return NextResponse.json({ error: "Employee not found" }, { status: 404 });

  const { data: doc, error } = await supabase.from("employee_documents").insert({
    employee_id: params.id,
    company_id: profile.company_id,
    document_type_id: parsed.data.document_type_id,
    document_name: parsed.data.document_name,
    file_path: parsed.data.file_path,
    file_size: parsed.data.file_size || null,
    mime_type: parsed.data.mime_type || null,
    expires_at: parsed.data.expires_at || null,
    is_verified: parsed.data.is_verified,
    uploaded_by: profile.employee_id,
  }).select("id,document_name,file_path,is_verified").single();

  if (error || !doc) return NextResponse.json({ error: error?.message ?? "Failed to upload document" }, { status: 500 });

  await writeAudit(supabase, {
    company_id: profile.company_id,
    actor_employee_id: profile.employee_id,
    actor_auth_user_id: session.user.id,
    action: "DOCUMENT_UPLOADED",
    entity_type: "employee_documents",
    entity_id: doc.id,
    new_values: { document_name: doc.document_name, file_path: doc.file_path },
  });

  return NextResponse.json({ data: doc, error: null }, { status: 201 });
}
