// Scheduled via pg_cron or Supabase Dashboard / Vercel Cron: runs each morning.
// For every company it computes the company-local "yesterday" business date and
// invokes the server-side attendance-close engine (run_daily_attendance_close),
// which honours weekly-off rules, company/location holidays and marks
// missing-punch exceptions. The engine is the single source of truth — this
// function only orchestrates per company.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

function businessYesterday(timeZone: string): string {
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  const parts = formatter.formatToParts(new Date());
  const pick = (t: string) => parts.find((p) => p.type === t)?.value ?? "";
  const today = new Date(`${pick("year")}-${pick("month")}-${pick("day")}T00:00:00`);
  today.setDate(today.getDate() - 1);
  return today.toISOString().slice(0, 10);
}

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

  const { data: companies, error: compErr } = await supabase
    .from("companies")
    .select("id, timezone")
    .eq("is_active", true);

  if (compErr || !companies?.length) {
    return new Response(
      JSON.stringify({ error: compErr?.message ?? "No active companies found" }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }

  const results: Array<{ company_id: string; business_date: string; run_id: string | null; error?: string }> = [];

  for (const company of companies as Array<{ id: string; timezone: string | null }>) {
    const tz = company.timezone || "Asia/Kolkata";
    const businessDate = businessYesterday(tz);
    const { data: runId, error } = await supabase.rpc("run_daily_attendance_close", {
      p_company_id: company.id,
      p_business_date: businessDate,
    });
    if (error) {
      results.push({ company_id: company.id, business_date: businessDate, run_id: null, error: error.message });
    } else {
      results.push({ company_id: company.id, business_date: businessDate, run_id: runId as string });
    }
  }

  const failed = results.filter((r) => r.error);
  return new Response(JSON.stringify({ processed: results.length, failed: failed.length, results }), {
    status: failed.length ? 207 : 200,
    headers: { "Content-Type": "application/json" },
  });
});
