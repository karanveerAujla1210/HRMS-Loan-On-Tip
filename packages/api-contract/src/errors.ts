/**
 * Stable, machine-readable business error codes.
 *
 * These codes are part of the public API contract: web and mobile clients may
 * branch on them. Never change the string value of an existing code — add a new
 * one instead.
 */
export const ERROR_CODES = {
  // ── Transport / auth ───────────────────────────────────────────────────────
  UNAUTHORIZED: "UNAUTHORIZED",
  FORBIDDEN: "FORBIDDEN",
  NOT_FOUND: "NOT_FOUND",
  VALIDATION_ERROR: "VALIDATION_ERROR",
  CONFLICT: "CONFLICT",
  RATE_LIMITED: "RATE_LIMITED",
  INTERNAL_ERROR: "INTERNAL_ERROR",
  NOT_IMPLEMENTED: "NOT_IMPLEMENTED",

  // ── Identity ──────────────────────────────────────────────────────────────
  PROFILE_NOT_LINKED: "PROFILE_NOT_LINKED",
  EMPLOYEE_NOT_LINKED: "EMPLOYEE_NOT_LINKED",
  COMPANY_NOT_RESOLVED: "COMPANY_NOT_RESOLVED",

  // ── Attendance ────────────────────────────────────────────────────────────
  ATTENDANCE_ALREADY_CHECKED_IN: "ATTENDANCE_ALREADY_CHECKED_IN",
  ATTENDANCE_NOT_CHECKED_IN: "ATTENDANCE_NOT_CHECKED_IN",
  ATTENDANCE_ALREADY_CHECKED_OUT: "ATTENDANCE_ALREADY_CHECKED_OUT",
  ATTENDANCE_OUTSIDE_RADIUS: "ATTENDANCE_OUTSIDE_RADIUS",
  ATTENDANCE_LOW_ACCURACY: "ATTENDANCE_LOW_ACCURACY",
  ATTENDANCE_MOCK_LOCATION: "ATTENDANCE_MOCK_LOCATION",
  ATTENDANCE_LOCATION_NOT_CONFIGURED: "ATTENDANCE_LOCATION_NOT_CONFIGURED",
  ATTENDANCE_DAY_LOCKED: "ATTENDANCE_DAY_LOCKED",
  ATTENDANCE_CORRECTION_ALREADY_DECIDED: "ATTENDANCE_CORRECTION_ALREADY_DECIDED",

  // ── Leave ─────────────────────────────────────────────────────────────────
  LEAVE_OVERLAP: "LEAVE_OVERLAP",
  LEAVE_INSUFFICIENT_BALANCE: "LEAVE_INSUFFICIENT_BALANCE",
  LEAVE_INVALID_RANGE: "LEAVE_INVALID_RANGE",
  LEAVE_ALREADY_DECIDED: "LEAVE_ALREADY_DECIDED",
  LEAVE_NOT_CANCELLABLE: "LEAVE_NOT_CANCELLABLE",
  LEAVE_HALF_DAY_NOT_ALLOWED: "LEAVE_HALF_DAY_NOT_ALLOWED",
  LEAVE_DOCUMENT_REQUIRED: "LEAVE_DOCUMENT_REQUIRED",

  // ── Assets ────────────────────────────────────────────────────────────────
  ASSET_ALREADY_ASSIGNED: "ASSET_ALREADY_ASSIGNED",
  ASSET_NOT_ASSIGNED: "ASSET_NOT_ASSIGNED",
  ASSET_NOT_AVAILABLE: "ASSET_NOT_AVAILABLE",
  ASSET_DUPLICATE_IDENTIFIER: "ASSET_DUPLICATE_IDENTIFIER",
  ASSET_UNDER_REPAIR: "ASSET_UNDER_REPAIR",

  // ── Payroll ───────────────────────────────────────────────────────────────
  PAYROLL_ALREADY_EXISTS: "PAYROLL_ALREADY_EXISTS",
  PAYROLL_ALREADY_LOCKED: "PAYROLL_ALREADY_LOCKED",
  PAYROLL_INVALID_STATE: "PAYROLL_INVALID_STATE",
  PAYROLL_NO_SALARY_STRUCTURE: "PAYROLL_NO_SALARY_STRUCTURE",
  PAYROLL_NOT_CALCULATED: "PAYROLL_NOT_CALCULATED",
  PAYSLIP_NOT_PUBLISHED: "PAYSLIP_NOT_PUBLISHED",

  // ── Employees ─────────────────────────────────────────────────────────────
  EMPLOYEE_DUPLICATE_EMAIL: "EMPLOYEE_DUPLICATE_EMAIL",
  EMPLOYEE_INVALID_STATE_TRANSITION: "EMPLOYEE_INVALID_STATE_TRANSITION",
  EMPLOYEE_MANAGER_CYCLE: "EMPLOYEE_MANAGER_CYCLE",

  // ── Documents ─────────────────────────────────────────────────────────────
  DOCUMENT_TYPE_NOT_ALLOWED: "DOCUMENT_TYPE_NOT_ALLOWED",
  DOCUMENT_TOO_LARGE: "DOCUMENT_TOO_LARGE",
} as const;

