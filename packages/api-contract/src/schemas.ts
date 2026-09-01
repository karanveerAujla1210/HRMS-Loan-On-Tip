import { z } from "zod";
import {
  ApprovalActionSchema,
  AssetConditionSchema,
  AttendanceSourceSchema,
  EmploymentStatusSchema,
} from "./enums";
import { PaginationQuerySchema } from "./response";

/* ────────────────────────────────────────────────────────────────────────────
 * Shared primitives
 * ──────────────────────────────────────────────────────────────────────────── */

export const UuidSchema = z.string().uuid();
/** Calendar date, `YYYY-MM-DD`. */
export const IsoDateSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Expected a YYYY-MM-DD date");
/** Absolute timestamp with offset, e.g. `2026-08-23T09:31:00+05:30`. */
export const IsoDateTimeSchema = z.string().datetime({ offset: true });
export const IdempotencyKeySchema = z.string().min(8).max(200);

export const OptionalTrimmedString = (max = 255) =>
  z
    .string()
    .trim()
    .max(max)
    .optional()
    .nullable()
    .transform((v) => (v === "" ? null : v ?? null));

const NullableUuid = UuidSchema.optional().nullable();
const NullableDate = IsoDateSchema.optional().nullable();

export const GeoPointSchema = z.object({
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
  accuracy_m: z.number().min(0).max(100000),
});

/* ────────────────────────────────────────────────────────────────────────────
 * Auth / session
 * ──────────────────────────────────────────────────────────────────────────── */

export const SessionResponseSchema = z.object({
  authUserId: UuidSchema,
  email: z.string().email().nullable(),
  profileId: UuidSchema.nullable(),
  employeeId: UuidSchema.nullable(),
  employeeCode: z.string().nullable(),
  displayName: z.string().nullable(),
  companyId: UuidSchema.nullable(),
  companyName: z.string().nullable(),
  locationId: UuidSchema.nullable(),
  timezone: z.string(),
  roles: z.array(z.string()),
  primaryRole: z.string().nullable(),
  permissions: z.array(z.string()),
  serverTime: z.string(),
});
export type SessionResponse = z.infer<typeof SessionResponseSchema>;

/* ────────────────────────────────────────────────────────────────────────────
 * Attendance
 * ──────────────────────────────────────────────────────────────────────────── */

export const CheckInRequestSchema = z.object({
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
  accuracy_m: z.number().min(0).max(100000),
  /**
   * Device clock reading. Recorded for audit only — the server clock is always
   * authoritative for attendance timing.
   */
  device_time: IsoDateTimeSchema.optional(),
  idempotency_key: IdempotencyKeySchema,
  is_mock_location: z.boolean().optional().default(false),
  device_id: OptionalTrimmedString(255),
  source: AttendanceSourceSchema.optional().default("MOBILE"),
  shift_id: UuidSchema.optional(),
});
export type CheckInRequest = z.infer<typeof CheckInRequestSchema>;

export const CheckOutRequestSchema = z.object({
  latitude: z.number().min(-90).max(90).optional(),
  longitude: z.number().min(-180).max(180).optional(),
  accuracy_m: z.number().min(0).max(100000).optional(),
  device_time: IsoDateTimeSchema.optional(),
  idempotency_key: IdempotencyKeySchema,
  is_mock_location: z.boolean().optional().default(false),
  device_id: OptionalTrimmedString(255),
  source: AttendanceSourceSchema.optional().default("MOBILE"),
  break_minutes: z.number().int().min(0).optional(),
});
export type CheckOutRequest = z.infer<typeof CheckOutRequestSchema>;

export const AttendanceMarkResponseSchema = z.object({
  attendance_id: UuidSchema,
  attendance_date: IsoDateSchema,
  status: z.string(),
  check_in_at: z.string().nullable(),
  check_out_at: z.string().nullable(),
  late_minutes: z.number(),
  worked_minutes: z.number(),
  distance_m: z.number().nullable(),
  server_time: z.string(),
  exceptions: z.array(z.string()),
});
export type AttendanceMarkResponse = z.infer<typeof AttendanceMarkResponseSchema>;

