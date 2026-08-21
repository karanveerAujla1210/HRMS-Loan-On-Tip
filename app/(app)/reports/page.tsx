"use client";

import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useProfile } from "@/lib/useProfile";
import PageHeader from "@/components/PageHeader";
import DataTable from "@/components/DataTable";

type Row = Record<string, unknown>;
type Tab = "attendance" | "leave" | "headcount" | "payroll" | "assets" | "audit";

function today() { return new Date().toISOString().slice(0, 10); }
function monthStart() { const d = new Date(); d.setDate(1); return d.toISOString().slice(0, 10); }

export default function ReportsPage() {
  const { companyId } = useProfile();
  const [tab, setTab] = useState<Tab>("attendance");
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(false);
  const [from, setFrom] = useState(monthStart());
  const [to, setTo] = useState(today());
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!companyId) return;
    setLoading(true);
    setError(null);

    let data: Row[] = [];
    let err: { message: string } | null = null;

    if (tab === "attendance") {
      const res = await supabase
        .from("v_attendance")
        .select("employee_code,display_name,department,attendance_date,status,check_in_at,check_out_at,worked_minutes,late_minutes")
        .eq("company_id", companyId)
        .gte("attendance_date", from)
        .lte("attendance_date", to)
        .order("attendance_date", { ascending: false })
        .order("display_name")
        .limit(1000);
      data = (res.data as Row[]) ?? [];
      err = res.error;
    } else if (tab === "leave") {
      const res = await supabase
        .from("leave_requests")
        .select("id,from_date,to_date,total_days,status,submitted_at,employees(employee_code,display_name,departments(name)),leave_types(name)")
        .gte("from_date", from)
        .lte("to_date", to)
        .order("submitted_at", { ascending: false })
        .limit(500);
      data = ((res.data ?? []) as Record<string, unknown>[]).map((r) => ({
        employee_code: (r.employees as Record<string, unknown> | null)?.employee_code ?? "—",
        display_name:  (r.employees as Record<string, unknown> | null)?.display_name ?? "—",
        department:    ((r.employees as Record<string, unknown> | null)?.departments as Record<string, unknown> | null)?.name ?? "—",
        leave_type:    (r.leave_types as Record<string, unknown> | null)?.name ?? "—",
        from_date: r.from_date, to_date: r.to_date, total_days: r.total_days, status: r.status,
      }));
      err = res.error;
    } else if (tab === "headcount") {
      const res = await supabase
        .from("v_department_headcount")
        .select("*")
        .eq("company_id", companyId)
        .order("department");
      data = (res.data as Row[]) ?? [];
      err = res.error;
    } else if (tab === "payroll") {
      const res = await supabase
        .from("payroll_runs")
        .select("payroll_year,payroll_month,status,employee_count,gross_pay,total_deductions,net_pay,created_at")
        .eq("company_id", companyId)
        .order("payroll_year", { ascending: false })
        .order("payroll_month", { ascending: false })
        .limit(24);
      data = (res.data as Row[]) ?? [];
      err = res.error;
    } else if (tab === "assets") {
      const res = await supabase
        .from("v_asset_inventory")
        .select("asset_code,category,model,serial_number,status,condition,assigned_to,warranty_end")
        .eq("company_id", companyId)
        .order("status")
        .order("asset_code")
        .limit(500);
      data = (res.data as Row[]) ?? [];
      err = res.error;
    } else if (tab === "audit") {
      const res = await supabase
        .from("audit_logs")
        .select("created_at,action,entity_type,entity_id,employees!actor_employee_id(display_name)")
        .eq("company_id", companyId)
        .gte("created_at", from + "T00:00:00Z")
        .lte("created_at", to + "T23:59:59Z")
        .order("created_at", { ascending: false })
        .limit(500);
      data = ((res.data ?? []) as Record<string, unknown>[]).map((r) => ({
        created_at: r.created_at,
        actor: (r.employees as Record<string, unknown> | null)?.display_name ?? "System",
        action: r.action,
        entity_type: r.entity_type,
        entity_id: r.entity_id,
      }));
      err = res.error;
    }

    if (err) setError(err.message);
    setRows(data);
    setLoading(false);
  }, [companyId, tab, from, to]);

  useEffect(() => { void load(); }, [load]);

  function exportCSV() {
    if (!rows.length) return;
    const keys = Object.keys(rows[0]);
    const csv = [keys.join(","), ...rows.map(r => keys.map(k => `"${String(r[k] ?? "").replace(/"/g, '""')}"`).join(","))].join("\n");
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
    a.download = `${tab}-report-${from}-${to}.csv`;
    a.click();
  }

  const TABS: { key: Tab; label: string }[] = [
    { key: "attendance", label: "Attendance" },
    { key: "leave",      label: "Leave" },
    { key: "headcount",  label: "Headcount" },
    { key: "payroll",    label: "Payroll" },
    { key: "assets",     label: "Assets" },
    { key: "audit",      label: "Audit Trail" },
  ];

  const colMap: Record<Tab, string[]> = {
    attendance: ["employee_code","display_name","department","attendance_date","status","check_in_at","check_out_at","worked_minutes","late_minutes"],
    leave:      ["employee_code","display_name","department","leave_type","from_date","to_date","total_days","status"],
    headcount:  ["department","active_count","notice_count","total_count"],
    payroll:    ["payroll_year","payroll_month","status","employee_count","gross_pay","total_deductions","net_pay"],
    assets:     ["asset_code","category","model","serial_number","status","condition","assigned_to","warranty_end"],
    audit:      ["created_at","actor","action","entity_type","entity_id"],
  };

  const showDateRange = ["attendance","leave","audit"].includes(tab);

  return (
    <>
      <PageHeader
        title="Reports"
        subtitle="HR, payroll, attendance and audit reports"
        actions={
          <button className="btn btn-secondary btn-sm" onClick={exportCSV} disabled={!rows.length}>
            ⬇ Export CSV
          </button>
        }
      />

      <div className="page-body">
        {error && <div className="alert alert-error">{error}</div>}

        <div style={{ display: "flex", gap: 8, marginBottom: 20, flexWrap: "wrap" }}>
          {TABS.map(({ key, label }) => (
            <button key={key} className={`btn btn-sm ${tab === key ? "btn-primary" : "btn-secondary"}`} onClick={() => setTab(key)}>
              {label}
            </button>
          ))}
        </div>

        <div className="card">
          <div className="card-header" style={{ flexWrap: "wrap", gap: 10 }}>
            <div><h2>{TABS.find(t => t.key === tab)?.label} Report</h2><p>{rows.length} records</p></div>
            <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
              {showDateRange && (
                <>
                  <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                    <label style={{ margin: 0, whiteSpace: "nowrap" }}>From</label>
                    <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} style={{ width: "auto" }} />
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                    <label style={{ margin: 0, whiteSpace: "nowrap" }}>To</label>
                    <input type="date" value={to} onChange={(e) => setTo(e.target.value)} style={{ width: "auto" }} />
                  </div>
                </>
              )}
              <button className="btn btn-ghost btn-sm" onClick={() => void load()}>↻ Run</button>
            </div>
          </div>
          {loading ? (
            <div className="loading-spinner"><div className="spinner" /> Loading…</div>
          ) : (
            <DataTable rows={rows} columns={colMap[tab]} />
          )}
        </div>
      </div>
    </>
  );
}
