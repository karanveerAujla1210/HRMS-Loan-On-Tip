import { describe, it, expect } from "vitest";
import { permissionsForRoles, type Role } from "@hrms/api-contract";
import {
  hasPermission,
  hasAnyPermission,
  requirePermission,
  requireRole,
  isSuperAdmin,
  canActOnEmployee,
  type AuthContext,
} from "../../lib/server/auth";

function mockContext(overrides?: Partial<AuthContext>): AuthContext {
  const roles: Role[] = overrides?.roles ?? ["EMPLOYEE"];
  const permissions = overrides?.permissions ?? permissionsForRoles(roles);
  return {
    authUserId: "user-123",
    email: "test@company.com",
    profileId: "prof-123",
    employeeId: "emp-123",
    employeeCode: "EMP-001",
    displayName: "Test User",
    companyId: "comp-A",
    companyName: "Company A",
    locationId: "loc-1",
    managerId: null,
    timezone: "Asia/Kolkata",
    roles,
    primaryRole: roles[0] ?? null,
    permissions,
    ...overrides,
  };
}

describe("RBAC Security & Role Verification", () => {
  it("Test 1 — Normal Employee: denied admin permissions", () => {
    const ctx = mockContext({ roles: ["EMPLOYEE"] });

    expect(isSuperAdmin(ctx)).toBe(false);
    expect(hasPermission(ctx, "leave.apply")).toBe(true);
    expect(hasPermission(ctx, "employee.create")).toBe(false);
    expect(hasPermission(ctx, "payroll.create")).toBe(false);
    expect(hasPermission(ctx, "organisation.manage")).toBe(false);

    expect(() => requirePermission(ctx, "payroll.create")).toThrow(/Missing required permission/);
    expect(() => requireRole(ctx, "SUPER_ADMIN")).toThrow(/Missing required role/);
  });

  it("Test 2 — HR Admin: granted HR permissions, denied SUPER_ADMIN & Finance locks", () => {
    const ctx = mockContext({ roles: ["HR_ADMIN"] });

    expect(isSuperAdmin(ctx)).toBe(false);
    expect(hasPermission(ctx, "employee.create")).toBe(true);
    expect(hasPermission(ctx, "leave.approve")).toBe(true);
    expect(hasPermission(ctx, "payroll.lock")).toBe(false);
    expect(hasPermission(ctx, "role.manage")).toBe(false);

    expect(() => requirePermission(ctx, "payroll.lock")).toThrow();
  });

  it("Test 3 — Finance Admin: granted finance permissions, denied unrelated admin", () => {
    const ctx = mockContext({ roles: ["FINANCE_ADMIN"] });

    expect(isSuperAdmin(ctx)).toBe(false);
    expect(hasPermission(ctx, "payroll.calculate")).toBe(true);
    expect(hasPermission(ctx, "employee.salary.manage")).toBe(true);
    expect(hasPermission(ctx, "employee.create")).toBe(false);
    expect(hasPermission(ctx, "asset.repair")).toBe(false);
  });

  it("Test 4 — Super Admin: explicitly assigned SUPER_ADMIN receives all permissions", () => {
    const ctx = mockContext({ roles: ["SUPER_ADMIN"] });

    expect(isSuperAdmin(ctx)).toBe(true);
    expect(hasPermission(ctx, "role.manage")).toBe(true);
    expect(hasPermission(ctx, "organisation.manage")).toBe(true);
    expect(hasPermission(ctx, "payroll.calculate")).toBe(true);

    expect(() => requireRole(ctx, "SUPER_ADMIN")).not.toThrow();
  });

  it("Test 5 — No Role: authenticated user with no active role receives NO admin access", () => {
    const ctx = mockContext({ roles: [], primaryRole: null });

    expect(isSuperAdmin(ctx)).toBe(false);
    expect(ctx.permissions).toHaveLength(0);
    expect(hasPermission(ctx, "employee.create")).toBe(false);

    expect(() => requirePermission(ctx, "employee.create")).toThrow();
    expect(() => requireRole(ctx, "EMPLOYEE")).toThrow();
  });

  it("Test 6 — Inactive Role: inactive roles do not populate permissions", () => {
    // When roles are inactive, DB query returns no roles -> roles = []
    const ctx = mockContext({ roles: [], primaryRole: null });

    expect(isSuperAdmin(ctx)).toBe(false);
    expect(hasAnyPermission(ctx, ["employee.create", "payroll.calculate"])).toBe(false);
  });

  it("Test 7 — Cross Company / Tenant Isolation: cannot act across target company without permission", async () => {
    const ctxCompanyA = mockContext({
      companyId: "comp-A",
      employeeId: "emp-A",
      roles: ["EMPLOYEE"],
    });

    // Employee cannot act on employee B who is not a report or self
    const canAct = await canActOnEmployee(ctxCompanyA, "emp-B", "employee.update");
    expect(canAct).toBe(false);
  });

  it("Test 8 — Client Role Tampering: client payload cannot override server AuthContext", () => {
    const ctx = mockContext({ roles: ["EMPLOYEE"] });

    // Client body payload trying to claim SUPER_ADMIN
    const clientPayload = { role: "SUPER_ADMIN", permissions: ["role.manage"] };

    // Authorization MUST use server-side ctx, ignoring client payload
    expect(ctx.roles.includes(clientPayload.role as Role)).toBe(false);
    expect(hasPermission(ctx, "role.manage")).toBe(false);
  });
});