export const AttendanceListQuerySchema = PaginationQuerySchema.extend({
  from: IsoDateSchema.optional(),
  to: IsoDateSchema.optional(),
  employeeId: NullableUuid,
  departmentId: NullableUuid,
  locationId: NullableUuid,
  status: z.string().optional().nullable(),
  search: OptionalTrimmedString(120),
  scope: z.enum(["self", "team", "company"]).optional().default("company"),
});
export type AttendanceListQuery = z.infer<typeof AttendanceListQuerySchema>;

export const AttendanceCorrectionRequestSchema = z
  .object({
    attendance_id: UuidSchema.optional(),
    attendance_date: IsoDateSchema.optional(),
    new_check_in: IsoDateTimeSchema.optional().nullable(),
    new_check_out: IsoDateTimeSchema.optional().nullable(),
    reason: z.string().trim().min(10).max(1000),
    idempotency_key: IdempotencyKeySchema.optional(),
  })
  .refine((v) => v.attendance_id || v.attendance_date, {
    message: "Either attendance_id or attendance_date is required",
    path: ["attendance_id"],
  })
  .refine((v) => v.new_check_in || v.new_check_out, {
    message: "At least one corrected timestamp is required",
    path: ["new_check_in"],
  });
export type AttendanceCorrectionRequest = z.infer<typeof AttendanceCorrectionRequestSchema>;

export const AttendanceCorrectionDecisionSchema = z.object({
  action: z.enum(["APPROVED", "REJECTED"]),
  comments: OptionalTrimmedString(1000),
});
export type AttendanceCorrectionDecision = z.infer<typeof AttendanceCorrectionDecisionSchema>;

export const AttendanceExceptionDecisionSchema = z.object({
  status: z.enum(["OPEN", "ACKNOWLEDGED", "RESOLVED", "REJECTED"]),
  resolution_note: OptionalTrimmedString(1000),
});
export type AttendanceExceptionDecision = z.infer<typeof AttendanceExceptionDecisionSchema>;

export const AttendanceDailyCloseSchema = z.object({
  date: IsoDateSchema,
  company_id: NullableUuid,
});
export type AttendanceDailyClose = z.infer<typeof AttendanceDailyCloseSchema>;

/* ────────────────────────────────────────────────────────────────────────────
 * Leave
 * ──────────────────────────────────────────────────────────────────────────── */

export const LeaveApplyRequestSchema = z
  .object({
    leave_type_id: UuidSchema,
    from_date: IsoDateSchema,
    to_date: IsoDateSchema,
    half_day_type: z.enum(["FIRST_HALF", "SECOND_HALF"]).optional().nullable(),
    reason: z.string().trim().min(3).max(1000),
    attachment_document_id: NullableUuid,
    idempotency_key: IdempotencyKeySchema,
    employee_id: NullableUuid,
  })
  .refine((v) => v.to_date >= v.from_date, {
    message: "to_date must be on or after from_date",
    path: ["to_date"],
  })
  .refine((v) => !v.half_day_type || v.from_date === v.to_date, {
    message: "Half-day leave must be a single day",
    path: ["half_day_type"],
  });
export type LeaveApplyRequest = z.infer<typeof LeaveApplyRequestSchema>;

export const LeaveDecisionSchema = z.object({
  action: ApprovalActionSchema.exclude(["ESCALATED"]),
  comments: OptionalTrimmedString(1000),
  idempotency_key: IdempotencyKeySchema.optional(),
});
export type LeaveDecision = z.infer<typeof LeaveDecisionSchema>;

export const LeaveListQuerySchema = PaginationQuerySchema.extend({
  status: z.string().optional().nullable(),
  employeeId: NullableUuid,
  from: IsoDateSchema.optional(),
  to: IsoDateSchema.optional(),
  scope: z.enum(["self", "team", "company"]).optional().default("company"),
});
export type LeaveListQuery = z.infer<typeof LeaveListQuerySchema>;

export const LeaveBalanceQuerySchema = z.object({
  employeeId: NullableUuid,
  year: z.coerce.number().int().min(2000).max(2100).optional(),
});
export type LeaveBalanceQuery = z.infer<typeof LeaveBalanceQuerySchema>;

/* ────────────────────────────────────────────────────────────────────────────
 * Employees
 * ──────────────────────────────────────────────────────────────────────────── */

