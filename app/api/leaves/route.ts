import "server-only";
import { withApi, jsonOk } from "@/lib/server/http";
import { z } from "zod";
import { LeaveApplyRequestSchema, LeaveListQuerySchema } from "@hrms/api-contract";
import { mapDatabaseError } from "@/lib/server/errors";
import { adminClient } from "@/lib/server/supabase";
import { writeAudit } from "@/lib/audit";
import {
  calculateLeaveDays,
  validateLeaveRequest,
  type LeaveValidationError,
} from "@hrms/domain";

const ERROR_MESSAGES: Record<LeaveValidationError, string> = {
  LEAVE_INVALID_RANGE: "The leave date range is invalid.",
  LEAVE_OVERLAP: "You already have leave applied for one or more of these dates.",
  LEAVE_INSUFFICIENT_BALANCE: "Insufficient leave balance for this request.",
  LEAVE_HALF_DAY_NOT_ALLOWED: "Half-day leave is not allowed for this leave type.",
  LEAVE_DOCUMENT_REQUIRED: "A supporting document is required for this leave type.",
};

export const GET = withApi({
  permission: "leave.view",
  query: LeaveListQuerySchema,
  handler: async ({ req, ctx, query, requestId }) => {
    const companyId = ctx.companyId!;
    const db = adminClient();

    const page = query.page ?? 1;
    const pageSize = Math.min(query.pageSize ?? 50, 100);
    const from = (page - 1) * pageSize;
    const to = from + pageSize - 1;

    const scope = query.scope ?? "company";
    let employeeIdFilter: string | null | string[] = ctx.employeeId;

    if (scope === "company") {
      employeeIdFilter = null;
    } else if (scope === "team" && ctx.employeeId) {
      const { data: reports } = await db
        .from("employees")
        .select("id")
        .eq("manager_id", ctx.employeeId);
      employeeIdFilter = reports?.map((r) => r.id) ?? [];
    } else if (scope === "self") {
      employeeIdFilter = ctx.employeeId;
    }

    let q = db
      .from("leave_requests")
      .select("*, employees(display_name), leave_types(name)", { count: "exact" })
      .order("submitted_at", { ascending: false })
      .range(from, to);

    if (scope === "company") {
      q = q.eq("company_id", companyId);
    } else if (Array.isArray(employeeIdFilter)) {
      q = q.in("employee_id", employeeIdFilter);
    } else if (employeeIdFilter) {
      q = q.eq("employee_id", employeeIdFilter);
    }

    if (query.status) q = q.eq("status", query.status);
    if (query.employeeId && scope === "company") q = q.eq("employee_id", query.employeeId);
    if (query.from) q = q.gte("from_date", query.from);
    if (query.to) q = q.lte("to_date", query.to);

    const { data, error, count } = await q;
    if (error) throw mapDatabaseError(error);

    return jsonOk(
      {
        data: data ?? [],
        pagination: {
          page,
          page_size: pageSize,
          total: count ?? 0,
          total_pages: Math.ceil((count ?? 0) / pageSize),
        },
      },
      requestId
    );
  },
});

export const POST = withApi({
  permission: "leave.apply",
  body: LeaveApplyRequestSchema,
  idempotencyEndpoint: "leave/apply",
  idempotencyKey: (body) => body.idempotency_key,
  rateLimit: { limit: 30, windowMs: 60_000 },
  handler: async ({ req, ctx, body, audit, requestId }) => {
    const companyId = ctx.companyId!;
    const employeeId = ctx.employeeId!;
    const db = adminClient();

    const { data: lt, error: ltErr } = await db
      .from("leave_types")
      .select("is_paid, allows_half_day, requires_document, max_consecutive_days")
      .eq("id", body.leave_type_id)
      .eq("company_id", companyId)
      .maybeSingle();
    if (ltErr) throw mapDatabaseError(ltErr);
    if (!lt) {
      return jsonOk(
        { error: "INVALID_INPUT", message: "Unknown leave type" },
        requestId,
        400
      );
    }

    const leaveType = lt as { is_paid: boolean; allows_half_day: boolean; requires_document: boolean; max_consecutive_days: number | null };
    const halfDay = Boolean(body.half_day_type);

    const total_days = calculateLeaveDays({
      range: { from: body.from_date, to: body.to_date },
      halfDay,
      holidays: [],
      weeklyOffDates: [],
      excludeNonWorkingDays: false,
    });

    // Overlap against the employee's existing pending/approved requests.
    const { data: existing, error: exErr } = await db
      .from("leave_requests")
      .select("from_date, to_date")
      .eq("employee_id", employeeId)
      .eq("leave_type_id", body.leave_type_id)
      .in("status", ["PENDING", "APPROVED"]);
    if (exErr) throw mapDatabaseError(exErr);

    const existingRanges = ((existing ?? []) as { from_date: string; to_date: string }[]).map((r) => ({
      from: r.from_date,
      to: r.to_date,
    }));

    const year = Number(body.from_date.slice(0, 4));
    const { data: balance } = await db
      .from("leave_balances")
      .select("closing_balance")
      .eq("employee_id", employeeId)
      .eq("leave_type_id", body.leave_type_id)
      .eq("year", year)
      .maybeSingle();
    const available = balance ? Number((balance as { closing_balance: number }).closing_balance) : 0;

    const validationErrors = validateLeaveRequest({
      range: { from: body.from_date, to: body.to_date },
      requestedDays: total_days,
      availableBalance: available,
      isPaid: leaveType.is_paid,
      allowsHalfDay: leaveType.allows_half_day,
      halfDay,
      requiresDocument: leaveType.requires_document,
      hasDocument: Boolean(body.attachment_document_id),
      existingRanges,
      maxConsecutiveDays: leaveType.max_consecutive_days,
    });

    if (validationErrors.length > 0) {
      const code = validationErrors[0];
      if (code && code in ERROR_MESSAGES) {
        return jsonOk(
          { error: code, message: ERROR_MESSAGES[code as keyof typeof ERROR_MESSAGES] },
          requestId,
          400
        );
      }
    }

    const { data, error } = await db
      .from("leave_requests")
      .insert({
        employee_id: employeeId,
        leave_type_id: body.leave_type_id,
        from_date: body.from_date,
        to_date: body.to_date,
        total_days,
        half_day_type: body.half_day_type ?? null,
        reason: body.reason,
        attachment_document_id: body.attachment_document_id ?? null,
        status: "PENDING",
      })
      .select("id, status, total_days")
      .single();
    if (error) throw mapDatabaseError(error);

    await audit({
      action: "LEAVE_REQUEST",
      entityType: "leave_requests",
      entityId: data.id,
      newValues: { leave_type_id: body.leave_type_id, from_date: body.from_date, to_date: body.to_date, total_days, half_day_type: body.half_day_type },
    });

    return jsonOk(data, requestId, 201);
  },
});