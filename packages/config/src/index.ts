export const SHIFT_START_HOUR = 9;
export const SHIFT_START_MINUTE = 30;
export const SHIFT_END_HOUR = 18;
export const SHIFT_END_MINUTE = 30;

export const ATTENDANCE_GRACE_MINUTES = 15;
export const GEO_RADIUS_M = 150;
export const GPS_ACCURACY_WARN_M = 100;

export const DAILY_CLOSE_HOUR = 11; // next day 11 AM locks prior workday

export const LEAVE_TYPES = ["casual", "sick", "earned", "unpaid", "comp_off"] as const;
export type LeaveType = (typeof LEAVE_TYPES)[number];
