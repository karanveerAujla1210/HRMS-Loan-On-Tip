/**
 * Role-based access control contract.
 *
 * The matrix in this file is the single source of truth for the application
 * layer. `supabase/migrations/35_rbac.sql` seeds the identical matrix into
 * `roles` / `permissions` / `role_permissions`, and
 * `tests/db/rbac-matrix.test.ts` fails the build if the two ever diverge.
 */

export const ROLES = [
  "SUPER_ADMIN",
  "HR_ADMIN",
  "FINANCE_ADMIN",
  "ASSET_ADMIN",
  "OPERATIONS_ADMIN",
  "LOCATION_ADMIN",
  "MANAGER",
  "EMPLOYEE",
] as const;

export type Role = (typeof ROLES)[number];

/**
 * Product-vocabulary aliases accepted on input and normalised to the canonical
 * database role codes. Prevents parallel role taxonomies.
 */
export const ROLE_ALIASES: Record<string, Role> = {
  FINANCE: "FINANCE_ADMIN",
  HR: "HR_ADMIN",
  ADMIN: "SUPER_ADMIN",
  SUPERADMIN: "SUPER_ADMIN",
  ASSET: "ASSET_ADMIN",
};

export function normaliseRole(input: string | null | undefined): Role | null {
  if (!input) return null;
  const upper = input.trim().toUpperCase().replace(/[\s-]+/g, "_");
  if ((ROLES as readonly string[]).includes(upper)) return upper as Role;
  return ROLE_ALIASES[upper] ?? null;
}

export const PERMISSION_MODULES = [
  "PEOPLE",
  "ATTENDANCE",
  "LEAVE",
  "PAYROLL",
  "ASSETS",
  "REPORTS",
  "EXPENSES",
  "PERFORMANCE",
  "HELPDESK",
  "SYSTEM",
] as const;
export type PermissionModule = (typeof PERMISSION_MODULES)[number];

type PermissionDefinition = {
  readonly code: string;
  readonly name: string;
  readonly module: PermissionModule;
};

/**
 * Complete permission catalogue. Codes are stable API surface: they appear in
 * `/api/v1/auth/session` responses and drive UI gating.
 */
export const PERMISSIONS = [
  // ── People ────────────────────────────────────────────────────────────────
  { code: "employee.view", name: "View Employees", module: "PEOPLE" },
  { code: "employee.create", name: "Create Employee", module: "PEOPLE" },
  { code: "employee.update", name: "Update Employee", module: "PEOPLE" },
  { code: "employee.delete", name: "Delete Employee", module: "PEOPLE" },
  { code: "employee.offboard", name: "Offboard Employee", module: "PEOPLE" },
  { code: "employee.document.view", name: "View Employee Documents", module: "PEOPLE" },
  { code: "employee.document.manage", name: "Manage Employee Documents", module: "PEOPLE" },
  { code: "employee.salary.view", name: "View Employee Salary", module: "PEOPLE" },
  { code: "employee.salary.manage", name: "Manage Employee Salary", module: "PEOPLE" },
  { code: "employee.bank.view", name: "View Employee Bank Details", module: "PEOPLE" },
  { code: "resignation.manage", name: "Manage Resignations", module: "PEOPLE" },

  // ── Attendance ────────────────────────────────────────────────────────────
  { code: "attendance.mark_self", name: "Mark Own Attendance", module: "ATTENDANCE" },
  { code: "attendance.view", name: "View Attendance", module: "ATTENDANCE" },
  { code: "attendance.adjust", name: "Adjust Attendance", module: "ATTENDANCE" },
  { code: "attendance.approve", name: "Approve Attendance", module: "ATTENDANCE" },
  { code: "attendance.close", name: "Run Attendance Daily Close", module: "ATTENDANCE" },

  // ── Leave ─────────────────────────────────────────────────────────────────
  { code: "leave.view", name: "View Leaves", module: "LEAVE" },
  { code: "leave.apply", name: "Apply Leave", module: "LEAVE" },
  { code: "leave.approve", name: "Approve Leave", module: "LEAVE" },
  { code: "leave.balance.manage", name: "Manage Leave Balances", module: "LEAVE" },

  // ── Payroll ───────────────────────────────────────────────────────────────
  { code: "payroll.view", name: "View Payroll", module: "PAYROLL" },
  { code: "payroll.create", name: "Create Payroll", module: "PAYROLL" },
  { code: "payroll.calculate", name: "Calculate Payroll", module: "PAYROLL" },
  { code: "payroll.approve", name: "Approve Payroll", module: "PAYROLL" },
  { code: "payroll.lock", name: "Lock Payroll", module: "PAYROLL" },
  { code: "payslip.view_all", name: "View All Payslips", module: "PAYROLL" },

  // ── Assets ────────────────────────────────────────────────────────────────
  { code: "asset.view", name: "View Assets", module: "ASSETS" },
  { code: "asset.create", name: "Create Asset", module: "ASSETS" },
  { code: "asset.update", name: "Update Asset", module: "ASSETS" },
  { code: "asset.assign", name: "Assign Asset", module: "ASSETS" },
  { code: "asset.return", name: "Return Asset", module: "ASSETS" },
  { code: "asset.repair", name: "Manage Asset Repairs", module: "ASSETS" },

  // ── Reports ───────────────────────────────────────────────────────────────
  { code: "reports.view", name: "View Reports", module: "REPORTS" },
  { code: "reports.export", name: "Export Reports", module: "REPORTS" },

  // ── Expenses / performance / helpdesk ─────────────────────────────────────
  { code: "expense.view", name: "View Expenses", module: "EXPENSES" },
  { code: "expense.approve", name: "Approve Expenses", module: "EXPENSES" },
  { code: "performance.view", name: "View Performance", module: "PERFORMANCE" },
  { code: "performance.manage", name: "Manage Performance", module: "PERFORMANCE" },
  { code: "helpdesk.view", name: "View Helpdesk", module: "HELPDESK" },
  { code: "helpdesk.manage", name: "Manage Helpdesk", module: "HELPDESK" },

  // ── System ────────────────────────────────────────────────────────────────
  { code: "audit.view", name: "View Audit Logs", module: "SYSTEM" },
  { code: "settings.manage", name: "Manage Settings", module: "SYSTEM" },
  { code: "organisation.manage", name: "Manage Organisation", module: "SYSTEM" },
  { code: "role.manage", name: "Manage Roles", module: "SYSTEM" },
] as const satisfies readonly PermissionDefinition[];

