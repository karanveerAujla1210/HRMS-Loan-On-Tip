import "server-only";
import { withApi, jsonOk } from "@/lib/server/http";
import { z } from "zod";
import { adminClient } from "@/lib/server/supabase";
import { mapDatabaseError } from "@/lib/server/errors";

type RouteParams = { id: string };

const HelpdeskTicketSchema = z
  .object({
    category: z.string().trim().min(1).max(30).default("HR"),
    subject: z.string().trim().min(1).max(255),
    description: z.string().max(5000).nullable().optional(),
    priority: z.enum(["LOW", "NORMAL", "HIGH", "URGENT"]).default("NORMAL"),
    idempotency_key: z.string().min(8).max(200).optional(),
  })
  .strict();

export const POST = withApi<typeof HelpdeskTicketSchema, z.ZodTypeAny, RouteParams>({
  requireEmployee: true,
  body: HelpdeskTicketSchema,
  idempotencyEndpoint: "helpdesk/create",
  idempotencyKey: (body) => body.idempotency_key,
  rateLimit: { limit: 20, windowMs: 60_000 },
  handler: async ({ ctx, body, audit, requestId }) => {
    const companyId = ctx.companyId!;
    const db = adminClient();

    const { data, error } = await db
      .from("helpdesk_tickets")
      .insert({
        company_id: companyId,
        employee_id: ctx.employeeId,
        category: body.category,
        subject: body.subject,
        description: body.description ?? null,
        priority: body.priority,
        status: "OPEN",
      })
      .select("id, status")
      .single();
    if (error) throw mapDatabaseError(error);

    await audit({
      action: "HELPDESK_TICKET_CREATE",
      entityType: "helpdesk_tickets",
      entityId: (data as { id: string }).id,
      newValues: { category: body.category, subject: body.subject, priority: body.priority },
    });

    return jsonOk(data, requestId, 201);
  },
});