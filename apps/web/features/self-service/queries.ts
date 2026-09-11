import { supabase } from "@/lib/supabase";

/** The employee's own expense claims, newest first. */
export async function fetchMyExpenses(employeeId: string) {
  const res = await supabase
    .from("expenses")
    .select("*")
    .eq("employee_id", employeeId)
    .order("submitted_at", { ascending: false })
    .limit(50);

  return (res.data as Record<string, unknown>[]) ?? [];
}

/** The employee's own helpdesk tickets, newest first. */
export async function fetchMyHelpdeskTickets(employeeId: string) {
  const res = await supabase
    .from("helpdesk_tickets")
    .select("*")
    .eq("employee_id", employeeId)
    .order("created_at", { ascending: false })
    .limit(50);

  return (res.data as Record<string, unknown>[]) ?? [];
}
