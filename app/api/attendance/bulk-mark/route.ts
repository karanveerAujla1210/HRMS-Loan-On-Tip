import "server-only";
import { withApi, jsonOk } from "@/lib/server/http";
import { z } from "zod";
import { adminClient } from "@/lib/server/supabase";
import { writeAudit } from "@/lib/audit";
import { mapDatabaseError } from "@/lib/server/errors";

const BulkMarkSchema = z.object({
  from_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  to_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  status: z.enum(["PRESENT", "ABSENT", "LATE", "HALF_DAY", "ON_LEAVE", "HOLIDAY", "WEEKLY_OFF"]).default("PRESENT"),
  employee_ids: z.array(z.string().uuid()).optional(),
  idempotency_key: z.string().min(8).max(200).optional(),
});

export const POST = withApi({
  permission: "attendance.approve",
  body: BulkMarkSchema,
  idempotencyEndpoint: "attendance/bulk-mark",
  idempotencyKey: (body) => body.idempotency_key,
  rateLimit: { limit: 5, windowMs: 60_000 },
  handler: async ({ req, ctx, body, audit, requestId }) => {
    const companyId = ctx.companyId!;
    const db = adminClient();

    if (body.to_date < body.from_date) {
      return jsonOk(
        { error: "INVALID_INPUT", message: "to_date must be on or after from_date" },
        requestId,
        400
      );
    }

    let targetEmployees: string[];
    if (body.employee_ids && body.employee_ids.length > 0) {
      targetEmployees = body.employee_ids;
    } else {
      const { data: emps, error: empErr } = await db
        .from("employees")
        .select("id")
        .eq("company_id", companyId)
        .eq("employment_status", "ACTIVE");
      if (empErr) throw mapDatabaseError(empErr);
      targetEmployees = ((emps ?? []) as { id: string }[]).map((e) => e.id);
    }

    if (targetEmployees.length === 0) {
      return jsonOk(
        { marked: 0, from_date: body.from_date, to_date: body.to_date, status: body.status, message: "No employees matched." },
        requestId
      );
    }

    const start = new Date(`${body.from_date}T00:00:00Z`);
    const end = new Date(`${body.to_date}T00:00:00Z`);
    const dates: string[] = [];
    for (let d = new Date(start); d <= end; d = new Date(d.getTime() + 86_400_000)) {
      dates.push(d.toISOString().slice(0, 10));
    }

    const nowIso = new Date().toISOString();
    const rowsToUpsert: Record<string, unknown>[] = [];
    for (const employeeId of targetEmployees) {
      for (const date of dates) {
        const workedMinutes = body.status === "PRESENT" ? 480 : body.status === "HALF_DAY" ? 240 : 0;
        rowsToUpsert.push({
          employee_id: employeeId,
          company_id: companyId,
          attendance_date: date,
          status: body.status,
          source: "ADMIN",
          is_manual_adjustment: true,
          approved_by: ctx.employeeId,
          approved_at: nowIso,
          worked_minutes: workedMinutes,
        });
      }
    }

    const { error } = await db
      .from("attendance")
      .upsert(rowsToUpsert, { onConflict: "employee_id,attendance_date" });

    if (error) throw mapDatabaseError(error);

    const marked = rowsToUpsert.length;

    await audit({
      action: "ATTENDANCE_BULK_MARK",
      entityType: "attendance",
      entityId: null,
      newValues: { from_date: body.from_date, to_date: body.to_date, status: body.status, employee_count: targetEmployees.length, marked },
    });

    return jsonOk({ marked, from_date: body.from_date, to_date: body.to_date, status: body.status }, requestId);
  },
});