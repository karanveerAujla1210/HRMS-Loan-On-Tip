import "server-only";
import { withApi, jsonOk } from "@/lib/server/http";
import { z } from "zod";
import { adminClient } from "@/lib/server/supabase";
import { mapDatabaseError, notFound as notFoundError } from "@/lib/server/errors";

type RouteParams = { id: string };

const DocumentCreateSchema = z
  .object({
    document_type_id: z.string().uuid(),
    file_name: z.string().trim().min(1).max(500),
    storage_path: z.string().trim().min(1).max(1000).default("pending-upload"),
    issue_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional(),
    expiry_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional(),
    idempotency_key: z.string().min(8).max(200).optional(),
  })
  .strict();

async function assertEmployeeInCompany(companyId: string, employeeId: string) {
  const db = adminClient();
  const { data, error } = await db
    .from("employees")
    .select("id, company_id")
    .eq("id", employeeId)
    .eq("company_id", companyId)
    .maybeSingle();
  if (error) throw mapDatabaseError(error);
  if (!data) throw notFoundError("Employee not found");
}

export const POST = withApi<typeof DocumentCreateSchema, z.ZodTypeAny, RouteParams>({
  permission: "employee.document.manage",
  body: DocumentCreateSchema,
  idempotencyEndpoint: "people/documents/create",
  idempotencyKey: (body) => body.idempotency_key,
  rateLimit: { limit: 60, windowMs: 60_000 },
  handler: async ({ ctx, body, params, audit, requestId }) => {
    const companyId = ctx.companyId!;
    await assertEmployeeInCompany(companyId, params.id);
    const db = adminClient();

    const { data, error } = await db
      .from("employee_documents")
      .insert({
        employee_id: params.id,
        document_type_id: body.document_type_id,
        file_name: body.file_name,
        storage_path: body.storage_path,
        issue_date: body.issue_date ?? null,
        expiry_date: body.expiry_date ?? null,
        uploaded_by: ctx.employeeId,
        status: "PENDING",
      })
      .select("id")
      .single();
    if (error) throw mapDatabaseError(error);

    await audit({
      action: "DOCUMENT_ADD",
      entityType: "employee_documents",
      entityId: params.id,
      newValues: { file_name: body.file_name, document_type_id: body.document_type_id },
    });

    return jsonOk(data, requestId, 201);
  },
});