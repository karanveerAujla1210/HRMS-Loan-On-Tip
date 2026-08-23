import "server-only";
import { ATTENDANCE_DEFAULTS, PAYROLL_DEFAULTS, SETTING_KEYS } from "@hrms/config";
import type { StatutoryConfig } from "@hrms/domain";
import type { Db } from "./supabase";

type SettingRow = { setting_key: string; setting_value: string; data_type: string };

export type CompanySettings = {
  raw: Record<string, string>;
  number: (key: string, fallback: number) => number;
  bool: (key: string, fallback: boolean) => boolean;
  text: (key: string, fallback: string) => string;
};

/**
 * Loads `system_settings` for a company.
 *
 * Every operational threshold (geo-fence radius, grace period, statutory rates)
 * is configuration, never a literal in the code path. Missing keys fall back to
 * the documented defaults in `@hrms/config`.
 */
export async function loadCompanySettings(
  db: Db,
  companyId: string
): Promise<CompanySettings> {
  const { data } = await db
    .from("system_settings")
    .select("setting_key,setting_value,data_type")
    .eq("company_id", companyId);

  const raw: Record<string, string> = {};
  for (const row of (data ?? []) as SettingRow[]) {
    raw[row.setting_key] = row.setting_value;
  }

  return {
    raw,
    number: (key, fallback) => {
      const value = Number(raw[key]);
      return Number.isFinite(value) ? value : fallback;
    },
    bool: (key, fallback) => {
      const value = raw[key];
      if (value === undefined) return fallback;
      return ["true", "1", "yes", "on"].includes(value.trim().toLowerCase());
    },
    text: (key, fallback) => raw[key] ?? fallback,
  };
}

export type AttendancePolicy = {
  geoRadiusMeters: number;
  graceMinutes: number;
  maxAccuracyMeters: number;
  halfDayAfterMinutes: number;
  fullDayAfterMinutes: number;
  rejectOutsideRadius: boolean;
  rejectMockLocation: boolean;
  dailyCloseTime: string;
};

export function attendancePolicy(settings: CompanySettings): AttendancePolicy {
  return {
    geoRadiusMeters: settings.number(
      SETTING_KEYS.attendanceRadius,
      ATTENDANCE_DEFAULTS.geoRadiusMeters
    ),
    graceMinutes: settings.number(
      SETTING_KEYS.attendanceGraceMinutes,
      ATTENDANCE_DEFAULTS.graceMinutes
    ),
    maxAccuracyMeters: settings.number(
      SETTING_KEYS.attendanceMaxAccuracy,
      ATTENDANCE_DEFAULTS.maxAccuracyMeters
    ),
    halfDayAfterMinutes: settings.number(
      SETTING_KEYS.attendanceHalfDayMinutes,
      ATTENDANCE_DEFAULTS.halfDayAfterMinutes
    ),
    fullDayAfterMinutes: settings.number(
      SETTING_KEYS.attendanceFullDayMinutes,
      ATTENDANCE_DEFAULTS.fullDayAfterMinutes
    ),
    rejectOutsideRadius: settings.bool(SETTING_KEYS.attendanceRejectOutsideRadius, true),
    rejectMockLocation: settings.bool(SETTING_KEYS.attendanceRejectMockLocation, true),
    dailyCloseTime: settings.text(
      SETTING_KEYS.attendanceAutoAbsentTime,
      ATTENDANCE_DEFAULTS.dailyCloseTime
    ),
  };
}

export function statutoryConfig(settings: CompanySettings): StatutoryConfig {
  return {
    pfEmployeeRate: settings.number(
      SETTING_KEYS.payrollPfEmployeeRate,
      PAYROLL_DEFAULTS.pfEmployeeRate
    ),
    pfEmployerRate: settings.number(
      SETTING_KEYS.payrollPfEmployerRate,
      PAYROLL_DEFAULTS.pfEmployerRate
    ),
    pfWageCeiling: settings.number(
      SETTING_KEYS.payrollPfWageCeiling,
      PAYROLL_DEFAULTS.pfWageCeiling
    ),
    pfApplyCeiling: settings.bool(
      SETTING_KEYS.payrollPfApplyCeiling,
      PAYROLL_DEFAULTS.pfApplyCeiling
    ),
    esiGrossThreshold: settings.number(
      SETTING_KEYS.payrollEsiThreshold,
      PAYROLL_DEFAULTS.esiGrossThreshold
    ),
    esiEmployeeRate: settings.number(
      SETTING_KEYS.payrollEsiEmployeeRate,
      PAYROLL_DEFAULTS.esiEmployeeRate
    ),
    esiEmployerRate: settings.number(
      SETTING_KEYS.payrollEsiEmployerRate,
      PAYROLL_DEFAULTS.esiEmployerRate
    ),
    professionalTaxMonthly: settings.number(
      SETTING_KEYS.payrollProfessionalTax,
      PAYROLL_DEFAULTS.professionalTaxMonthly
    ),
    professionalTaxMinGross: settings.number(
      SETTING_KEYS.payrollProfessionalTaxMinGross,
      PAYROLL_DEFAULTS.professionalTaxMinGross
    ),
  };
}
