export type TabType = 
  | "dashboard" 
  | "attendance" 
  | "leave" 
  | "payroll" 
  | "expenses" 
  | "assets" 
  | "directory" 
  | "id-card" 
  | "profile" 
  | "approvals";

export type Session = {
  access_token: string;
  refresh_token?: string;
  user?: { id?: string; email?: string };
};

export type ProfileRow = {
  id?: string;
  employee_id?: string;
  display_name: string;
  employee_code: string;
  official_email: string;
  department: string;
  designation: string;
  location: string;
  joining_date: string;
  employment_status?: string;
  primary_role?: string;
};

export type AttendanceRow = {
  id: string;
  attendance_date: string;
  check_in_time: string | null;
  check_out_time: string | null;
  status: string;
  work_hours?: number;
  latitude?: number;
  longitude?: number;
};

export type LeaveRow = {
  id: string;
  from_date: string;
  to_date: string;
  total_days: number;
  status: string;
  reason?: string;
  leave_type_name?: string;
  submitted_at?: string;
};

export type LeaveBalanceRow = {
  id: string;
  leave_type_name: string;
  opening_balance: number;
  accrued: number;
  used: number;
  closing_balance: number;
};

export type PayslipRow = {
  id: string;
  payroll_month: number;
  payroll_year: number;
  net_pay: number;
  gross_pay: number;
  total_deductions: number;
  status: string;
  disbursed_at?: string;
};

export type ExpenseRow = {
  id: string;
  category: string;
  amount: number;
  expense_date: string;
  status: string;
  description?: string;
};

export type AssetRow = {
  id: string;
  asset_name: string;
  asset_tag: string;
  category: string;
  status: string;
  serial_number?: string;
  assigned_date?: string;
};

export type EmployeeRow = {
  id: string;
  display_name: string;
  employee_code: string;
  official_email: string;
  department: string;
  designation: string;
  location: string;
  employment_status: string;
};