export const EmployeeCreateSchema = z.object({
  first_name: z.string().trim().min(1).max(100),
  middle_name: OptionalTrimmedString(100),
  last_name: z.string().trim().min(1).max(100),
  gender: OptionalTrimmedString(20),
  date_of_birth: NullableDate,
  blood_group: OptionalTrimmedString(5),
  joining_date: IsoDateSchema,
  confirmation_date: NullableDate,
  probation_end_date: NullableDate,
  notice_period_days: z.coerce.number().int().min(0).max(365).optional().nullable(),
  official_email: z.string().trim().email().optional().nullable(),
  personal_email: z.string().trim().email().optional().nullable(),
  official_mobile: OptionalTrimmedString(20),
  personal_mobile: OptionalTrimmedString(20),
  nationality: OptionalTrimmedString(100),
  marital_status: OptionalTrimmedString(30),
  employment_status: EmploymentStatusSchema.default("ACTIVE"),
  department_id: NullableUuid,
  designation_id: NullableUuid,
  location_id: NullableUuid,
  employment_type_id: NullableUuid,
  team_id: NullableUuid,
  manager_id: NullableUuid,
  hr_manager_id: NullableUuid,
  shift_id: NullableUuid,
  emergency_contact_name: OptionalTrimmedString(255),
  emergency_contact_relationship: OptionalTrimmedString(50),
  emergency_contact_mobile: OptionalTrimmedString(20),
  bank_name: OptionalTrimmedString(255),
  account_number: OptionalTrimmedString(40),
  ifsc_code: OptionalTrimmedString(20),
  pan_number: OptionalTrimmedString(20),
  aadhaar_number: OptionalTrimmedString(20),
  uan: OptionalTrimmedString(30),
  pf_number: OptionalTrimmedString(30),
  esi_number: OptionalTrimmedString(30),
  idempotency_key: IdempotencyKeySchema.optional(),
});
export type EmployeeCreate = z.infer<typeof EmployeeCreateSchema>;

export const EmployeeUpdateSchema = EmployeeCreateSchema.partial().omit({
  idempotency_key: true,
});
export type EmployeeUpdate = z.infer<typeof EmployeeUpdateSchema>;

export const EmployeeListQuerySchema = PaginationQuerySchema.extend({
  search: OptionalTrimmedString(120),
  departmentId: NullableUuid,
  designationId: NullableUuid,
  locationId: NullableUuid,
  managerId: NullableUuid,
  status: z.string().optional().nullable(),
  scope: z.enum(["self", "team", "company"]).optional().default("company"),
});
export type EmployeeListQuery = z.infer<typeof EmployeeListQuerySchema>;

export const EmployeeOffboardSchema = z.object({
  action: z.enum(["INITIATE", "CLEAR", "COMPLETE", "CANCEL"]),
  resignation_date: NullableDate,
  last_working_date: NullableDate,
  reason: OptionalTrimmedString(1000),
  clearance: z.enum(["IT", "FINANCE", "HR", "ASSETS"]).optional().nullable(),
  ff_amount: z.coerce.number().optional().nullable(),
  ff_notes: OptionalTrimmedString(1000),
  final_status: EmploymentStatusSchema.optional().nullable(),
  idempotency_key: IdempotencyKeySchema.optional(),
});
export type EmployeeOffboard = z.infer<typeof EmployeeOffboardSchema>;

export const SalaryAssignmentSchema = z.object({
  salary_structure_id: UuidSchema,
  annual_ctc: z.coerce.number().positive().max(1_000_000_000),
  effective_from: IsoDateSchema,
  reason: OptionalTrimmedString(1000),
  idempotency_key: IdempotencyKeySchema.optional(),
});
export type SalaryAssignment = z.infer<typeof SalaryAssignmentSchema>;

/* ────────────────────────────────────────────────────────────────────────────
 * Assets
 * ──────────────────────────────────────────────────────────────────────────── */

export const AssetCreateSchema = z.object({
  asset_category_id: UuidSchema,
  brand_id: NullableUuid,
  location_id: NullableUuid,
  asset_tag: OptionalTrimmedString(100),
  model: OptionalTrimmedString(255),
  serial_number: OptionalTrimmedString(255),
  imei_1: OptionalTrimmedString(20),
  imei_2: OptionalTrimmedString(20),
  mobile_number: OptionalTrimmedString(20),
  sim_number: OptionalTrimmedString(30),
  purchase_date: NullableDate,
  purchase_cost: z.coerce.number().min(0).optional().nullable(),
  warranty_start: NullableDate,
  warranty_end: NullableDate,
  condition: AssetConditionSchema.default("GOOD"),
  vendor_name: OptionalTrimmedString(255),
  invoice_number: OptionalTrimmedString(100),
  notes: OptionalTrimmedString(2000),
  idempotency_key: IdempotencyKeySchema.optional(),
});
export type AssetCreate = z.infer<typeof AssetCreateSchema>;

