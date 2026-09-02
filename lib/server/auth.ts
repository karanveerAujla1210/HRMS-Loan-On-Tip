import "server-only";
import {
  normaliseRole,
  permissionsForRoles,
  type Permission,
  type Role,
} from "@hrms/api-contract";
import { DEFAULT_TIMEZONE } from "@hrms/config";
import { forbidden, unauthorized } from "./errors";
import { adminClient, createUserClient, hasAdminCredentials, type Db } from "./supabase";
import { ERROR_CODES } from "@hrms/api-contract";
import { ApiError } from "./errors";

export type AuthContext = {
  /** Verified Supabase auth user id. Never taken from the request body. */
  authUserId: string;
  email: string | null;
  profileId: string | null;
  employeeId: string | null;
  employeeCode: string | null;
  displayName: string | null;
  companyId: string | null;
  companyName: string | null;
  locationId: string | null;
  managerId: string | null;
  timezone: string;
  roles: Role[];
  primaryRole: Role | null;
  permissions: Permission[];
  /**
   * Session-scoped client honouring Row Level Security. Absent for system /
   * cron contexts, which should use an admin client explicitly.
   */
  db?: Db;
};

const ROLE_PRECEDENCE: Role[] = [
  "SUPER_ADMIN",
  "HR_ADMIN",
  "FINANCE_ADMIN",
  "ASSET_ADMIN",
  "OPERATIONS_ADMIN",
  "LOCATION_ADMIN",
  "MANAGER",
  "EMPLOYEE",
];

type ProfileRow = {
  id: string;
  employee_id: string | null;
  company_id: string | null;
  email: string | null;
};

type EmployeeRow = {
  id: string;
  employee_code: string | null;
  display_name: string | null;
  company_id: string;
  location_id: string | null;
  manager_id: string | null;
  employment_status: string;
};

/**
 * Resolves the caller's identity, company and effective permissions.
 *
 * Identity always comes from `auth.getUser()` (a verified round-trip to the
 * auth server), never from a cookie payload or a request field. Role lookup
 * uses the privileged client so that a restrictive Row Level Security policy on
 * `employee_roles` can never silently downgrade an administrator.
 */
export async function getAuthContext(request?: Request): Promise<AuthContext> {
  const authorization = request?.headers.get("authorization");
  const bearerToken = authorization?.match(/^Bearer\s+(.+)$/i)?.[1];
  const db = await createUserClient(bearerToken);
  const {
    data: { user },
    error,
  } = await db.auth.getUser();

  if (error || !user) throw unauthorized();

  const lookup: Db = hasAdminCredentials() ? adminClient() : db;

  const { data: profile } = await lookup
    .from("profiles")
    .select("id,employee_id,company_id,email")
    .eq("auth_user_id", user.id)
    .maybeSingle<ProfileRow>();

  let employee: EmployeeRow | null = null;
  if (profile?.employee_id) {
    const { data } = await lookup
      .from("employees")
      .select(
        "id,employee_code,display_name,company_id,location_id,manager_id,employment_status"
      )
      .eq("id", profile.employee_id)
      .maybeSingle<EmployeeRow>();
    employee = data ?? null;
  }

  const roles: Role[] = [];
  if (employee) {
    const { data: roleRows } = await lookup
      .from("employee_roles")
      .select("roles(code)")
      .eq("employee_id", employee.id)
      .eq("is_active", true);

    for (const row of (roleRows ?? []) as unknown as { roles: { code: string } | null }[]) {
      const role = normaliseRole(row.roles?.code);
      if (role && !roles.includes(role)) roles.push(role);
    }
  }

  // If no roles assigned yet (empty employee_roles table), fall back to SUPER_ADMIN.
  // TODO: remove once employee_roles is populated.
  if (employee && roles.length === 0) {
    const { count } = await lookup.from("employee_roles").select("id", { count: "exact", head: true });
    roles.push(count === 0 ? "SUPER_ADMIN" : "EMPLOYEE");
  }

  const companyId = profile?.company_id ?? employee?.company_id ?? null;

  let companyName: string | null = null;
  let timezone = DEFAULT_TIMEZONE;
  if (companyId) {
    const { data: company } = await lookup
      .from("companies")
      .select("display_name,timezone")
      .eq("id", companyId)
      .maybeSingle<{ display_name: string; timezone: string }>();
    companyName = company?.display_name ?? null;
    timezone = company?.timezone ?? DEFAULT_TIMEZONE;
  }

  const primaryRole = ROLE_PRECEDENCE.find((r) => roles.includes(r)) ?? null;

  return {
    authUserId: user.id,
    email: user.email ?? profile?.email ?? null,
    profileId: profile?.id ?? null,
    employeeId: employee?.id ?? null,
    employeeCode: employee?.employee_code ?? null,
    displayName: employee?.display_name ?? null,
    companyId,
    companyName,
    locationId: employee?.location_id ?? null,
    managerId: employee?.manager_id ?? null,
    timezone,
    roles,
    primaryRole,
    permissions: permissionsForRoles(roles),
    db,
  };
}

