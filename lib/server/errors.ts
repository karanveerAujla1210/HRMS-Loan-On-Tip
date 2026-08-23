import {
  ERROR_CODES,
  ERROR_MESSAGES,
  ERROR_STATUS,
  type ApiErrorBody,
  type ErrorCode,
} from "@hrms/api-contract";

/** Typed application error carrying a stable business code. */
export class ApiError extends Error {
  readonly code: ErrorCode;
  readonly status: number;
  readonly details?: unknown;

  constructor(code: ErrorCode, message?: string, details?: unknown) {
    super(message ?? ERROR_MESSAGES[code]);
    this.name = "ApiError";
    this.code = code;
    this.status = ERROR_STATUS[code];
    this.details = details;
  }

  toBody(): ApiErrorBody {
    return { code: this.code, message: this.message, details: this.details };
  }
}

export const unauthorized = (message?: string) =>
  new ApiError(ERROR_CODES.UNAUTHORIZED, message);
export const forbidden = (message?: string) =>
  new ApiError(ERROR_CODES.FORBIDDEN, message);
export const notFound = (message?: string) =>
  new ApiError(ERROR_CODES.NOT_FOUND, message);
export const conflict = (message?: string) =>
  new ApiError(ERROR_CODES.CONFLICT, message);
export const validationError = (details: unknown, message?: string) =>
  new ApiError(ERROR_CODES.VALIDATION_ERROR, message, details);
export const internalError = (message?: string, details?: unknown) =>
  new ApiError(ERROR_CODES.INTERNAL_ERROR, message, details);

/** PostgreSQL error shape returned by supabase-js. */
type PostgresError = {
  code?: string;
  message?: string;
  details?: string | null;
  hint?: string | null;
};

const PG_UNIQUE_VIOLATION = "23505";
const PG_FOREIGN_KEY_VIOLATION = "23503";
const PG_CHECK_VIOLATION = "23514";
const PG_NOT_NULL_VIOLATION = "23502";
const PG_RLS_VIOLATION = "42501";
const PG_RAISE_EXCEPTION = "P0001";

/**
 * Maps a database error onto a stable business error code.
 *
 * Domain functions raise `ERRCODE`-prefixed messages such as
 * `HRMS:LEAVE_OVERLAP:...`, which are translated back into API error codes so
 * clients receive a stable contract regardless of where the rule lives.
 */
export function mapDatabaseError(error: unknown, fallbackMessage?: string): ApiError {
  const pg = (error ?? {}) as PostgresError;
  const raw = pg.message ?? "";

  const tagged = /HRMS:([A-Z_]+)(?::(.*))?/.exec(raw);
  if (tagged) {
    const code = tagged[1] as ErrorCode;
    if (code in ERROR_STATUS) {
      return new ApiError(code, tagged[2]?.trim() || undefined);
    }
  }

  switch (pg.code) {
    case PG_UNIQUE_VIOLATION: {
      if (/attendance.*employee_id.*attendance_date|attendance_emp_date/i.test(raw)) {
        return new ApiError(ERROR_CODES.ATTENDANCE_ALREADY_CHECKED_IN);
      }
      if (/asset_assignment.*active|uq_asset_assignment/i.test(raw)) {
        return new ApiError(ERROR_CODES.ASSET_ALREADY_ASSIGNED);
      }
      if (/serial_number|imei|mobile_number|sim_number/i.test(raw)) {
        return new ApiError(ERROR_CODES.ASSET_DUPLICATE_IDENTIFIER);
      }
      if (/official_email/i.test(raw)) {
        return new ApiError(ERROR_CODES.EMPLOYEE_DUPLICATE_EMAIL);
      }
      if (/payroll_runs.*year.*month|payroll_runs_company_period/i.test(raw)) {
        return new ApiError(ERROR_CODES.PAYROLL_ALREADY_EXISTS);
      }
      return new ApiError(ERROR_CODES.CONFLICT, "A record with these details already exists.");
    }
    case PG_FOREIGN_KEY_VIOLATION:
      return new ApiError(
        ERROR_CODES.VALIDATION_ERROR,
        "A referenced record does not exist.",
        { constraint: raw }
      );
    case PG_CHECK_VIOLATION:
    case PG_NOT_NULL_VIOLATION:
      return new ApiError(ERROR_CODES.VALIDATION_ERROR, "The request violates a data rule.", {
        constraint: raw,
      });
    case PG_RLS_VIOLATION:
      return new ApiError(ERROR_CODES.FORBIDDEN, "This operation is not permitted for your role.");
    case PG_RAISE_EXCEPTION:
      return new ApiError(ERROR_CODES.CONFLICT, raw.replace(/^HRMS:/, ""));
    default:
      return internalError(fallbackMessage ?? "A database error occurred.", {
        code: pg.code,
        message: raw,
      });
  }
}

export function toApiError(error: unknown): ApiError {
  if (error instanceof ApiError) return error;
  if (error && typeof error === "object" && "code" in error && "message" in error) {
    return mapDatabaseError(error);
  }
  if (error instanceof Error) return internalError(error.message);
  return internalError();
}
