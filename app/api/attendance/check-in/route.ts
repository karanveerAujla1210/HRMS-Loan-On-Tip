import "server-only";
import { withApi, jsonOk } from "@/lib/server/http";
import { z } from "zod";
import { CheckInRequestSchema } from "@hrms/api-contract";
import { mapDatabaseError } from "@/lib/server/errors";
import { writeAudit } from "@/lib/audit";
import { DEFAULT_TIMEZONE } from "@hrms/config";
import {
  evaluateGeoFence,
  parseTimeToMinutes,
  zonedParts,
} from "@hrms/domain";
import { loadCompanySettings, attendancePolicy } from "@/lib/server/settings";
import { adminClient } from "@/lib/server/supabase";

type ShiftRow = {
  start_time: string;
  end_time: string;
  grace_minutes: number;
  break_minutes: number;
  half_day_after_minutes: number;
  full_day_after_minutes: number;
  is_overnight: boolean;
};

type LocationRow = {
  latitude: number | null;
  longitude: number | null;
  attendance_radius_meters: number | null;
  timezone: string | null;
};

export const POST = withApi({
  permission: "attendance.mark_self",
  body: CheckInRequestSchema,
  idempotencyEndpoint: "attendance/check-in",
  idempotencyKey: (body) => body.idempotency_key,
  rateLimit: { limit: 60, windowMs: 60_000 },
  handler: async ({ req, ctx, body, audit, requestId }) => {
    const companyId = ctx.companyId!;
    const employeeId = ctx.employeeId!;
    const nowIso = new Date().toISOString();
    const date = zonedParts(new Date(), ctx.timezone).date;

    const db = adminClient();

    // Mock-location screening
    if (body.is_mock_location) {
      await audit({
        action: "ATTENDANCE_CHECK_IN_REJECTED",
        entityType: "attendance",
        entityId: null,
        newValues: { reason: "MOCK_LOCATION", attendance_date: date },
      });
      return jsonOk(
        { error: "MOCK_LOCATION", message: "Mock location detected. Attendance was not recorded." },
        requestId,
        400
      );
    }

    const settings = await loadCompanySettings(db, companyId);
    const policy = attendancePolicy(settings);

    // Resolve assigned location (geo-fence) and shift
    const { data: emp, error: empErr } = await db
      .from("employees")
      .select("location_id, shift_id")
      .eq("id", employeeId)
      .maybeSingle();
    if (empErr) throw mapDatabaseError(empErr);

    let location: LocationRow | null = null;
    let timezone = ctx.timezone;
    if (emp?.location_id) {
      const { data: loc } = await db
        .from("locations")
        .select("latitude, longitude, attendance_radius_meters, timezone")
        .eq("id", emp.location_id)
        .maybeSingle();
      location = (loc as LocationRow) ?? null;
      if (location?.timezone) timezone = location.timezone;
    }

    let shift: ShiftRow | null = null;
    if (body.shift_id) {
      const { data: sh } = await db
        .from("shifts")
        .select("start_time, end_time, grace_minutes, break_minutes, half_day_after_minutes, full_day_after_minutes, is_overnight")
        .eq("id", body.shift_id)
        .maybeSingle();
      shift = (sh as ShiftRow) ?? null;
    } else if (emp?.shift_id) {
      const { data: sh } = await db
        .from("shifts")
        .select("start_time, end_time, grace_minutes, break_minutes, half_day_after_minutes, full_day_after_minutes, is_overnight")
        .eq("id", emp.shift_id)
        .maybeSingle();
      shift = (sh as ShiftRow) ?? null;
    }

    // Geo-fence evaluation
    let distance_m: number | null = null;
    const exceptions: string[] = [];
    const lat = body.latitude;
    const lon = body.longitude;
    const accuracy = body.accuracy_m;

    if (location?.latitude != null && location?.longitude != null && lat != null && lon != null) {
      const fence = evaluateGeoFence(
        { latitude: lat, longitude: lon },
        { latitude: location.latitude, longitude: location.longitude },
        location.attendance_radius_meters ?? policy.geoRadiusMeters
      );
      distance_m = fence.distanceM;
      if (!fence.withinFence) {
        if (policy.rejectOutsideRadius) {
          await audit({
            action: "ATTENDANCE_CHECK_IN_REJECTED",
            entityType: "attendance",
            entityId: null,
            newValues: { reason: "OUTSIDE_RADIUS", attendance_date: date, distance_m },
          });
          return jsonOk(
            { error: "OUTSIDE_RADIUS", message: "You are outside the permitted office radius." },
            requestId,
            400
          );
        }
        exceptions.push("OUTSIDE_RADIUS");
      }
    }

    // Accuracy screening
    if (accuracy != null && accuracy > policy.maxAccuracyMeters) {
      if (policy.maxAccuracyMeters > 0) {
        await audit({
          action: "ATTENDANCE_CHECK_IN_REJECTED",
          entityType: "attendance",
          entityId: null,
          newValues: { reason: "LOW_ACCURACY", attendance_date: date, accuracy },
        });
        return jsonOk(
          { error: "LOW_ACCURACY", message: "Location accuracy is too low to record attendance." },
          requestId,
          400
        );
      }
      exceptions.push("LOW_ACCURACY");
    }

    // Late computation in the company/location timezone
    let late_minutes = 0;
    let status = "PRESENT";
    if (shift) {
      const shiftStart = parseTimeToMinutes(shift.start_time);
      const { minutesOfDay } = zonedParts(new Date(nowIso), timezone);
      late_minutes = Math.max(0, minutesOfDay - shiftStart);
      status = late_minutes > shift.grace_minutes ? "LATE" : "PRESENT";
    }

    // Upsert attendance (dedupe same-day check-in)
    const { data: existing, error: findErr } = await db
      .from("attendance")
      .select("id, check_in_at")
      .eq("employee_id", employeeId)
      .eq("attendance_date", date)
      .maybeSingle();
    if (findErr) throw mapDatabaseError(findErr);

    let attendanceId: string;
    let saved: { id: string; attendance_date: string; check_in_at: string; status: string };

    if (existing && (existing as { check_in_at: string | null }).check_in_at) {
      await audit({
        action: "ATTENDANCE_CHECK_IN_REJECTED",
        entityType: "attendance",
        entityId: (existing as { id: string }).id,
        newValues: { reason: "ALREADY_CHECKED_IN", attendance_date: date },
      });
      return jsonOk(
        { error: "ALREADY_CHECKED_IN", message: "You have already checked in for this date." },
        requestId,
        409
      );
    }

    if (existing) {
      attendanceId = (existing as { id: string }).id;
      const { data, error } = await db
        .from("attendance")
        .update({
          check_in_at: nowIso,
          check_in_latitude: lat,
          check_in_longitude: lon,
          check_in_accuracy: accuracy,
          late_minutes,
          status,
          source: body.source,
          shift_id: body.shift_id ?? emp?.shift_id ?? null,
          location_id: emp?.location_id ?? null,
          updated_at: nowIso,
        })
        .eq("id", attendanceId)
        .select("id, attendance_date, check_in_at, status")
        .single();
      if (error) throw mapDatabaseError(error);
      saved = data as { id: string; attendance_date: string; check_in_at: string; status: string };
    } else {
      const { data, error } = await db
        .from("attendance")
        .insert({
          employee_id: employeeId,
          company_id: companyId,
          attendance_date: date,
          shift_id: body.shift_id ?? emp?.shift_id ?? null,
          location_id: emp?.location_id ?? null,
          check_in_at: nowIso,
          check_in_latitude: lat,
          check_in_longitude: lon,
          check_in_accuracy: accuracy,
          late_minutes,
          status,
          source: body.source,
        })
        .select("id, attendance_date, check_in_at, status")
        .single();
      if (error) throw mapDatabaseError(error);
      saved = data as { id: string; attendance_date: string; check_in_at: string; status: string };
      attendanceId = saved.id;
    }

    await db
      .from("attendance_events")
      .insert({
        attendance_id: attendanceId,
        employee_id: employeeId,
        event_type: "CHECK_IN",
        event_at: nowIso,
        latitude: lat,
        longitude: lon,
        accuracy,
        source: body.source,
        device_id: body.device_id ?? null,
        is_mock_location: body.is_mock_location,
      })
      .then(() => {});

    await audit({
      action: "ATTENDANCE_CHECK_IN",
      entityType: "attendance",
      entityId: attendanceId,
      newValues: { attendance_date: date, status, late_minutes, distance_m, exceptions, source: body.source },
    });

    return jsonOk(
      {
        attendance_id: saved.id,
        attendance_date: saved.attendance_date,
        status: saved.status,
        check_in_at: saved.check_in_at,
        check_out_at: null,
        late_minutes,
        worked_minutes: 0,
        distance_m,
        server_time: nowIso,
        exceptions,
      },
      requestId,
      existing ? 200 : 201
    );
  },
});