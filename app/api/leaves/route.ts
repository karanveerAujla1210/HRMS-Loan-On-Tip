import { route, resolveActor, requirePermission, requireCompany, ok, badRequest, dbError, readJson, serviceClient } from "@/lib/server";
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

type LeaveTypeRow = {
  is_paid: boolean;
  allows_half_day: boolean;
  requires_document: boolean;
  max_consecutive_days: number | null;
};

type DateRange = { from_date: string; to_date: string };

export const POST = route(async (req: Request) => {
  const actor = await resolveActor();
  requirePermission(actor, "leave.apply");
  if (!actor.employeeId) throw badRequest("NO_EMPLOYEE", "No employee record linked to this account");
  const companyId = requireCompany(actor);
  const employeeId = actor.employeeId;

  const body = await readJson(req);
  const leave_type_id = body.leave_type_id ? String(body.leave_type_id) : null;
  const from_date = body.from_date ? String(body.from_date) : null;
  const to_date = body.to_date ? String(body.to_date) : null;
  const half_day_type = body.half_day_type ? String(body.half_day_type) : null;
  const reason = body.reason ? String(body.reason) : null;
  const attachment_document_id = body.attachment_document_id ?? null;

  if (!leave_type_id || !from_date || !to_date) {
    throw badRequest("INVALID_INPUT", "leave_type_id, from_date and to_date are required");
  }
  if (to_date < from_date) {
    throw badRequest("LEAVE_INVALID_RANGE", "to_date must be on or after from_date");
  }

  const db = serviceClient();

  const { data: lt, error: ltErr } = await db
    .from("leave_types")
    .select("is_paid, allows_half_day, requires_document, max_consecutive_days")
    .eq("id", leave_type_id)
    .eq("company_id", companyId)
    .maybeSingle();
  if (ltErr) throw dbError(ltErr);
  if (!lt) throw badRequest("INVALID_INPUT", "Unknown leave type");

  const leaveType = lt as LeaveTypeRow;
  const halfDay = Boolean(half_day_type);
  if (halfDay && from_date !== to_date) {
    throw badRequest("LEAVE_INVALID_RANGE", "Half-day leave must be a single day");
  }

  const total_days = calculateLeaveDays({
    range: { from: from_date, to: to_date },
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
    .eq("leave_type_id", leave_type_id)
    .in("status", ["PENDING", "APPROVED"]);
  if (exErr) throw dbError(exErr);

  const existingRanges = ((existing ?? []) as DateRange[]).map((r) => ({
    from: r.from_date,
    to: r.to_date,
  }));

  const year = Number(from_date.slice(0, 4));
  const { data: balance } = await db
    .from("leave_balances")
    .select("closing_balance")
    .eq("employee_id", employeeId)
    .eq("leave_type_id", leave_type_id)
    .eq("year", year)
    .maybeSingle();
  const available = balance ? Number((balance as { closing_balance: number }).closing_balance) : 0;

  const validationErrors = validateLeaveRequest({
    range: { from: from_date, to: to_date },
    requestedDays: total_days,
    availableBalance: available,
    isPaid: leaveType.is_paid,
    allowsHalfDay: leaveType.allows_half_day,
    halfDay,
    requiresDocument: leaveType.requires_document,
    hasDocument: Boolean(attachment_document_id),
    existingRanges,
    maxConsecutiveDays: leaveType.max_consecutive_days,
  });

  if (validationErrors.length > 0) {
    const code = validationErrors[0];
    throw badRequest(code, ERROR_MESSAGES[code]);
  }

  const { data, error } = await db
    .from("leave_requests")
    .insert({
      employee_id: employeeId,
      leave_type_id,
      from_date,
      to_date,
      total_days,
      half_day_type,
      reason,
      attachment_document_id,
      status: "PENDING",
    })
    .select("id, status, total_days")
    .single();
  if (error) throw dbError(error);

  await writeAudit(db, {
    company_id: companyId,
    actor_employee_id: employeeId,
    actor_auth_user_id: actor.authUserId,
    action: "LEAVE_REQUEST",
    entity_type: "leave_requests",
    entity_id: (data as { id: string }).id,
    new_values: { leave_type_id, from_date, to_date, total_days, half_day_type },
  }).catch(() => {});

  return ok(data, { status: 201 });
});
