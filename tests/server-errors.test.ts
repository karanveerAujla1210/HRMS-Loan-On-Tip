import { describe, expect, it } from "vitest";
import { mapDatabaseError, toApiError } from "../apps/web/lib/server/errors";

describe("public API error sanitization", () => {
  it("does not expose PostgreSQL constraint details", () => {
    const result = mapDatabaseError({
      code: "23503",
      message: 'insert on table "payroll_items_internal" violates constraint "secret_fk_constraint"',
      details: "sensitive row detail",
      hint: "internal hint",
    }).toBody();

    expect(JSON.stringify(result)).not.toContain("payroll_items_internal");
    expect(JSON.stringify(result)).not.toContain("secret_fk_constraint");
    expect(JSON.stringify(result)).not.toContain("sensitive row detail");
    expect(JSON.stringify(result)).not.toContain("internal hint");
  });

  it("does not echo database-raised HRMS messages", () => {
    const result = mapDatabaseError({
      code: "P0001",
      message: "HRMS:CONFLICT: internal table payroll_private has failed",
    }).toBody();

    expect(result.code).toBe("CONFLICT");
    expect(result.message).not.toContain("payroll_private");
    expect(result.message).not.toContain("internal table");
  });

  it("uses the central public message for tagged domain errors", () => {
    const result = mapDatabaseError({
      code: "P0001",
      message: "HRMS:CONFLICT: customer PII and internal query text",
    }).toBody();

    expect(result.code).toBe("CONFLICT");
    expect(result.message).not.toContain("customer PII");
    expect(result.message).not.toContain("internal query text");
  });

  it("does not expose unexpected exception messages", () => {
    const result = toApiError(new Error("postgres://private-host/db?password=secret")).toBody();
    expect(JSON.stringify(result)).not.toContain("private-host");
    expect(JSON.stringify(result)).not.toContain("password=secret");
  });
});
