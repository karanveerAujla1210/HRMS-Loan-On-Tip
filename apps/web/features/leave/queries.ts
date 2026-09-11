import { supabase } from "@/lib/supabase";

/** Active leave types for a company (shared by leave apply forms). */
export async function fetchActiveLeaveTypes(companyId: string) {
  const res = await supabase
    .from("leave_types")
    .select("id,name,code")
    .eq("company_id", companyId)
    .eq("is_active", true);

  return (res.data as Record<string, unknown>[]) ?? [];
}

/** The employee's own leave requests, newest first. */
export async function fetchMyLeaveRequests(employeeId: string) {
  const res = await supabase
    .from("leave_requests")
    .select("id,from_date,to_date,total_days,status,submitted_at,leave_types(name)")
    .eq("employee_id", employeeId)
    .order("submitted_at", { ascending: false })
    .limit(50);

  return ((res.data ?? []) as Record<string, unknown>[]).map((r) => ({
    ...r,
    leave_type: (r.leave_types as Record<string, unknown> | null)?.name ?? "—",
  }));
}

/** The employee's own leave balances for the current year. */
export async function fetchMyLeaveBalances(employeeId: string, year: number) {
  const res = await supabase
    .from("leave_balances")
    .select("closing_balance,leave_types(name)")
    .eq("employee_id", employeeId)
    .eq("year", year);

  return ((res.data ?? []) as Record<string, unknown>[]).map((r) => ({
    leave_type: (r.leave_types as Record<string, unknown> | null)?.name ?? "—",
    balance: r.closing_balance,
  }));
}
