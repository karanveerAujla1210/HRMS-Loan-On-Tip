import type { AttendanceStatus } from "@hrms/api-contract";

/* ────────────────────────────────────────────────────────────────────────────
 * Geo
 * ──────────────────────────────────────────────────────────────────────────── */

export type GeoPoint = { latitude: number; longitude: number };

const EARTH_RADIUS_M = 6_371_000;
const toRadians = (deg: number) => (deg * Math.PI) / 180;

/** Great-circle distance between two coordinates, in metres. */
export function haversineMeters(a: GeoPoint, b: GeoPoint): number {
  const dLat = toRadians(b.latitude - a.latitude);
  const dLon = toRadians(b.longitude - a.longitude);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRadians(a.latitude)) *
      Math.cos(toRadians(b.latitude)) *
      Math.sin(dLon / 2) ** 2;
  return Math.round(EARTH_RADIUS_M * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h)));
}

export type GeoFenceResult = {
  distanceM: number;
  withinFence: boolean;
};

export function evaluateGeoFence(
  actual: GeoPoint,
  fenceCentre: GeoPoint,
  radiusM: number
): GeoFenceResult {
  const distanceM = haversineMeters(actual, fenceCentre);
  return { distanceM, withinFence: distanceM <= radiusM };
}

/* ────────────────────────────────────────────────────────────────────────────
 * Time helpers — all attendance maths is done in the company timezone
 * ──────────────────────────────────────────────────────────────────────────── */

/** Parses `HH:MM` or `HH:MM:SS` into minutes since midnight. */
export function parseTimeToMinutes(time: string): number {
  const match = /^(\d{1,2}):(\d{2})(?::(\d{2}))?$/.exec(time.trim());
  if (!match) throw new Error(`Invalid time literal: ${time}`);
  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  if (hours > 23 || minutes > 59) throw new Error(`Invalid time literal: ${time}`);
  return hours * 60 + minutes;
}

/**
 * Returns the wall-clock parts of an instant in a given IANA timezone.
 * Uses Intl so no timezone database is bundled.
 */
export function zonedParts(
  instant: Date,
  timeZone: string
): { date: string; minutesOfDay: number; weekday: number } {
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
    weekday: "short",
  });
  const parts = formatter.formatToParts(instant);
  const pick = (type: string) => parts.find((p) => p.type === type)?.value ?? "";
  const year = pick("year");
  const month = pick("month");
  const day = pick("day");
  const hour = Number(pick("hour") === "24" ? "0" : pick("hour"));
  const minute = Number(pick("minute"));
  const weekdayMap: Record<string, number> = {
    Sun: 0,
    Mon: 1,
    Tue: 2,
    Wed: 3,
    Thu: 4,
    Fri: 5,
    Sat: 6,
  };
  return {
    date: `${year}-${month}-${day}`,
    minutesOfDay: hour * 60 + minute,
    weekday: weekdayMap[pick("weekday")] ?? 0,
  };
}

/** Business date (YYYY-MM-DD) of an instant in the company timezone. */
export function businessDate(instant: Date, timeZone: string): string {
  return zonedParts(instant, timeZone).date;
}

export function minutesBetween(from: Date, to: Date): number {
  return Math.max(0, Math.floor((to.getTime() - from.getTime()) / 60_000));
}

/* ────────────────────────────────────────────────────────────────────────────
 * Attendance engine
 * ──────────────────────────────────────────────────────────────────────────── */

export type ShiftConfig = {
  /** `HH:MM` local shift start. */
  startTime: string;
  /** `HH:MM` local shift end. */
  endTime: string;
  graceMinutes: number;
  breakMinutes: number;
  halfDayAfterMinutes: number;
  fullDayAfterMinutes: number;
  isOvernight: boolean;
};

export type DayContext = {
  isHoliday: boolean;
  isWeeklyOff: boolean;
  /** Employee has approved leave covering this date. */
  onApprovedLeave: boolean;
  /** Approved leave covers only half of the day. */
  halfDayLeave?: boolean;
};

export type PunchInput = {
  /** Server-authoritative check-in instant. */
  checkInAt: Date | null;
  /** Server-authoritative check-out instant. */
  checkOutAt: Date | null;
  timeZone: string;
  shift: ShiftConfig;
};

