/**
 * @hrms/config — default configuration values.
 *
 * IMPORTANT: these are *fallback defaults only*. Every value here is
 * overridable per company through `system_settings` (see
 * `lib/server/settings.ts`) or per location/shift through the database.
 * Nothing in the runtime path may hard-code these numbers directly.
 */

export const DEFAULT_TIMEZONE = "Asia/Kolkata";
export const DEFAULT_CURRENCY = "INR";

/** Attendance defaults — Delhi Head Office, general shift. */
export const ATTENDANCE_DEFAULTS = {
  shiftStart: "09:30",
  shiftEnd: "18:30",
  graceMinutes: 15,
  breakMinutes: 0,
  /** Below this many worked minutes a present day becomes a half day. */
  halfDayAfterMinutes: 240,
  /** At or above this many worked minutes the day is a full day. */
  fullDayAfterMinutes: 360,
  /** Geo-fence radius in metres around the assigned location. */
  geoRadiusMeters: 150,
  /** Reject a punch whose GPS accuracy is worse than this, in metres. */
  maxAccuracyMeters: 100,
  /** Attendance for a day is closed the next day at this local time. */
  dailyCloseTime: "11:00",
  /** Weekly off days, 0 = Sunday … 6 = Saturday. */
  weeklyOffDays: [0] as readonly number[],
} as const;

/**
 * Statutory defaults for India.
 *
 * These are *configuration*, not invented law: each value is stored in
 * `system_settings` under the `payroll.*` keys and can be changed by a Finance
 * administrator without a code change. Documented in `/docs/DATABASE.md`.
 */
export const PAYROLL_DEFAULTS = {
  /** Employee provident fund rate applied to the PF wage base. */
  pfEmployeeRate: 0.12,
  pfEmployerRate: 0.12,
  /** Statutory monthly PF wage ceiling. */
  pfWageCeiling: 15000,
  /** Apply the ceiling (true) or compute PF on actual basic (false). */
  pfApplyCeiling: true,
  /** ESI applies only when gross is at or below this monthly threshold. */
  esiGrossThreshold: 21000,
  esiEmployeeRate: 0.0075,
  esiEmployerRate: 0.0325,
  /** Flat monthly professional tax; 0 disables it. */
  professionalTaxMonthly: 200,
  /** Professional tax is skipped when monthly gross is below this. */
  professionalTaxMinGross: 15000,
  /** Default salary structure split when a structure defines no components. */
  fallbackSplit: {
    basic: 0.4,
    hra: 0.2,
    conveyance: 0.1,
    special: 0.3,
  },
  /** Version of the payroll calculation engine stamped into every snapshot. */
  engineVersion: "2026.08.1",
} as const;

export const LEAVE_DEFAULTS = {
  approvalLevels: 1,
  /** Allow applying for leave in the past up to this many days. */
  backdatedDays: 30,
} as const;

export const UPLOAD_LIMITS = {
  maxDocumentBytes: 5 * 1024 * 1024,
  allowedDocumentMimeTypes: [
    "image/jpeg",
    "image/png",
    "application/pdf",
    "application/msword",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  ] as readonly string[],
} as const;

export const RATE_LIMITS = {
  /** Attendance punches per employee per minute. */
  attendancePerMinute: 6,
  /** Generic mutations per employee per minute. */
  mutationsPerMinute: 60,
} as const;

export const SETTING_KEYS = {
  attendanceRadius: "attendance.radius",
  attendanceGraceMinutes: "attendance.grace_minutes",
  attendanceMaxAccuracy: "attendance.max_accuracy_meters",
  attendanceAutoAbsentTime: "attendance.auto_absent_time",
  attendanceRejectOutsideRadius: "attendance.reject_outside_radius",
  attendanceRejectMockLocation: "attendance.reject_mock_location",
  attendanceHalfDayMinutes: "attendance.half_day_after_minutes",
  attendanceFullDayMinutes: "attendance.full_day_after_minutes",
  payrollCutoffDate: "payroll.cutoff_date",
  payrollPfEmployeeRate: "payroll.pf_employee_rate",
  payrollPfEmployerRate: "payroll.pf_employer_rate",
  payrollPfWageCeiling: "payroll.pf_wage_ceiling",
  payrollPfApplyCeiling: "payroll.pf_apply_ceiling",
  payrollEsiThreshold: "payroll.esi_gross_threshold",
  payrollEsiEmployeeRate: "payroll.esi_employee_rate",
  payrollEsiEmployerRate: "payroll.esi_employer_rate",
  payrollProfessionalTax: "payroll.professional_tax_monthly",
  payrollProfessionalTaxMinGross: "payroll.professional_tax_min_gross",
  leaveApprovalLevels: "leave.approval_levels",
} as const;