export const AssetUpdateSchema = AssetCreateSchema.partial().omit({
  idempotency_key: true,
});
export type AssetUpdate = z.infer<typeof AssetUpdateSchema>;

export const AssetAssignSchema = z.object({
  employee_id: UuidSchema,
  expected_return_date: NullableDate,
  condition_at_handover: AssetConditionSchema.default("GOOD"),
  remarks: OptionalTrimmedString(1000),
  idempotency_key: IdempotencyKeySchema,
});
export type AssetAssign = z.infer<typeof AssetAssignSchema>;

export const AssetReturnSchema = z.object({
  condition_at_return: AssetConditionSchema.default("GOOD"),
  return_date: NullableDate,
  damage_description: OptionalTrimmedString(1000),
  missing_items: OptionalTrimmedString(1000),
  recovery_amount: z.coerce.number().min(0).optional().nullable(),
  remarks: OptionalTrimmedString(1000),
  idempotency_key: IdempotencyKeySchema,
});
export type AssetReturn = z.infer<typeof AssetReturnSchema>;

export const AssetRepairSchema = z.object({
  maintenance_type: z.string().trim().min(2).max(50),
  vendor: OptionalTrimmedString(255),
  cost: z.coerce.number().min(0).optional().nullable(),
  description: z.string().trim().min(3).max(2000),
  idempotency_key: IdempotencyKeySchema,
});
export type AssetRepair = z.infer<typeof AssetRepairSchema>;

export const AssetRepairCompleteSchema = z.object({
  cost: z.coerce.number().min(0).optional().nullable(),
  condition: AssetConditionSchema.default("GOOD"),
  resolution: OptionalTrimmedString(2000),
  return_to_employee: z.boolean().optional().default(false),
});
export type AssetRepairComplete = z.infer<typeof AssetRepairCompleteSchema>;

export const AssetListQuerySchema = PaginationQuerySchema.extend({
  search: OptionalTrimmedString(120),
  categoryId: NullableUuid,
  locationId: NullableUuid,
  status: z.string().optional().nullable(),
  employeeId: NullableUuid,
  scope: z.enum(["self", "company"]).optional().default("company"),
});
export type AssetListQuery = z.infer<typeof AssetListQuerySchema>;

/* ────────────────────────────────────────────────────────────────────────────
 * Payroll
 * ──────────────────────────────────────────────────────────────────────────── */

export const PayrollRunCreateSchema = z.object({
  payroll_month: z.coerce.number().int().min(1).max(12),
  payroll_year: z.coerce.number().int().min(2000).max(2100),
  idempotency_key: IdempotencyKeySchema.optional(),
});
export type PayrollRunCreate = z.infer<typeof PayrollRunCreateSchema>;

export const PayrollActionSchema = z.object({
  action: z.enum(["CALCULATE", "HR_REVIEW", "APPROVE", "LOCK", "MARK_PAID", "CANCEL"]),
  comments: OptionalTrimmedString(1000),
  idempotency_key: IdempotencyKeySchema.optional(),
});
export type PayrollAction = z.infer<typeof PayrollActionSchema>;

export const PayrollListQuerySchema = PaginationQuerySchema.extend({
  year: z.coerce.number().int().min(2000).max(2100).optional(),
  status: z.string().optional().nullable(),
});
export type PayrollListQuery = z.infer<typeof PayrollListQuerySchema>;

export const PayslipListQuerySchema = PaginationQuerySchema.extend({
  employeeId: NullableUuid,
  payrollRunId: NullableUuid,
  year: z.coerce.number().int().min(2000).max(2100).optional(),
  scope: z.enum(["self", "company"]).optional().default("self"),
});
export type PayslipListQuery = z.infer<typeof PayslipListQuerySchema>;

/* ────────────────────────────────────────────────────────────────────────────
 * Documents
 * ──────────────────────────────────────────────────────────────────────────── */

export const DocumentUploadUrlSchema = z.object({
  employee_id: UuidSchema,
  document_type_id: UuidSchema,
  file_name: z.string().trim().min(1).max(255),
  mime_type: z.string().trim().min(3).max(120),
  file_size: z.coerce.number().int().min(1).max(20 * 1024 * 1024),
});
export type DocumentUploadUrl = z.infer<typeof DocumentUploadUrlSchema>;

