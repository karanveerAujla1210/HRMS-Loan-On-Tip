import "server-only";
import { withApi, jsonOk } from "@/lib/server/http";
import { z } from "zod";
import { adminClient } from "@/lib/server/supabase";
import { mapDatabaseError, notFound as notFoundError } from "@/lib/server/errors";

type RouteParams = { id: string; docId: string };

const DocumentPatchSchema = z
  .object({
    is_verified: z.literal(true),
  })
  .strict();

export const PATCH = withApi<typeof DocumentPatchSchema, z.ZodTypeAny, RouteParams>({
  permission: "employee.document.manage",
  body: DocumentPatchSchema,
  rateLimit: { limit: 60, windowMs: 60_000 },
  handler: async ({ ctx, params, audit, requestId }) => {
    const companyId = ctx.companyId!;
    const { id, docId } = params;
    const db = adminClient();

    // The document's employee must exist within the caller's company — this
    // prevents cross-company document access by guessing employee/doc ids.
    const { data: emp, error: empErr } = await db
      .from("employees")
      .select("id")
      .eq("id", id)
      .eq("company_id", companyId)
      .maybeSingle();
    if (empErr) throw mapDatabaseError(empErr);
    if (!emp) throw notFoundError("Employee not found");

    const { data: doc, error: docErr } = await db
      .from("employee_documents")
      .select("id, employee_id, status")
      .eq("id", docId)
      .eq("employee_id", id)
      .maybeSingle();
    if (docErr) throw mapDatabaseError(docErr);
    if (!doc) throw notFoundError("Document not found");

    const { data, error } = await db
      .from("employee_documents")
      .update({
        status: "VERIFIED",
        verified_by: ctx.employeeId,
        verified_at: new Date().toISOString(),
      })
      .eq("id", docId)
      .select("id, status")
      .single();
    if (error) throw mapDatabaseError(error);

    await audit({
      action: "DOCUMENT_VERIFY",
      entityType: "employee_documents",
      entityId: docId,
      oldValues: { status: (doc as { status: string }).status },
      newValues: { status: "VERIFIED" },
    });

    return jsonOk(data, requestId);
  },
});