export function hasPermission(ctx: AuthContext, permission: Permission): boolean {
  return ctx.permissions.includes(permission);
}

export function hasAnyPermission(
  ctx: AuthContext,
  permissions: readonly Permission[]
): boolean {
  return permissions.some((p) => ctx.permissions.includes(p));
}

export function requirePermission(ctx: AuthContext, permission: Permission): void {
  if (!hasPermission(ctx, permission)) {
    throw forbidden(`Missing required permission: ${permission}`);
  }
}

export function requireAnyPermission(
  ctx: AuthContext,
  permissions: readonly Permission[]
): void {
  if (!hasAnyPermission(ctx, permissions)) {
    throw forbidden(`Missing one of the required permissions: ${permissions.join(", ")}`);
  }
}

/** Requires a linked employee record; returns its id. */
export function requireEmployee(ctx: AuthContext): string {
  if (!ctx.employeeId) {
    throw new ApiError(ERROR_CODES.EMPLOYEE_NOT_LINKED);
  }
  return ctx.employeeId;
}

/** Requires a resolved company; returns its id. */
export function requireCompany(ctx: AuthContext): string {
  if (!ctx.companyId) {
    throw new ApiError(ERROR_CODES.COMPANY_NOT_RESOLVED);
  }
  return ctx.companyId;
}

export function isSuperAdmin(ctx: AuthContext): boolean {
  return ctx.roles.includes("SUPER_ADMIN");
}

/**
 * True when the actor may act on another employee's record for a given
 * permission: either they hold the permission at company scope, or the target
 * is one of their direct reports, or it is their own record.
 */
export async function canActOnEmployee(
  ctx: AuthContext,
  targetEmployeeId: string,
  permission: Permission
): Promise<boolean> {
  if (ctx.employeeId === targetEmployeeId) return true;
  if (!hasPermission(ctx, permission)) return false;
  if (
    ctx.roles.some((r) =>
      ["SUPER_ADMIN", "HR_ADMIN", "FINANCE_ADMIN", "ASSET_ADMIN", "OPERATIONS_ADMIN"].includes(r)
    )
  ) {
    return true;
  }
  // Manager / location admin: only their reporting line.
  const { data } = await ctx.db!
    .from("employees")
    .select("id,manager_id,location_id")
    .eq("id", targetEmployeeId)
    .maybeSingle<{ id: string; manager_id: string | null; location_id: string | null }>();
  if (!data) return false;
  if (ctx.employeeId && data.manager_id === ctx.employeeId) return true;
  if (ctx.roles.includes("LOCATION_ADMIN") && ctx.locationId && data.location_id === ctx.locationId) {
    return true;
  }
  return false;
}
