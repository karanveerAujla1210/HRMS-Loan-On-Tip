// Shared request/response types and Zod schemas consumed by web and mobile.
// Add zod as a dependency when schemas grow beyond simple types.

export type ApiResponse<T> = {
  data: T | null;
  error: string | null;
  requestId: string;
};

export type AttendanceStatus =
  | "present"
  | "absent"
  | "half_day"
  | "late"
  | "on_leave"
  | "holiday"
  | "week_off";

export type LeaveStatus = "pending" | "approved" | "rejected" | "cancelled";

export type AssetStatus = "in_stock" | "assigned" | "repair" | "lost" | "retired";

export type UserRole =
  | "super_admin"
  | "hr_admin"
  | "manager"
  | "employee"
  | "finance"
  | "asset_admin";

// --- Attendance ---
export type CheckInRequest = {
  latitude: number;
  longitude: number;
  accuracy_m: number;
  device_time: string; // ISO 8601
  idempotency_key: string;
};

export type CheckOutRequest = {
  latitude: number;
  longitude: number;
  accuracy_m: number;
  device_time: string;
};

// --- Leaves ---
export type LeaveRequest = {
  leave_type: string;
  start_date: string;
  end_date: string;
  is_half_day?: boolean;
  reason?: string;
};

export type LeaveReview = {
  status: "approved" | "rejected";
  note?: string;
};

// --- Assets ---
export type AssetAssignRequest = {
  employee_id: string;
  condition_out: string;
  due_back_at?: string;
};
