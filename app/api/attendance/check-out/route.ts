import "server-only";
import { withApi, jsonOk } from "@/lib/server/http";
import { z } from "zod";
import { CheckOutRequestSchema } from "@hrms/api-contract";
import { adminClient } from "@/lib/server/supabase";

export const POST = withApi({
  permission: "attendance.mark_self",
  body: CheckOutRequestSchema,
  idempotencyEndpoint: "attendance/check-out",
  idempotencyKey: (body) => body.idempotency_key,
  rateLimit: { limit: 60, windowMs: 60_000 },
  handler: async ({ req, ctx, body, audit, requestId }) => {
    const employeeId = ctx.employeeId!;
    const nowIso = new Date().toISOString();
    const date = new Date().toISOString().slice(0, 10);

    const db = adminClient();

    const { data: existing, error: findErr } = await db
      .from("attendance")
      .select("id, check_in_at, check_out_at, worked_minutes, break_minutes, late_minutes")
      .eq("employee_id", employeeId)
      .eq("attendance_date", date)
      .maybeSingle();
    if (findErr) throw findErr;
    if (!existing) {
      return jsonOk(
        { error: "NO_CHECK_IN", message: "No check-in found for this date" },
        requestId,
        404
      );
    }
    const existingRec = existing as { check_out_at: string | null; check_in_at: string | null; worked_minutes: number; break_minutes: number; late_minutes: number; id: string };
    if (existingRec.check_out_at) {
      return jsonOk(
        { error: "ALREADY_CHECKED_OUT", message: "You have already checked out for this date" },
        requestId,
        409
      );
    }
    if (!existingRec.check_in_at) {
      return jsonOk(
        { error: "NO_CHECK_IN", message: "No check-in timestamp recorded" },
        requestId,
        400
      );
    }

    const checkIn = existingRec.check_in_at;
    const workedMs = new Date(nowIso).getTime() - new Date(checkIn).getTime();
    const workedMinutes = Math.max(0, Math.round(workedMs / 60_000));
    const breakMinutes = body.break_minutes ?? existingRec.break_minutes ?? 0;
    const netMinutes = Math.max(0, workedMinutes - breakMinutes);

    const { data: statusRes } = await db.rpc("calculate_attendance_status", {
      p_worked_minutes: netMinutes,
      p_late_minutes: existingRec.late_minutes,
    });
    const status = (statusRes as string) ?? "PRESENT";

    const { data, error } = await db
      .from("attendance")
      .update({
        check_out_at: nowIso,
        check_out_latitude: body.latitude ?? null,
        check_out_longitude: body.longitude ?? null,
        check_out_accuracy: body.accuracy_m ?? null,
        worked_minutes: netMinutes,
        break_minutes: breakMinutes,
        status,
        updated_at: nowIso,
      })
      .eq("id", existingRec.id)
      .select("id, attendance_date, check_in_at, check_out_at, worked_minutes, status, late_minutes")
      .single();
    if (error) throw error;

    await db.from("attendance_events").insert({
      attendance_id: existingRec.id,
      employee_id: employeeId,
      event_type: "CHECK_OUT",
      event_at: nowIso,
      latitude: body.latitude ?? null,
      longitude: body.longitude ?? null,
      accuracy: body.accuracy_m ?? null,
      source: body.source,
      device_id: body.device_id ?? null,
      is_mock_location: body.is_mock_location,
    }).then(() => {});

    await audit({
      action: "ATTENDANCE_CHECK_OUT",
      entity_type: "attendance",
      entity_id: existingRec.id,
      new_values: { attendance_date: date, status, worked_minutes: netMinutes, break_minutes: breakMinutes },
    });

    return jsonOk(data, requestId);
  },
});