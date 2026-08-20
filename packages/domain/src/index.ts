import type { AttendanceStatus, UserRole } from "@hrms/api-contract";

// --- Status display labels ---
export const ATTENDANCE_LABELS: Record<AttendanceStatus, string> = {
  present: "Present",
  absent: "Absent",
  half_day: "Half day",
  late: "Late",
  on_leave: "On leave",
  holiday: "Holiday",
  week_off: "Week off",
};

// --- Role permissions ---
export const CAN_APPROVE_LEAVE: UserRole[] = ["super_admin", "hr_admin", "manager"];
export const CAN_RUN_PAYROLL: UserRole[] = ["super_admin", "finance"];
export const CAN_MANAGE_ASSETS: UserRole[] = ["super_admin", "asset_admin"];

export function canApproveLeave(role: UserRole) {
  return CAN_APPROVE_LEAVE.includes(role);
}

// --- Attendance calculations ---
export const GRACE_MINUTES = 15; // minutes after shift start before marking late
export const HALF_DAY_THRESHOLD_MINUTES = 240; // < 4 h worked = half day
export const GEO_RADIUS_M = 150;

export function workedMinutes(checkIn: Date, checkOut: Date): number {
  return Math.max(0, Math.floor((checkOut.getTime() - checkIn.getTime()) / 60_000));
}

export function deriveAttendanceStatus(
  checkInAt: Date,
  shiftStart: Date,
  checkOutAt?: Date
): AttendanceStatus {
  const lateBy = Math.floor((checkInAt.getTime() - shiftStart.getTime()) / 60_000);
  if (lateBy > GRACE_MINUTES) {
    if (checkOutAt && workedMinutes(checkInAt, checkOutAt) < HALF_DAY_THRESHOLD_MINUTES)
      return "half_day";
    return "late";
  }
  if (checkOutAt && workedMinutes(checkInAt, checkOutAt) < HALF_DAY_THRESHOLD_MINUTES)
    return "half_day";
  return "present";
}

// --- Payroll ---
export type SalaryComponents = {
  basic: number;
  hra: number;
  conveyance: number;
  special_allowance: number;
  pf_employee: number;
  professional_tax: number;
  tds: number;
  loan_recovery?: number;
};

export function calculateNetPay(c: SalaryComponents, payableDays: number, totalDays: number) {
  const gross = (c.basic + c.hra + c.conveyance + c.special_allowance) * (payableDays / totalDays);
  const deductions = c.pf_employee + c.professional_tax + c.tds + (c.loan_recovery ?? 0);
  return { gross: +gross.toFixed(2), deductions: +deductions.toFixed(2), net: +(gross - deductions).toFixed(2) };
}
