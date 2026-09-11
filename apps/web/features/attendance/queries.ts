import { supabase } from "@/lib/supabase";
import { monthStartISO } from "@/utils/date";

/** The employee's attendance record for today (may not exist yet). */
export async function fetchMyTodayAttendance(employeeId: string) {
  const res = await supabase
    .from("attendance")
    .select("*")
    .eq("employee_id", employeeId)
    .eq("attendance_date", new Date().toISOString().slice(0, 10))
    .maybeSingle();

  return (res.data as Record<string, unknown> | null) ?? null;
}

/** The employee's attendance history for the current month, newest first. */
export async function fetchMyAttendanceHistory(employeeId: string) {
  const res = await supabase
    .from("attendance")
    .select("id,attendance_date,status,check_in_at,check_out_at,worked_minutes")
    .eq("employee_id", employeeId)
    .gte("attendance_date", monthStartISO())
    .order("attendance_date", { ascending: false });

  return (res.data as Record<string, unknown>[]) ?? [];
}
