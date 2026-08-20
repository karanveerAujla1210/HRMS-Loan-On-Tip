// Scheduled via pg_cron or Supabase Dashboard: runs at 11:00 AM daily.
// Marks employees with no approved check-in for the prior workday as absent.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

Deno.serve(async () => {
  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  const workDate = yesterday.toISOString().slice(0, 10);

  const { data: employees } = await supabase
    .from("profiles")
    .select("id")
    .eq("employment_status", "active");

  if (!employees?.length) return new Response("no employees");

  const { data: existing } = await supabase
    .from("attendance")
    .select("employee_id")
    .eq("work_date", workDate);

  const presentIds = new Set((existing ?? []).map((r: { employee_id: string }) => r.employee_id));
  const absentRows = employees
    .filter((e: { id: string }) => !presentIds.has(e.id))
    .map((e: { id: string }) => ({ employee_id: e.id, work_date: workDate, status: "absent" }));

  if (absentRows.length) await supabase.from("attendance").insert(absentRows);

  return new Response(`marked ${absentRows.length} absent for ${workDate}`);
});
