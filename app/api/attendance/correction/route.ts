import "server-only";
import { withApi, jsonOk } from "@/lib/server/http";
import { z } from "zod";
import { adminClient } from "@/lib/server/supabase";
import { mapDatabaseError } from "@/lib/server/errors";

const AttendanceCorrectionSchema = z.object({
  attendance_id: z.string().uuid().optional(),
  attendance_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  employee_id: z.string().uuid().optional(),
  new_check_in: z.string().datetime().nullable().optional(),
  check_in_at: z.string().datetime().nullable().optional(),
  new_check_out: z.string().datetime().nullable().optional(),
  check_out_at: z.string().datetime().nullable().optional(),
  reason: z.string().min(1),
  idempotency_key: z.string().min(8).max(200).optional(),
});

export const POST = withApi({
  anyPermission: ["attendance.adjust", "attendance.mark_self"],
  body: AttendanceCorrectionSchema,
  idempotencyEndpoint: "attendance/correction",
  idempotencyKey: (body) => body.idempotency_key,
  rateLimit: { limit: 30, windowMs: 60_000 },
  handler: async ({ ctx, body, audit, requestId }) => {
    const companyId = ctx.companyId!;
    const canAdjust = ctx.permissions.includes("attendance.adjust");
    const db = adminClient();

    const employee_id = canAdjust && body.employee_id ? body.employee_id : ctx.employeeId;
    if (!employee_id) {
      return jsonOk(
        { error: "NO_EMPLOYEE", message: "No employee record linked to this account" },
        requestId,
        400
      );
    }

    let attendanceId: string | null = null;
    if (body.attendance_id) {
      const { data: att } = await db
        .from("attendance")
        .select("id, company_id")
        .eq("id", body.attendance_id)
        .maybeSingle();
      if (att) {
        const attRow = att as { company_id: string; id: string };
        if (attRow.company_id !== companyId) {
          return jsonOk(
            { error: "FORBIDDEN", message: "Attendance belongs to another company" },
            requestId,
            403
          );
        }
        attendanceId = attRow.id;
      }
    }
    if (!attendanceId) {
      const { data: att } = await db
        .from("attendance")
        .select("id")
        .eq("employee_id", employee_id)
        .eq("attendance_date", body.attendance_date)
        .maybeSingle();
      attendanceId = att ? (att as { id: string }).id : null;
    }

    let oldValues: Record<string, unknown> = {};
    if (!attendanceId) {
      const { data: created, error: cErr } = await db
        .from("attendance")
        .insert({
          employee_id,
          company_id: companyId,
          attendance_date: body.attendance_date,
          status: "ABSENT",
          source: "MOBILE",
        })
        .select("id")
        .single();
      if (cErr) throw mapDatabaseError(cErr);
      attendanceId = (created as { id: string }).id;
    } else {
      const { data: cur } = await db
        .from("attendance")
        .select("*")
        .eq("id", attendanceId)
        .maybeSingle();
      oldValues = cur ?? {};
    }

    const newValues = {
      check_in_at: body.new_check_in ?? body.check_in_at ?? null,
      check_out_at: body.new_check_out ?? body.check_out_at ?? null,
    };

    const { data, error } = await db
      .from("attendance_adjustments")
      .insert({
        attendance_id: attendanceId,
        requested_by: ctx.employeeId,
        old_values: oldValues,
        new_values: newValues,
        reason: body.reason,
        status: "PENDING",
      })
      .select("id, status")
      .single();
    if (error) throw mapDatabaseError(error);

    await audit({
      action: "ATTENDANCE_CORRECTION",
      entityType: "attendance_adjustments",
      entityId: (data as { id: string }).id,
      newValues: { reason: body.reason, attendance_date: body.attendance_date },
    });

    return jsonOk(data, requestId, 201);
  },
});