export type Permission = (typeof PERMISSIONS)[number]["code"];

export const PERMISSION_CODES: readonly Permission[] = PERMISSIONS.map((p) => p.code);

const ALL_PERMISSIONS = PERMISSION_CODES;

const EMPLOYEE_SELF_PERMISSIONS: readonly Permission[] = [
  "attendance.mark_self",
  "attendance.view",
  "leave.view",
  "leave.apply",
  "asset.view",
  "expense.view",
  "helpdesk.view",
  "employee.document.view",
];

/**
 * Role → permission matrix.
 *
 * Scope (own record / direct reports / company) is enforced separately by Row
 * Level Security and by the API layer; a permission only says *what* an actor
 * may do, never *whose* records.
 */
export const ROLE_PERMISSIONS: Record<Role, readonly Permission[]> = {
  SUPER_ADMIN: ALL_PERMISSIONS,

  HR_ADMIN: [
    ...EMPLOYEE_SELF_PERMISSIONS,
    "employee.create",
    "employee.update",
    "employee.offboard",
    "employee.document.manage",
    "resignation.manage",
    "attendance.adjust",
    "attendance.approve",
    "attendance.close",
    "leave.approve",
    "leave.balance.manage",
    "payroll.view",
    "reports.view",
    "reports.export",
    "expense.approve",
    "performance.view",
    "performance.manage",
    "helpdesk.manage",
    "organisation.manage",
  ],

  FINANCE_ADMIN: [
    ...EMPLOYEE_SELF_PERMISSIONS,
    "employee.salary.view",
    "employee.salary.manage",
    "employee.bank.view",
    "payroll.view",
    "payroll.create",
    "payroll.calculate",
    "payroll.approve",
    "payroll.lock",
    "payslip.view_all",
    "reports.view",
    "reports.export",
    "expense.approve",
  ],

  ASSET_ADMIN: [
    ...EMPLOYEE_SELF_PERMISSIONS,
    "asset.create",
    "asset.update",
    "asset.assign",
    "asset.return",
    "asset.repair",
    "reports.view",
    "reports.export",
  ],

  // Legacy role retained for backwards compatibility with existing
  // employee_roles rows. Operationally equivalent to ASSET_ADMIN plus
  // attendance visibility.
  OPERATIONS_ADMIN: [
    ...EMPLOYEE_SELF_PERMISSIONS,
    "asset.create",
    "asset.update",
    "asset.assign",
    "asset.return",
    "asset.repair",
    "reports.view",
    "reports.export",
  ],

  // Location-scoped supervisor. Row Level Security narrows visibility to the
  // locations recorded on employee_roles.location_id.
  LOCATION_ADMIN: [
    ...EMPLOYEE_SELF_PERMISSIONS,
    "attendance.adjust",
    "attendance.approve",
    "leave.approve",
    "reports.view",
  ],

  MANAGER: [
    ...EMPLOYEE_SELF_PERMISSIONS,
    "attendance.approve",
    "leave.approve",
    "reports.view",
    "expense.approve",
    "performance.view",
    "performance.manage",
  ],

  EMPLOYEE: EMPLOYEE_SELF_PERMISSIONS,
};

export function permissionsForRoles(roles: readonly string[]): Permission[] {
  const set = new Set<Permission>();
  for (const raw of roles) {
    const role = normaliseRole(raw);
    if (!role) continue;
    for (const permission of ROLE_PERMISSIONS[role]) set.add(permission);
  }
  return [...set];
}

export function roleHasPermission(role: Role, permission: Permission): boolean {
  return ROLE_PERMISSIONS[role].includes(permission);
}

/** Roles allowed to see other people's records at company scope. */
export const COMPANY_SCOPED_ROLES: readonly Role[] = [
  "SUPER_ADMIN",
  "HR_ADMIN",
  "FINANCE_ADMIN",
  "ASSET_ADMIN",
  "OPERATIONS_ADMIN",
];

/** Navigation gating used by the web shell. */
export const NAV_PERMISSIONS = {
  dashboard: null,
  people: "employee.view",
  attendance: "attendance.view",
  leave: "leave.view",
  payroll: "payroll.view",
  payslips: "payslip.view_all",
  assets: "asset.view",
  documents: "employee.document.view",
  organisation: "organisation.manage",
  reports: "reports.view",
  audit: "audit.view",
  settings: "settings.manage",
  selfService: null,
} as const;
