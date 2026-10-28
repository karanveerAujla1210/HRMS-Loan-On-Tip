import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

describe("HRMS schema snapshot contract", () => {
  const schema = readFileSync(resolve(process.cwd(), "supabase/migrations/01_schema.sql"), "utf8");

  it("contains the core HRMS modules", () => {
    for (const table of [
      "companies",
      "profiles",
      "employees",
      "employee_roles",
      "attendance",
      "leave_requests",
      "payroll_runs",
      "assets",
      "sim_cards",
      "sim_assignments",
      "audit_logs",
    ]) {
      expect(schema).toMatch(new RegExp(`CREATE TABLE public\\.${table}\\b`));
    }
  });

  it("contains row identity and access-control tables", () => {
    expect(schema).toMatch(/CREATE TABLE public\.roles\b/);
    expect(schema).toMatch(/CREATE TABLE public\.permissions\b/);
    expect(schema).toMatch(/CREATE TABLE public\.role_permissions\b/);
  });
});
