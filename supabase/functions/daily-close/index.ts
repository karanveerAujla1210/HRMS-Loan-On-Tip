// Scheduled via pg_cron or Supabase Dashboard / Vercel Cron: runs at 11:00 AM daily.
// Automatically marks active employees without check-in or approved leave as ABSENT for the prior workday.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

Deno.serve(async (req) => {
  const authHeader = req.headers.get("Authorization");
  const cronSecret = Deno.env.get("CRON_SECRET");
  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return new Response("Unauthorized", { status: 401 });
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  const target = new Date();
  target.setDate(target.getDate() - 1);
  const targetDate = target.toISOString().slice(0, 10);
  const dayOfWeek = target.getDay(); // 0 = Sunday, 6 = Saturday

  // Skip Sunday if general weekly off
  if (dayOfWeek === 0) {
    return new Response(`Skipped: ${targetDate} is Sunday (Weekly off).`);
  }

  // 1. Fetch all active employees
  const { data: employees, error: empErr } = await supabase
    .from("employees")
    .select("id, company_id, location_id")
    .eq("employment_status", "ACTIVE");

  if (empErr || !employees?.length) {
    return new Response(`No active employees found or error: ${empErr?.message}`);
  }

  // 2. Fetch existing attendance records for targetDate
  const { data: existingAttendance } = await supabase
    .from("attendance")
    .select("employee_id")
    .eq("attendance_date", targetDate);

  const existingSet = new Set((existingAttendance ?? []).map((r) => r.employee_id));

  // 3. Fetch approved leaves covering targetDate
  const { data: activeLeaves } = await supabase
    .from("leave_requests")
    .select("employee_id")
    .eq("status", "APPROVED")
    .lte("from_date", targetDate)
    .gte("to_date", targetDate);

  const leaveSet = new Set((activeLeaves ?? []).map((r) => r.employee_id));

  // 4. Fetch holidays on targetDate
  const { data: holidays } = await supabase
    .from("holidays")
    .select("company_id, location_id")
    .eq("holiday_date", targetDate);

  const isGlobalHoliday = holidays?.some((h) => !h.location_id);
  const holidayLocationSet = new Set(holidays?.filter((h) => h.location_id).map((h) => h.location_id));

  const absentRows = [];
  const leaveRows = [];

  for (const emp of employees) {
    if (existingSet.has(emp.id)) continue;

    // Check holiday
    if (isGlobalHoliday || (emp.location_id && holidayLocationSet.has(emp.location_id))) {
      continue;
    }

    // Check approved leave
    if (leaveSet.has(emp.id)) {
      leaveRows.push({
        employee_id: emp.id,
        company_id: emp.company_id,
        location_id: emp.location_id || null,
        attendance_date: targetDate,
        status: "ON_LEAVE",
        source: "SYSTEM",
      });
    } else {
      absentRows.push({
        employee_id: emp.id,
        company_id: emp.company_id,
        location_id: emp.location_id || null,
        attendance_date: targetDate,
        status: "ABSENT",
        source: "SYSTEM",
      });
    }
  }

  const inserts = [...absentRows, ...leaveRows];
  if (inserts.length) {
    const { error: insertErr } = await supabase
      .from("attendance")
      .upsert(inserts, { onConflict: "employee_id,attendance_date" });

    if (insertErr) {
      return new Response(`Insert error: ${insertErr.message}`, { status: 500 });
    }
  }

  return new Response(
    JSON.stringify({
      target_date: targetDate,
      marked_absent: absentRows.length,
      marked_leave: leaveRows.length,
      total_active_employees: employees.length,
    }),
    { headers: { "Content-Type": "application/json" } }
  );
});