/** Minutes late relative to shift start plus grace. Never negative. */
export function computeLateMinutes(
  checkInAt: Date,
  shift: ShiftConfig,
  timeZone: string
): number {
  const { minutesOfDay } = zonedParts(checkInAt, timeZone);
  const shiftStart = parseTimeToMinutes(shift.startTime);
  return Math.max(0, minutesOfDay - shiftStart);
}

/** Minutes worked between the punches, less the configured break. */
export function computeWorkedMinutes(
  checkInAt: Date,
  checkOutAt: Date,
  breakMinutes: number
): number {
  return Math.max(0, minutesBetween(checkInAt, checkOutAt) - Math.max(0, breakMinutes));
}

/** Minutes left before shift end when checking out early. */
export function computeEarlyExitMinutes(
  checkOutAt: Date,
  shift: ShiftConfig,
  timeZone: string
): number {
  const { minutesOfDay } = zonedParts(checkOutAt, timeZone);
  const shiftEnd = parseTimeToMinutes(shift.endTime);
  if (shift.isOvernight) return 0;
  return Math.max(0, shiftEnd - minutesOfDay);
}

/**
 * Single source of truth for a day's attendance status.
 *
 * Precedence: holiday → weekly off → approved leave → punches.
 * A day with an approved leave is never ABSENT. A day with a check-in but no
 * check-out is MISSING_PUNCH after close, PRESENT/LATE while still open.
 */
export function deriveAttendanceStatus(input: {
  punch: PunchInput;
  day: DayContext;
  /** True once the day has been closed by the daily-close job. */
  dayClosed?: boolean;
}): { status: AttendanceStatus; lateMinutes: number; workedMinutes: number } {
  const { punch, day, dayClosed = false } = input;
  const { checkInAt, checkOutAt, shift, timeZone } = punch;

  const lateMinutes = checkInAt ? computeLateMinutes(checkInAt, shift, timeZone) : 0;
  const workedMinutes =
    checkInAt && checkOutAt
      ? computeWorkedMinutes(checkInAt, checkOutAt, shift.breakMinutes)
      : 0;

  if (!checkInAt) {
    if (day.isHoliday) return { status: "HOLIDAY", lateMinutes: 0, workedMinutes: 0 };
    if (day.isWeeklyOff) return { status: "WEEKLY_OFF", lateMinutes: 0, workedMinutes: 0 };
    if (day.onApprovedLeave) return { status: "ON_LEAVE", lateMinutes: 0, workedMinutes: 0 };
    return { status: dayClosed ? "ABSENT" : "ABSENT", lateMinutes: 0, workedMinutes: 0 };
  }

  // The employee physically worked, so holiday/weekly-off/leave no longer
  // decide the status — the punches do.
  if (!checkOutAt) {
    const status: AttendanceStatus = dayClosed
      ? "MISSING_PUNCH"
      : lateMinutes > shift.graceMinutes
        ? "LATE"
        : "PRESENT";
    return { status, lateMinutes, workedMinutes: 0 };
  }

  if (workedMinutes < shift.halfDayAfterMinutes) {
    return { status: "HALF_DAY", lateMinutes, workedMinutes };
  }
  if (day.halfDayLeave) {
    return { status: "HALF_DAY", lateMinutes, workedMinutes };
  }
  if (lateMinutes > shift.graceMinutes) {
    return { status: "LATE", lateMinutes, workedMinutes };
  }
  return { status: "PRESENT", lateMinutes, workedMinutes };
}

/** Payable day weight of an attendance status, used by payroll. */
export function payableDayWeight(status: AttendanceStatus): number {
  switch (status) {
    case "PRESENT":
    case "LATE":
    case "WORK_FROM_HOME":
    case "ON_DUTY":
    case "HOLIDAY":
    case "WEEKLY_OFF":
      return 1;
    case "HALF_DAY":
      return 0.5;
    case "ON_LEAVE":
    case "LEAVE":
      // Paid/unpaid is resolved from the leave type, not the attendance status.
      return 1;
    case "ABSENT":
    case "MISSING_PUNCH":
      return 0;
    default:
      return 0;
  }
}

/* ────────────────────────────────────────────────────────────────────────────
 * Leave engine
 * ──────────────────────────────────────────────────────────────────────────── */

export type DateRange = { from: string; to: string };

export function eachDate(range: DateRange): string[] {
  const out: string[] = [];
  const start = new Date(`${range.from}T00:00:00Z`);
  const end = new Date(`${range.to}T00:00:00Z`);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
    throw new Error("Invalid date range");
  }
  for (let d = start; d <= end; d = new Date(d.getTime() + 86_400_000)) {
    out.push(d.toISOString().slice(0, 10));
  }
  return out;
}