export const DocumentMetadataSchema = z.object({
  employee_id: UuidSchema,
  document_type_id: UuidSchema,
  storage_path: z.string().trim().min(3).max(500),
  file_name: z.string().trim().min(1).max(255),
  mime_type: OptionalTrimmedString(120),
  file_size: z.coerce.number().int().min(0).optional().nullable(),
  document_number: OptionalTrimmedString(60),
  issue_date: NullableDate,
  expiry_date: NullableDate,
});
export type DocumentMetadata = z.infer<typeof DocumentMetadataSchema>;

export const DocumentStatusSchema = z.object({
  status: z.enum(["ACTIVE", "VERIFIED", "REJECTED", "ARCHIVED"]),
  remarks: OptionalTrimmedString(1000),
});
export type DocumentStatusUpdate = z.infer<typeof DocumentStatusSchema>;

/* ────────────────────────────────────────────────────────────────────────────
 * Reports / settings / organisation
 * ──────────────────────────────────────────────────────────────────────────── */

export const REPORT_KINDS = [
  "employee",
  "attendance",
  "late",
  "absence",
  "leave",
  "payroll",
  "payslip",
  "asset-inventory",
  "asset-assignment",
  "asset-repair",
  "asset-return",
  "department",
  "location",
  "audit",
] as const;
export const ReportKindSchema = z.enum(REPORT_KINDS);
export type ReportKind = z.infer<typeof ReportKindSchema>;

export const ReportQuerySchema = PaginationQuerySchema.extend({
  kind: ReportKindSchema,
  from: IsoDateSchema.optional(),
  to: IsoDateSchema.optional(),
  departmentId: NullableUuid,
  locationId: NullableUuid,
  employeeId: NullableUuid,
  status: z.string().optional().nullable(),
  format: z.enum(["json", "csv"]).optional().default("json"),
});
export type ReportQuery = z.infer<typeof ReportQuerySchema>;

export const ORGANISATION_TABLES = [
  "departments",
  "designations",
  "locations",
  "shifts",
  "leave_types",
  "holidays",
  "employment_types",
  "asset_categories",
  "asset_brands",
  "custom_fields",
  "salary_structures",
] as const;
export const OrganisationTableSchema = z.enum(ORGANISATION_TABLES);
export type OrganisationTable = z.infer<typeof OrganisationTableSchema>;

export const SettingsUpdateSchema = z.object({
  settings: z
    .array(
      z.object({
        setting_key: z.string().trim().min(2).max(100),
        setting_value: z.string().trim().max(2000),
      })
    )
    .min(1)
    .max(100),
});
export type SettingsUpdate = z.infer<typeof SettingsUpdateSchema>;

/* ────────────────────────────────────────────────────────────────────────────
 * Dashboard — the complete metric contract the web dashboard depends on
 * ──────────────────────────────────────────────────────────────────────────── */

export const DashboardMetricsSchema = z.object({
  company_id: UuidSchema,
  as_of_date: IsoDateSchema,
  active_employees: z.number().int().min(0),
  present_today: z.number().int().min(0),
  absent_today: z.number().int().min(0),
  late_today: z.number().int().min(0),
  half_day_today: z.number().int().min(0),
  on_leave_today: z.number().int().min(0),
  holiday_today: z.number().int().min(0),
  weekly_off_today: z.number().int().min(0),
  not_marked_today: z.number().int().min(0),
  pending_leaves: z.number().int().min(0),
  pending_corrections: z.number().int().min(0),
  open_exceptions: z.number().int().min(0),
  assigned_assets: z.number().int().min(0),
  available_assets: z.number().int().min(0),
  under_repair_assets: z.number().int().min(0),
  new_joiners_30d: z.number().int().min(0),
  on_notice: z.number().int().min(0),
  draft_payroll_runs: z.number().int().min(0),
  pending_payroll_approvals: z.number().int().min(0),
});
export type DashboardMetrics = z.infer<typeof DashboardMetricsSchema>;

/** Metric keys that must exist in the database view. Asserted by tests. */
export const DASHBOARD_METRIC_KEYS = Object.keys(
  DashboardMetricsSchema.shape
) as (keyof DashboardMetrics)[];
