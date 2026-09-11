import { supabase } from "@/lib/supabase";

/** The employee's own payslips, newest first, with the payroll period resolved. */
export async function fetchMyPayslips(employeeId: string) {
  const res = await supabase
    .from("payslips")
    .select("id,payslip_number,gross_salary,deductions,net_salary,generated_at,payroll_runs(payroll_month,payroll_year)")
    .eq("employee_id", employeeId)
    .order("generated_at", { ascending: false })
    .limit(24);

  return ((res.data ?? []) as Record<string, unknown>[]).map((r) => {
    const run = r.payroll_runs as Record<string, unknown> | null;
    return { ...r, period: run ? `${run.payroll_year}/${String(run.payroll_month).padStart(2, "0")}` : "—" };
  });
}