export function rangesOverlap(a: DateRange, b: DateRange): boolean {
  return a.from <= b.to && b.from <= a.to;
}

export type LeaveDayCalculationInput = {
  range: DateRange;
  halfDay: boolean;
  holidays: readonly string[];
  weeklyOffDates: readonly string[];
  /** When false, holidays/weekly offs inside the range still consume balance. */
  excludeNonWorkingDays: boolean;
};

/** Number of leave days consumed by a request. */
export function calculateLeaveDays(input: LeaveDayCalculationInput): number {
  const dates = eachDate(input.range);
  if (input.halfDay) return dates.length === 1 ? 0.5 : dates.length;
  if (!input.excludeNonWorkingDays) return dates.length;
  const holidays = new Set(input.holidays);
  const offs = new Set(input.weeklyOffDates);
  return dates.filter((d) => !holidays.has(d) && !offs.has(d)).length;
}

export type LeaveValidationInput = {
  range: DateRange;
  requestedDays: number;
  availableBalance: number;
  isPaid: boolean;
  allowsHalfDay: boolean;
  halfDay: boolean;
  requiresDocument: boolean;
  hasDocument: boolean;
  existingRanges: readonly DateRange[];
  maxConsecutiveDays?: number | null;
};

export type LeaveValidationError =
  | "LEAVE_INVALID_RANGE"
  | "LEAVE_OVERLAP"
  | "LEAVE_INSUFFICIENT_BALANCE"
  | "LEAVE_HALF_DAY_NOT_ALLOWED"
  | "LEAVE_DOCUMENT_REQUIRED";

/** Pure leave request validation. Returns every violated rule. */
export function validateLeaveRequest(
  input: LeaveValidationInput
): LeaveValidationError[] {
  const errors: LeaveValidationError[] = [];
  if (input.range.to < input.range.from) errors.push("LEAVE_INVALID_RANGE");
  if (input.requestedDays <= 0) errors.push("LEAVE_INVALID_RANGE");
  if (
    input.maxConsecutiveDays != null &&
    input.maxConsecutiveDays > 0 &&
    input.requestedDays > input.maxConsecutiveDays
  ) {
    errors.push("LEAVE_INVALID_RANGE");
  }
  if (input.halfDay && !input.allowsHalfDay) errors.push("LEAVE_HALF_DAY_NOT_ALLOWED");
  if (input.requiresDocument && !input.hasDocument) errors.push("LEAVE_DOCUMENT_REQUIRED");
  if (input.existingRanges.some((r) => rangesOverlap(r, input.range))) {
    errors.push("LEAVE_OVERLAP");
  }
  // Unpaid leave never consumes a balance.
  if (input.isPaid && input.requestedDays > input.availableBalance) {
    errors.push("LEAVE_INSUFFICIENT_BALANCE");
  }
  return errors;
}

export function closingLeaveBalance(b: {
  opening_balance: number;
  accrued: number;
  adjusted: number;
  used: number;
  encashed: number;
}): number {
  return round2(b.opening_balance + b.accrued + b.adjusted - b.used - b.encashed);
}

/* ────────────────────────────────────────────────────────────────────────────
 * Money / payroll engine
 * ──────────────────────────────────────────────────────────────────────────── */

