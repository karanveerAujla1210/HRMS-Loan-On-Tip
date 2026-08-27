import { describe, it, expect } from "vitest";
import { PAYROLL_DEFAULTS } from "@hrms/config";
import {
  computePayroll,
  deriveAttendanceStatus,
  calculateLeaveDays,
  closingLeaveBalance,
  haversineMeters,
  formatInr,
  type StatutoryConfig,
  type StructureComponent,
  type ShiftConfig,
} from "@hrms/domain";

const statutory: StatutoryConfig = {
  pfEmployeeRate: PAYROLL_DEFAULTS.pfEmployeeRate,
  pfEmployerRate: PAYROLL_DEFAULTS.pfEmployerRate,
  pfWageCeiling: PAYROLL_DEFAULTS.pfWageCeiling,
  pfApplyCeiling: PAYROLL_DEFAULTS.pfApplyCeiling,
  esiGrossThreshold: PAYROLL_DEFAULTS.esiGrossThreshold,
  esiEmployeeRate: PAYROLL_DEFAULTS.esiEmployeeRate,
  esiEmployerRate: PAYROLL_DEFAULTS.esiEmployerRate,
  professionalTaxMonthly: PAYROLL_DEFAULTS.professionalTaxMonthly,
  professionalTaxMinGross: PAYROLL_DEFAULTS.professionalTaxMinGross,
};

const basicStructure: StructureComponent[] = [
  { code: "BASIC", name: "Basic", type: "EARNING", method: "PERCENT_OF_CTC", percentage: 40, prorate: true, taxable: true },
  { code: "HRA", name: "HRA", type: "EARNING", method: "PERCENT_OF", percentage: 50, baseCode: "BASIC", prorate: true, taxable: true },
  { code: "CONVEYANCE", name: "Conveyance", type: "EARNING", method: "FIXED", value: 1600, prorate: true, taxable: false },
  { code: "SPECIAL", name: "Special Allowance", type: "EARNING", method: "PERCENT_OF_CTC", percentage: 40, prorate: true, taxable: true },
  { code: "PF_EMPLOYEE", name: "Provident Fund", type: "STATUTORY", method: "PERCENT_OF", percentage: 12, baseCode: "BASIC", prorate: true },
  { code: "PROFESSIONAL_TAX", name: "Professional Tax", type: "STATUTORY", method: "FIXED", value: 200, prorate: false },
];

const shift: ShiftConfig = {
  startTime: "09:30",
  endTime: "18:30",
  graceMinutes: 15,
  breakMinutes: 0,
  halfDayAfterMinutes: 240,
  fullDayAfterMinutes: 360,
  isOvernight: false,
};

describe("computePayroll", () => {
  it("is structure-driven, not a hardcoded split", () => {
    const result = computePayroll({
      monthlyCtc: 100000,
      workingDays: 30,
      paidDays: 30,
      lopDays: 0,
      components: basicStructure,
      statutory,
      engineVersion: "test",
    });

    const basic = result.earnings.find((e) => e.code === "BASIC");
    const hra = result.earnings.find((e) => e.code === "HRA");
    // HRA must be 50% of BASIC (structure-driven), not a 20% of CTC guess.
    expect(basic?.amount).toBeCloseTo(40000, 0);
    expect(hra?.amount).toBeCloseTo(20000, 0);
    expect(result.grossEarnings).toBeCloseTo(40000 + 20000 + 1600 + 40000, 0);
  });

  it("prorates earnings by paid days", () => {
    const full = computePayroll({ monthlyCtc: 60000, workingDays: 30, paidDays: 30, lopDays: 0, components: basicStructure, statutory, engineVersion: "t" });
    const half = computePayroll({ monthlyCtc: 60000, workingDays: 30, paidDays: 15, lopDays: 0, components: basicStructure, statutory, engineVersion: "t" });
    expect(half.grossEarnings).toBeCloseTo(full.grossEarnings / 2, 0);
  });

  it("caps PF at the statutory wage ceiling", () => {
    const result = computePayroll({ monthlyCtc: 100000, workingDays: 30, paidDays: 30, lopDays: 0, components: basicStructure, statutory, engineVersion: "test" });
    const pf = result.deductions.find((d) => d.code === "PF_EMPLOYEE");
    // BASIC=40000 but ceiling is 15000 -> 12% of 15000 = 1800.
    expect(pf?.amount).toBeCloseTo(1800, 0);
  });

  it("produces net = gross - deductions", () => {
    const result = computePayroll({ monthlyCtc: 80000, workingDays: 30, paidDays: 30, lopDays: 0, components: basicStructure, statutory, engineVersion: "t" });
    expect(result.netPay).toBeCloseTo(result.grossEarnings - result.totalDeductions, 1);
  });

  it("stamps the engine version", () => {
    const result = computePayroll({ monthlyCtc: 80000, workingDays: 30, paidDays: 30, lopDays: 0, components: basicStructure, statutory, engineVersion: "2026.08.1" });
    expect(result.engineVersion).toBe("2026.08.1");
  });
});

describe("deriveAttendanceStatus", () => {
  it("treats an approved leave day as ON_LEAVE, never ABSENT", () => {
    const { status } = deriveAttendanceStatus({
      punch: { checkInAt: null, checkOutAt: null, timeZone: "Asia/Kolkata", shift },
      day: { isHoliday: false, isWeeklyOff: false, onApprovedLeave: true },
    });
    expect(status).toBe("ON_LEAVE");
  });

  it("marks ABSENT with no punches and no leave", () => {
    const { status } = deriveAttendanceStatus({
      punch: { checkInAt: null, checkOutAt: null, timeZone: "Asia/Kolkata", shift },
      day: { isHoliday: false, isWeeklyOff: false, onApprovedLeave: false },
    });
    expect(status).toBe("ABSENT");
  });

  it("marks PRESENT when worked minutes reach a full day", () => {
    const { status } = deriveAttendanceStatus({
      punch: {
        checkInAt: new Date("2026-08-01T04:00:00Z"), // 09:30 IST
        checkOutAt: new Date("2026-08-01T13:00:00Z"), // 18:30 IST
        timeZone: "Asia/Kolkata",
        shift,
      },
      day: { isHoliday: false, isWeeklyOff: false, onApprovedLeave: false },
    });
    expect(status).toBe("PRESENT");
  });
});

describe("leave calculations", () => {
  it("counts inclusive day ranges", () => {
    expect(
      calculateLeaveDays({
        range: { from: "2026-08-01", to: "2026-08-05" },
        halfDay: false,
        holidays: [],
        weeklyOffDates: [],
        excludeNonWorkingDays: false,
      })
    ).toBe(5);
  });

  it("counts a single half-day as 0.5", () => {
    expect(
      calculateLeaveDays({
        range: { from: "2026-08-01", to: "2026-08-01" },
        halfDay: true,
        holidays: [],
        weeklyOffDates: [],
        excludeNonWorkingDays: false,
      })
    ).toBe(0.5);
  });

  it("computes closing balance from opening/accrued/used", () => {
    expect(closingLeaveBalance({ opening_balance: 10, accrued: 2, adjusted: 0, used: 3, encashed: 0 })).toBe(9);
  });
});

describe("geo & formatting", () => {
  it("computes distance between two coordinates", () => {
    const d = haversineMeters(
      { latitude: 28.6139, longitude: 77.209 },
      { latitude: 28.615, longitude: 77.21 }
    );
    expect(d).toBeGreaterThan(0);
    expect(d).toBeLessThan(500);
  });

  it("formats Indian Rupees", () => {
    expect(formatInr(123456.789)).toBe("₹1,23,456.79");
  });
});