export type ErrorCode = (typeof ERROR_CODES)[keyof typeof ERROR_CODES];

/** Default HTTP status for each error code. */
export const ERROR_STATUS: Record<ErrorCode, number> = {
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  VALIDATION_ERROR: 422,
  CONFLICT: 409,
  RATE_LIMITED: 429,
  INTERNAL_ERROR: 500,
  NOT_IMPLEMENTED: 501,

  PROFILE_NOT_LINKED: 403,
  EMPLOYEE_NOT_LINKED: 403,
  COMPANY_NOT_RESOLVED: 403,

  ATTENDANCE_ALREADY_CHECKED_IN: 409,
  ATTENDANCE_NOT_CHECKED_IN: 409,
  ATTENDANCE_ALREADY_CHECKED_OUT: 409,
  ATTENDANCE_OUTSIDE_RADIUS: 422,
  ATTENDANCE_LOW_ACCURACY: 422,
  ATTENDANCE_MOCK_LOCATION: 422,
  ATTENDANCE_LOCATION_NOT_CONFIGURED: 409,
  ATTENDANCE_DAY_LOCKED: 409,
  ATTENDANCE_CORRECTION_ALREADY_DECIDED: 409,

  LEAVE_OVERLAP: 409,
  LEAVE_INSUFFICIENT_BALANCE: 422,
  LEAVE_INVALID_RANGE: 422,
  LEAVE_ALREADY_DECIDED: 409,
  LEAVE_NOT_CANCELLABLE: 409,
  LEAVE_HALF_DAY_NOT_ALLOWED: 422,
  LEAVE_DOCUMENT_REQUIRED: 422,

  ASSET_ALREADY_ASSIGNED: 409,
  ASSET_NOT_ASSIGNED: 409,
  ASSET_NOT_AVAILABLE: 409,
  ASSET_DUPLICATE_IDENTIFIER: 409,
  ASSET_UNDER_REPAIR: 409,

  PAYROLL_ALREADY_EXISTS: 409,
  PAYROLL_ALREADY_LOCKED: 409,
  PAYROLL_INVALID_STATE: 409,
  PAYROLL_NO_SALARY_STRUCTURE: 422,
  PAYROLL_NOT_CALCULATED: 409,
  PAYSLIP_NOT_PUBLISHED: 409,

  EMPLOYEE_DUPLICATE_EMAIL: 409,
  EMPLOYEE_INVALID_STATE_TRANSITION: 409,
  EMPLOYEE_MANAGER_CYCLE: 422,

  DOCUMENT_TYPE_NOT_ALLOWED: 422,
  DOCUMENT_TOO_LARGE: 422,
};

