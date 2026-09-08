import "server-only";
import { withApi, jsonOk } from "@/lib/server/http";
import { z } from "zod";
import { adminClient } from "@/lib/server/supabase";
import { mapDatabaseError, notFound as notFoundError } from "@/lib/server/errors";

type RouteParams = { id: string };

const today = () => new Date().toISOString().slice(0, 10);

const ExitCreateSchema = z
  .object({
    resignation_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
    last_working_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional(),
    reason: z.string().max(2000).nullable().optional(),
    idempotency_key: z.string().min(8).max(200).optional(),
  })
  .strict();

const ExitPatchSchema = z
  .object({
    resignation_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
    last_working_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional(),
    reason: z.string().max(2000).nullable().optional(),
    it_cleared: z.boolean().optional(),
    finance_cleared: z.boolean().optional(),
    hr_cleared: z.boolean().optional(),
    ff_amount: z.number().min(0).nullable().optional(),
    ff_notes: z.string().max(2000).nullable().optional(),
    status: z.enum(["INITIATED", "IN_PROGRESS", "COMPLETED", "CANCELLED"]).optional(),
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

export const POST = withApi<typeof ExitCreateSchema, z.ZodTypeAny, RouteParams>({
  permission: "resignation.manage",
  body: ExitCreateSchema,
  idempotencyEndpoint: "people/exit/create",
  idempotencyKey: (body) => body.idempotency_key,
  rateLimit: { limit: 20, windowMs: 60_000 },
  handler: async ({ ctx, body, params, audit, requestId }) => {
    const companyId = ctx.companyId!;
    await assertEmployeeInCompany(companyId, params.id);
    const db = adminClient();

    const { data: existing } = await db
      .from("resignations")
      .select("id")
      .eq("employee_id", params.id)
      .maybeSingle();
    if (existing) {
      throw mapDatabaseError(
        Object.assign(
          new Error("HRMS:CONFLICT:An exit process is already in progress for this employee."),
          { code: "23505" }
        )
      );
    }

    const { data, error } = await db
      .from("resignations")
      .insert({
        employee_id: params.id,
        resignation_date: body.resignation_date ?? today(),
        last_working_date: body.last_working_date ?? null,
        reason: body.reason ?? null,
        status: "INITIATED",
      })
      .select("id, status")
      .single();
    if (error) throw mapDatabaseError(error);

    await db
      .from("employees")
      .update({
        employment_status: "ON_NOTICE",
        last_working_date: body.last_working_date ?? null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", params.id);

    await audit({
      action: "EXIT_INITIATE",
      entityType: "resignations",
      entityId: (data as { id: string }).id,
      newValues: { employee_id: params.id, status: "INITIATED" },
    });

    return jsonOk(data, requestId, 201);
  },
});

export const PATCH = withApi<typeof ExitPatchSchema, z.ZodTypeAny, RouteParams>({
  permission: "resignation.manage",
  body: ExitPatchSchema,
  rateLimit: { limit: 20, windowMs: 60_000 },
  handler: async ({ ctx, body, params, audit, requestId }) => {
    const companyId = ctx.companyId!;
    await assertEmployeeInCompany(companyId, params.id);
    const db = adminClient();

    const { data: existing, error: exErr } = await db
      .from("resignations")
      .select("id, employee_id, status")
      .eq("employee_id", params.id)
      .maybeSingle();
    if (exErr) throw mapDatabaseError(exErr);
    if (!existing) throw notFoundError("No exit process found for this employee");

    const { resignation_date, last_working_date, reason, it_cleared, finance_cleared, hr_cleared, ff_amount, ff_notes, status } = body;
    const update: Record<string, unknown> = {};
    if (resignation_date !== undefined) update.resignation_date = resignation_date;
    if (last_working_date !== undefined) update.last_working_date = last_working_date;
    if (reason !== undefined) update.reason = reason;
    if (it_cleared !== undefined) update.it_cleared = it_cleared;
    if (finance_cleared !== undefined) update.finance_cleared = finance_cleared;
    if (hr_cleared !== undefined) update.hr_cleared = hr_cleared;
    if (ff_amount !== undefined) update.ff_amount = ff_amount;
    if (ff_notes !== undefined) update.ff_notes = ff_notes;
    if (status !== undefined) {
      update.status = status;
      if (status === "COMPLETED") update.completed_at = new Date().toISOString();
    }
    if (Object.keys(update).length === 0) {
      throw mapDatabaseError(
        Object.assign(new Error("HRMS:VALIDATION_ERROR:No supported fields provided."), { code: "P0001" })
      );
    }

    const { data, error } = await db
      .from("resignations")
      .update(update)
      .eq("employee_id", params.id)
      .select("id, status")
      .single();
    if (error) throw mapDatabaseError(error);

    if (status === "COMPLETED") {
      await db
        .from("employees")
        .update({
          employment_status: "EXITED",
          last_working_date: last_working_date ?? null,
          updated_at: new Date().toISOString(),
        })
        .eq("id", params.id);
    }

    await audit({
      action: status === "COMPLETED" ? "EXIT_COMPLETE" : "EXIT_UPDATE",
      entityType: "resignations",
      entityId: (data as { id: string }).id,
      oldValues: { status: (existing as { status: string }).status },
      newValues: update,
    });

    return jsonOk(data, requestId);
  },
});