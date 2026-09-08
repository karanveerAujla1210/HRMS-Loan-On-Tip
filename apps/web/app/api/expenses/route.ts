import "server-only";
import { withApi, jsonOk } from "@/lib/server/http";
import { z } from "zod";
import { adminClient } from "@/lib/server/supabase";
import { mapDatabaseError } from "@/lib/server/errors";

const ExpenseSubmitSchema = z.object({
  expense_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  category: z.string().min(1),
  amount: z.number().positive(),
  description: z.string().nullable().optional(),
  receipt_path: z.string().nullable().optional(),
  idempotency_key: z.string().min(8).max(200).optional(),
});

export const POST = withApi({
  permission: "expense.view",
  body: ExpenseSubmitSchema,
  idempotencyEndpoint: "expense/submit",
  idempotencyKey: (body) => body.idempotency_key,
  rateLimit: { limit: 30, windowMs: 60_000 },
  handler: async ({ ctx, body, audit, requestId }) => {
    const companyId = ctx.companyId!;
    const db = adminClient();

    const { data, error } = await db
      .from("expenses")
      .insert({
        employee_id: ctx.employeeId,
        company_id: companyId,
        expense_date: body.expense_date,
        category: body.category,
        amount: body.amount,
        description: body.description ?? null,
        receipt_path: body.receipt_path ?? null,
        status: "SUBMITTED",
        submitted_at: new Date().toISOString(),
      })
      .select("id, status")
      .single();
    if (error) throw mapDatabaseError(error);

    await audit({
      action: "EXPENSE_SUBMIT",
      entityType: "expenses",
      entityId: (data as { id: string }).id,
      newValues: { category: body.category, amount: body.amount },
    });

    return jsonOk(data, requestId, 201);
  },
});