export function round2(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

export type StatutoryConfig = {
  pfEmployeeRate: number;
  pfEmployerRate: number;
  pfWageCeiling: number;
  pfApplyCeiling: boolean;
  esiGrossThreshold: number;
  esiEmployeeRate: number;
  esiEmployerRate: number;
  professionalTaxMonthly: number;
  professionalTaxMinGross: number;
};

export type StructureComponent = {
  code: string;
  name: string;
  type: "EARNING" | "DEDUCTION" | "STATUTORY";
  /** FIXED = absolute monthly amount, PERCENT_OF = percentage of `baseCode`. */
  method: "FIXED" | "PERCENT_OF_CTC" | "PERCENT_OF";
  value?: number | null;
  percentage?: number | null;
  baseCode?: string | null;
  monthlyLimit?: number | null;
  /** Prorate by paid days (true for salary, false for fixed reimbursements). */
  prorate?: boolean;
  taxable?: boolean;
};

export type PayrollLineItem = {
  code: string;
  name: string;
  type: "EARNING" | "DEDUCTION" | "STATUTORY";
  amount: number;
  basis: string;
  taxable: boolean;
};

export type PayrollComputationInput = {
  monthlyCtc: number;
  workingDays: number;
  paidDays: number;
  lopDays: number;
  components: readonly StructureComponent[];
  statutory: StatutoryConfig;
  /** Ad-hoc earnings/deductions approved for this payroll period. */
  adjustments?: readonly {
    code: string;
    name: string;
    amount: number;
    isEarning: boolean;
  }[];
  /** Loan / advance recovery for the period. */
  recoveries?: readonly { code: string; name: string; amount: number }[];
  engineVersion: string;
};

export type PayrollComputationResult = {
  earnings: PayrollLineItem[];
  deductions: PayrollLineItem[];
  grossEarnings: number;
  totalDeductions: number;
  netPay: number;
  employerContribution: number;
  employeeContribution: number;
  taxableIncome: number;
  lopAmount: number;
  proration: number;
  engineVersion: string;
};

/**
 * Deterministic, structure-driven payroll computation.
 *
 * Earnings are derived from the employee's assigned salary structure. Statutory
 * deductions use the company's configured rates. There is no hidden 40/20/10/30
 * assumption: when a structure defines no components the caller must supply the
 * fallback split explicitly.
 */
export function computePayroll(
  input: PayrollComputationInput
): PayrollComputationResult {
  const workingDays = Math.max(1, input.workingDays);
  const paidDays = Math.min(Math.max(0, input.paidDays), workingDays);
  const proration = round2(paidDays / workingDays);

  const fullMonthAmounts = new Map<string, number>();
  const resolve = (component: StructureComponent): number => {
    if (component.method === "FIXED") return Math.max(0, component.value ?? 0);
    if (component.method === "PERCENT_OF_CTC") {
      return Math.max(0, (input.monthlyCtc * (component.percentage ?? 0)) / 100);
    }
    const base = component.baseCode ? fullMonthAmounts.get(component.baseCode) ?? 0 : 0;
    return Math.max(0, (base * (component.percentage ?? 0)) / 100);
  };

  // First pass: full-month values so PERCENT_OF references resolve.
  for (const component of input.components) {
    let amount = resolve(component);
    if (component.monthlyLimit != null) amount = Math.min(amount, component.monthlyLimit);
    fullMonthAmounts.set(component.code, round2(amount));
  }

  const earnings: PayrollLineItem[] = [];
  const deductions: PayrollLineItem[] = [];
  let grossEarnings = 0;
  let taxableIncome = 0;
  let fullMonthGross = 0;
  let fullMonthBasic = 0;

  for (const component of input.components) {
    const full = fullMonthAmounts.get(component.code) ?? 0;
    const prorate = component.prorate ?? component.type === "EARNING";
    const amount = round2(prorate ? full * proration : full);

    if (component.type === "EARNING") {
      fullMonthGross += full;
      grossEarnings += amount;
      if (component.taxable ?? true) taxableIncome += amount;
      if (component.code === "BASIC") {
        fullMonthBasic = full;
      }
      earnings.push({
        code: component.code,
        name: component.name,
        type: "EARNING",
        amount,
        basis: prorate ? `${paidDays}/${workingDays} days of ${full.toFixed(2)}` : "Fixed",
        taxable: component.taxable ?? true,
      });
    } else {
      deductions.push({
        code: component.code,
        name: component.name,
        type: component.type,
        amount,
        basis: prorate ? `${paidDays}/${workingDays} days` : "Fixed",
        taxable: false,
      });
    }
  }

  grossEarnings = round2(grossEarnings);
  taxableIncome = round2(taxableIncome);

  // ── Statutory: provident fund ────────────────────────────────────────────
  const s = input.statutory;
  const pfBaseFull = fullMonthBasic > 0 ? fullMonthBasic : fullMonthGross;
  const pfWageFull = s.pfApplyCeiling ? Math.min(pfBaseFull, s.pfWageCeiling) : pfBaseFull;
  const pfWage = round2(pfWageFull * proration);
  const pfEmployee = round2(pfWage * s.pfEmployeeRate);
  const pfEmployer = round2(pfWage * s.pfEmployerRate);
  if (pfEmployee > 0) {
    deductions.push({
      code: "PF_EMPLOYEE",
      name: "Provident Fund (Employee)",
      type: "STATUTORY",
      amount: pfEmployee,
      basis: `${(s.pfEmployeeRate * 100).toFixed(2)}% of ${pfWage.toFixed(2)}`,
      taxable: false,
    });
  }

  // ── Statutory: employee state insurance ──────────────────────────────────
  let esiEmployee = 0;
  let esiEmployer = 0;
  if (fullMonthGross > 0 && fullMonthGross <= s.esiGrossThreshold) {
    esiEmployee = round2(grossEarnings * s.esiEmployeeRate);
    esiEmployer = round2(grossEarnings * s.esiEmployerRate);
    if (esiEmployee > 0) {
      deductions.push({
        code: "ESI_EMPLOYEE",
        name: "ESI (Employee)",
        type: "STATUTORY",
        amount: esiEmployee,
        basis: `${(s.esiEmployeeRate * 100).toFixed(2)}% of ${grossEarnings.toFixed(2)}`,
        taxable: false,
      });
    }
  }

  // ── Statutory: professional tax ──────────────────────────────────────────
  if (
    s.professionalTaxMonthly > 0 &&
    grossEarnings >= s.professionalTaxMinGross &&
    paidDays > 0
  ) {
    deductions.push({
      code: "PROFESSIONAL_TAX",
      name: "Professional Tax",
      type: "STATUTORY",
      amount: round2(s.professionalTaxMonthly),
      basis: "Statutory monthly amount",
      taxable: false,
    });
  }

  // ── Adjustments and recoveries ───────────────────────────────────────────
  for (const adj of input.adjustments ?? []) {
    const amount = round2(Math.abs(adj.amount));
    if (adj.isEarning) {
      grossEarnings = round2(grossEarnings + amount);
      taxableIncome = round2(taxableIncome + amount);
      earnings.push({
        code: adj.code,
        name: adj.name,
        type: "EARNING",
        amount,
        basis: "Approved adjustment",
        taxable: true,
      });
    } else {
      deductions.push({
        code: adj.code,
        name: adj.name,
        type: "DEDUCTION",
        amount,
        basis: "Approved adjustment",
        taxable: false,
      });
    }
  }
  for (const rec of input.recoveries ?? []) {
    deductions.push({
      code: rec.code,
      name: rec.name,
      type: "DEDUCTION",
      amount: round2(Math.abs(rec.amount)),
      basis: "Recovery",
      taxable: false,
    });
  }

  const totalDeductions = round2(
    deductions.reduce((sum, d) => sum + d.amount, 0)
  );
  const lopAmount = round2(
    fullMonthGross > 0 ? (fullMonthGross / workingDays) * Math.max(0, input.lopDays) : 0
  );

  return {
    earnings,
    deductions,
    grossEarnings,
    totalDeductions,
    netPay: round2(grossEarnings - totalDeductions),
    employerContribution: round2(pfEmployer + esiEmployer),
    employeeContribution: round2(pfEmployee + esiEmployee),
    taxableIncome,
    lopAmount,
    proration,
    engineVersion: input.engineVersion,
  };
}

/**
 * Builds the component list for a CTC when the structure has no explicit
 * components. The split must be supplied by the caller (from configuration),
 * keeping this function free of embedded policy.
 */
export function fallbackStructureComponents(
  monthlyCtc: number,
  split: { basic: number; hra: number; conveyance: number; special: number }
): StructureComponent[] {
  return [
    {
      code: "BASIC",
      name: "Basic",
      type: "EARNING",
      method: "FIXED",
      value: round2(monthlyCtc * split.basic),
      prorate: true,
      taxable: true,
    },
    {
      code: "HRA",
      name: "House Rent Allowance",
      type: "EARNING",
      method: "FIXED",
      value: round2(monthlyCtc * split.hra),
      prorate: true,
      taxable: true,
    },
    {
      code: "CONVEYANCE",
      name: "Conveyance Allowance",
      type: "EARNING",
      method: "FIXED",
      value: round2(monthlyCtc * split.conveyance),
      prorate: true,
      taxable: true,
    },
    {
      code: "SPECIAL_ALLOWANCE",
      name: "Special Allowance",
      type: "EARNING",
      method: "FIXED",
      value: round2(monthlyCtc * split.special),
      prorate: true,
      taxable: true,
    },
  ];
}

/** Indian-format currency string for payslips and exports. */
export function formatInr(amount: number): string {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 2,
  }).format(amount);
}

export function formatMinutesAsHours(minutes: number): string {
  const safe = Math.max(0, Math.round(minutes));
  const h = Math.floor(safe / 60);
  const m = safe % 60;
  return `${h}h ${String(m).padStart(2, "0")}m`;
}
