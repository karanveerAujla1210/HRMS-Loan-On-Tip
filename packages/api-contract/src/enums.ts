import { z } from "zod";

/**
 * Canonical domain enums.
 *
 * These values mirror the PostgreSQL enum types exactly (UPPER_SNAKE_CASE).
 * The database is the source of truth; never introduce a lower-case variant.
 */

export const ATTENDANCE_STATUSES = [
  "PRESENT",
  "ABSENT",
  "HALF_DAY",
  "LATE",
  "ON_LEAVE",
  "LEAVE",
  "HOLIDAY",
  "WEEKLY_OFF",
  "WORK_FROM_HOME",
  "ON_DUTY",
  "MISSING_PUNCH",
] as const;
export const AttendanceStatusSchema = z.enum(ATTENDANCE_STATUSES);
export type AttendanceStatus = z.infer<typeof AttendanceStatusSchema>;

/** Statuses that count as the employee having worked (fully or partly) that day. */
export const WORKING_ATTENDANCE_STATUSES: readonly AttendanceStatus[] = [
  "PRESENT",
  "LATE",
  "HALF_DAY",
  "WORK_FROM_HOME",
  "ON_DUTY",
];

/** Statuses that must never be counted as absence. */
export const NON_ABSENT_STATUSES: readonly AttendanceStatus[] = [
  ...WORKING_ATTENDANCE_STATUSES,
  "ON_LEAVE",
  "LEAVE",
  "HOLIDAY",
  "WEEKLY_OFF",
];

export const EMPLOYMENT_STATUSES = [
  "DRAFT",
  "ACTIVE",
  "ON_NOTICE",
  "NOTICE_PERIOD",
  "SUSPENDED",
  "RESIGNED",
  "RELIEVED",
  "TERMINATED",
  "RETIRED",
  "EXITED",
  "INACTIVE",
] as const;
export const EmploymentStatusSchema = z.enum(EMPLOYMENT_STATUSES);
export type EmploymentStatus = z.infer<typeof EmploymentStatusSchema>;

/**
 * Allowed employment lifecycle transitions. Enforced by the API layer.
 * `NOTICE_PERIOD` is a legacy synonym of `ON_NOTICE` kept for backwards
 * compatibility with rows created before the enum was normalised.
 */
export const EMPLOYMENT_TRANSITIONS: Record<EmploymentStatus, readonly EmploymentStatus[]> = {
  DRAFT: ["ACTIVE", "INACTIVE"],
  ACTIVE: ["ON_NOTICE", "SUSPENDED", "TERMINATED", "RETIRED", "INACTIVE"],
  ON_NOTICE: ["ACTIVE", "RELIEVED", "EXITED", "TERMINATED", "RESIGNED"],
  NOTICE_PERIOD: ["ACTIVE", "RELIEVED", "EXITED", "TERMINATED", "RESIGNED"],
  SUSPENDED: ["ACTIVE", "TERMINATED"],
  RESIGNED: ["RELIEVED", "EXITED"],
  RELIEVED: ["EXITED"],
  TERMINATED: ["EXITED"],
  RETIRED: ["EXITED"],
  EXITED: [],
  INACTIVE: ["ACTIVE"],
};

export const LEAVE_REQUEST_STATUSES = [
  "DRAFT",
  "PENDING",
  "APPROVED",
  "REJECTED",
  "CANCELLED",
] as const;
export const LeaveRequestStatusSchema = z.enum(LEAVE_REQUEST_STATUSES);
export type LeaveRequestStatus = z.infer<typeof LeaveRequestStatusSchema>;

export const PAYROLL_RUN_STATUSES = [
  "DRAFT",
  "CALCULATING",
  "CALCULATED",
  "HR_REVIEW",
  "FINANCE_REVIEW",
  "APPROVED",
  "LOCKED",
  "PAID",
  "CANCELLED",
] as const;
export const PayrollRunStatusSchema = z.enum(PAYROLL_RUN_STATUSES);
export type PayrollRunStatus = z.infer<typeof PayrollRunStatusSchema>;

/** Payroll run states that may no longer be recalculated or edited. */
export const PAYROLL_IMMUTABLE_STATUSES: readonly PayrollRunStatus[] = [
  "LOCKED",
  "PAID",
];

export const ASSET_STATUSES = [
  "AVAILABLE",
  "ASSIGNED",
  "UNDER_REPAIR",
  "LOST",
  "DAMAGED",
  "RETIRED",
  "DISPOSED",
] as const;
export const AssetStatusSchema = z.enum(ASSET_STATUSES);
export type AssetStatus = z.infer<typeof AssetStatusSchema>;

export const ASSET_CONDITIONS = ["NEW", "GOOD", "FAIR", "POOR", "DAMAGED"] as const;
export const AssetConditionSchema = z.enum(ASSET_CONDITIONS);
export type AssetCondition = z.infer<typeof AssetConditionSchema>;

export const ASSET_ASSIGNMENT_STATUSES = [
  "ACTIVE",
  "RETURNED",
  "OVERDUE",
  "CANCELLED",
] as const;
export const AssetAssignmentStatusSchema = z.enum(ASSET_ASSIGNMENT_STATUSES);
export type AssetAssignmentStatus = z.infer<typeof AssetAssignmentStatusSchema>;

export const APPROVAL_ACTIONS = ["APPROVED", "REJECTED", "ESCALATED"] as const;
export const ApprovalActionSchema = z.enum(APPROVAL_ACTIONS);
export type ApprovalAction = z.infer<typeof ApprovalActionSchema>;

export const ATTENDANCE_SOURCES = [
  "MOBILE",
  "WEB",
  "BIOMETRIC",
  "SYSTEM",
  "MANUAL",
  "IMPORT",
] as const;
export const AttendanceSourceSchema = z.enum(ATTENDANCE_SOURCES);
export type AttendanceSource = z.infer<typeof AttendanceSourceSchema>;

export const COMPONENT_TYPES = ["EARNING", "DEDUCTION", "STATUTORY"] as const;
export const ComponentTypeSchema = z.enum(COMPONENT_TYPES);
export type ComponentType = z.infer<typeof ComponentTypeSchema>;

/**
 * Documented mapping between the product vocabulary used in specifications and
 * the canonical database enum values, so no duplicate states are introduced.
 */
export const ASSET_STATUS_ALIASES: Record<string, AssetStatus> = {
  IN_STOCK: "AVAILABLE",
  IN_USE: "ASSIGNED",
  REPAIR: "UNDER_REPAIR",
  // A returned asset becomes AVAILABLE again; the return itself is recorded on
  // asset_assignments/asset_returns, not as an asset state.
  RETURNED: "AVAILABLE",
};