/** Human-readable default messages. Route handlers may override. */
export const ERROR_MESSAGES: Record<ErrorCode, string> = {
  UNAUTHORIZED: "Authentication required.",
  FORBIDDEN: "You do not have permission to perform this action.",
  NOT_FOUND: "The requested record does not exist.",
  VALIDATION_ERROR: "The request payload is invalid.",
  CONFLICT: "The request conflicts with the current state of the record.",
  RATE_LIMITED: "Too many requests. Please retry shortly.",
  INTERNAL_ERROR: "An unexpected error occurred.",
  NOT_IMPLEMENTED: "This operation is not implemented.",

  PROFILE_NOT_LINKED: "This login is not linked to an HRMS profile.",
  EMPLOYEE_NOT_LINKED: "This login is not linked to an employee record.",
  COMPANY_NOT_RESOLVED: "No company could be resolved for this login.",

  ATTENDANCE_ALREADY_CHECKED_IN: "You have already checked in today.",
  ATTENDANCE_NOT_CHECKED_IN: "No check-in was found for today.",
  ATTENDANCE_ALREADY_CHECKED_OUT: "You have already checked out today.",
  ATTENDANCE_OUTSIDE_RADIUS: "You are outside the permitted office radius.",
  ATTENDANCE_LOW_ACCURACY: "Location accuracy is too low to record attendance.",
  ATTENDANCE_MOCK_LOCATION: "Mock location detected. Attendance was not recorded.",
  ATTENDANCE_LOCATION_NOT_CONFIGURED:
    "Your work location has no geo-fence configured. Contact HR.",
  ATTENDANCE_DAY_LOCKED: "This attendance day is closed and can only be changed by correction.",
  ATTENDANCE_CORRECTION_ALREADY_DECIDED: "This correction request was already decided.",

  LEAVE_OVERLAP: "You already have leave applied for one or more of these dates.",
  LEAVE_INSUFFICIENT_BALANCE: "Insufficient leave balance for this request.",
  LEAVE_INVALID_RANGE: "The leave date range is invalid.",
  LEAVE_ALREADY_DECIDED: "This leave request was already decided.",
  LEAVE_NOT_CANCELLABLE: "This leave request can no longer be cancelled.",
  LEAVE_HALF_DAY_NOT_ALLOWED: "Half-day leave is not allowed for this leave type.",
  LEAVE_DOCUMENT_REQUIRED: "A supporting document is required for this leave type.",

  ASSET_ALREADY_ASSIGNED: "This asset is already assigned to an employee.",
  ASSET_NOT_ASSIGNED: "This asset has no active assignment.",
  ASSET_NOT_AVAILABLE: "This asset is not available for assignment.",
  ASSET_DUPLICATE_IDENTIFIER:
    "An asset with the same serial number, IMEI, SIM or mobile number already exists.",
  ASSET_UNDER_REPAIR: "This asset is currently under repair.",

  PAYROLL_ALREADY_EXISTS: "A payroll run already exists for this period.",
  PAYROLL_ALREADY_LOCKED: "This payroll run is locked and cannot be modified.",
  PAYROLL_INVALID_STATE: "The payroll run is not in a valid state for this operation.",
  PAYROLL_NO_SALARY_STRUCTURE: "One or more employees have no active salary structure.",
  PAYROLL_NOT_CALCULATED: "The payroll run has not been calculated yet.",
  PAYSLIP_NOT_PUBLISHED: "This payslip has not been published yet.",

  EMPLOYEE_DUPLICATE_EMAIL: "An employee with this official email already exists.",
  EMPLOYEE_INVALID_STATE_TRANSITION: "This employment status change is not allowed.",
  EMPLOYEE_MANAGER_CYCLE: "The selected manager would create a reporting cycle.",

  DOCUMENT_TYPE_NOT_ALLOWED: "This file type is not allowed.",
  DOCUMENT_TOO_LARGE: "The file exceeds the maximum allowed size.",
};
