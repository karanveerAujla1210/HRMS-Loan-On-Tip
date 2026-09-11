"use client";

export const dynamic = "force-dynamic";

import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useProfile } from "@/hooks/useProfile";
import PageHeader from "@/components/PageHeader";
import DataTable from "@/components/DataTable";
import { Tabs } from "@/components/Tabs";
import { SkeletonTable } from "@/components/Skeleton";
import StatusBadge from "@/components/StatusBadge";

type Row = Record<string, unknown>;
type Tab = "attendance" | "leave" | "headcount" | "payroll" | "assets" | "audit";

function today() { return new Date().toISOString().slice(0, 10); }
function monthStart() { const d = new Date(); d.setDate(1); return d.toISOString().slice(0, 10); }

const TAB_ICONS: Record<Tab, React.ReactNode> = {
  attendance: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>,
  leave: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>,
  headcount: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>,
  payroll: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><rect x="2" y="6" width="20" height="12" rx="2"/><circle cx="12" cy="12" r="3"/></svg>,
  assets: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/></svg>,
  audit: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/></svg>,
};

export default function ReportsPage() {
  const { activeCompanyId: companyId, loading: profileLoading } = useProfile();
  const [tab, setTab] = useState<Tab>("attendance");
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(false);
  const [from, setFrom] = useState(monthStart());
  const [to, setTo] = useState(today());
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!companyId) { if (!profileLoading) setLoading(false); return; }
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
        .eq("company_id", companyId)
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
  }, [companyId, tab, from, to, profileLoading]);

  useEffect(() => { void load(); }, [load]);

  function exportCSV() {
    if (!rows.length) return;
    const firstRow = rows[0];
    if (!firstRow) return;
    const keys = Object.keys(firstRow);
    const csv = [keys.join(","), ...rows.map(r => keys.map(k => `"${String(r[k] ?? "").replace(/"/g, '""')}"`).join(","))].join("\n");
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
    a.download = `${tab}-report-${from}-${to}.csv`;
    a.click();
  }

  const TABS: { key: Tab; label: string; icon?: React.ReactNode }[] = [
    { key: "attendance", label: "Attendance", icon: TAB_ICONS.attendance },
    { key: "leave",      label: "Leave",      icon: TAB_ICONS.leave },
    { key: "headcount",  label: "Headcount",  icon: TAB_ICONS.headcount },
    { key: "payroll",    label: "Payroll",    icon: TAB_ICONS.payroll },
    { key: "assets",     label: "Assets",     icon: TAB_ICONS.assets },
    { key: "audit",      label: "Audit Trail",icon: TAB_ICONS.audit },
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
  const currentTabLabel = TABS.find(t => t.key === tab)?.label ?? tab;

  // Summary stats for current report
  const summaryStats = getSummaryStats(tab, rows);

  return (
    <>
      <PageHeader
        title="Reports & Analytics"
        subtitle="HR analytics, payroll ledgers, attendance summaries and compliance audit trails"
        breadcrumbs={[
          { label: "Dashboard", href: "/dashboard" },
          { label: "Reports & Analytics" },
        ]}
        actions={
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              onClick={() => void load()}
            >
              <IcRefresh /> Run Report
            </button>
            <button
              className="btn btn-primary btn-sm"
              onClick={exportCSV}
              disabled={!rows.length}
            >
              <IcDownload /> Export CSV
            </button>
          </div>
        }
      />

      <div className="page-body">
        {error && <div className="alert alert-error">{error}</div>}

        {/* Report Type Tabs */}
        <Tabs
          items={TABS}
          active={tab}
          onChange={(key) => setTab(key)}
          ariaLabel="Report type"
        />

        {/* Summary Stats Row */}
        {summaryStats.length > 0 && !loading && rows.length > 0 && (
          <div
            style={{
              display: "grid",
              gridTemplateColumns: `repeat(${Math.min(summaryStats.length, 4)}, 1fr)`,
              gap: 12,
              marginBottom: 20,
            }}
          >
            {summaryStats.map((stat) => (
              <div key={stat.label} className="metric-kpi-card" style={{ padding: "14px 16px" }}>
                <div className="metric-header" style={{ marginBottom: 8 }}>
                  <span className="metric-title">{stat.label}</span>
                  {stat.badge && (
                    <StatusBadge status={stat.badgeStatus ?? "ACTIVE"} customLabel={stat.badge} size="sm" />
                  )}
                </div>
                <div className="metric-number tabular-num" style={{ fontSize: 22 }}>{stat.value}</div>
                {stat.sub && <div className="metric-sub" style={{ marginTop: 4 }}>{stat.sub}</div>}
              </div>
            ))}
          </div>
        )}

        {/* Report Table Card */}
        <div className="card">
          <div className="card-header" style={{ flexWrap: "wrap", gap: 12 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <div
                style={{
                  width: 32,
                  height: 32,
                  borderRadius: "var(--radius-md)",
                  background: "var(--brand-light)",
                  color: "var(--brand)",
                  display: "grid",
                  placeItems: "center",
                }}
              >
                {TAB_ICONS[tab]}
              </div>
              <div>
                <h2 style={{ fontSize: 14, fontWeight: 700 }}>{currentTabLabel} Report</h2>
                <p>
                  {loading ? "Loading…" : `${rows.length.toLocaleString("en-IN")} record${rows.length !== 1 ? "s" : ""}`}
                  {showDateRange && !loading && ` · ${from} to ${to}`}
                </p>
              </div>
            </div>

            <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap", marginLeft: "auto" }}>
              {showDateRange && (
                <>
                  <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                    <label style={{ margin: 0, fontSize: 12, fontWeight: 600, color: "var(--text-muted)", whiteSpace: "nowrap" }}>From</label>
                    <input
                      type="date"
                      value={from}
                      onChange={(e) => setFrom(e.target.value)}
                      style={{ height: 34, padding: "0 10px", fontSize: 13, width: "auto" }}
                    />
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                    <label style={{ margin: 0, fontSize: 12, fontWeight: 600, color: "var(--text-muted)", whiteSpace: "nowrap" }}>To</label>
                    <input
                      type="date"
                      value={to}
                      onChange={(e) => setTo(e.target.value)}
                      style={{ height: 34, padding: "0 10px", fontSize: 13, width: "auto" }}
                    />
                  </div>
                </>
              )}
            </div>
          </div>

          {loading ? (
            <SkeletonTable rows={8} columns={colMap[tab].length} />
          ) : (
            <DataTable
              rows={rows}
              columns={colMap[tab]}
              striped
              hoverable
              emptyTitle={`No ${currentTabLabel.toLowerCase()} data found`}
              emptyMessage={
                showDateRange
                  ? `No records found for the selected date range (${from} to ${to}). Try adjusting the date filters.`
                  : `No ${currentTabLabel.toLowerCase()} records are available for this company.`
              }
            />
          )}
        </div>
      </div>
    </>
  );
}

// ── Summary stats helper ─────────────────────────────────────────────────────
interface SummaryStat {
  label: string;
  value: string | number;
  sub?: string;
  badge?: string;
  badgeStatus?: string;
}

function getSummaryStats(tab: Tab, rows: Row[]): SummaryStat[] {
  if (!rows.length) return [];

  if (tab === "attendance") {
    const counts = rows.reduce<Record<string, number>>((acc, r) => {
      const s = String(r.status ?? "UNKNOWN");
      acc[s] = (acc[s] ?? 0) + 1;
      return acc;
    }, {});
    return [
      { label: "Total Records", value: rows.length, badge: "All", badgeStatus: "ACTIVE" },
      { label: "Present", value: counts.PRESENT ?? 0, badge: "On Time", badgeStatus: "PRESENT" },
      { label: "Late Arrivals", value: counts.LATE ?? 0, badge: "Delayed", badgeStatus: "LATE" },
      { label: "Absent", value: counts.ABSENT ?? 0, badge: "No Punch", badgeStatus: "ABSENT" },
    ];
  }

  if (tab === "leave") {
    const counts = rows.reduce<Record<string, number>>((acc, r) => {
      const s = String(r.status ?? "UNKNOWN");
      acc[s] = (acc[s] ?? 0) + 1;
      return acc;
    }, {});
    const totalDays = rows.reduce((sum, r) => sum + (Number(r.total_days) || 0), 0);
    return [
      { label: "Total Applications", value: rows.length },
      { label: "Approved", value: counts.APPROVED ?? 0, badge: "Approved", badgeStatus: "APPROVED" },
      { label: "Pending", value: counts.PENDING ?? 0, badge: "Pending", badgeStatus: "PENDING" },
      { label: "Total Days", value: totalDays, sub: "Across all applications" },
    ];
  }

  if (tab === "headcount") {
    const total = rows.reduce((sum, r) => sum + (Number(r.total_count) || 0), 0);
    const active = rows.reduce((sum, r) => sum + (Number(r.active_count) || 0), 0);
    return [
      { label: "Departments", value: rows.length },
      { label: "Total Headcount", value: total },
      { label: "Active Staff", value: active, badge: "Active", badgeStatus: "ACTIVE" },
    ];
  }

  if (tab === "payroll") {
    const totalNet = rows.reduce((sum, r) => sum + (Number(r.net_pay) || 0), 0);
    const totalGross = rows.reduce((sum, r) => sum + (Number(r.gross_pay) || 0), 0);
    return [
      { label: "Payroll Runs", value: rows.length },
      { label: "Total Gross Pay", value: `₹${totalGross.toLocaleString("en-IN", { maximumFractionDigits: 0 })}` },
      { label: "Total Net Pay", value: `₹${totalNet.toLocaleString("en-IN", { maximumFractionDigits: 0 })}` },
    ];
  }

  if (tab === "assets") {
    const counts = rows.reduce<Record<string, number>>((acc, r) => {
      const s = String(r.status ?? "UNKNOWN");
      acc[s] = (acc[s] ?? 0) + 1;
      return acc;
    }, {});
    return [
      { label: "Total Assets", value: rows.length },
      { label: "Available", value: counts.AVAILABLE ?? 0, badge: "In Stock", badgeStatus: "AVAILABLE" },
      { label: "Assigned", value: counts.ASSIGNED ?? 0, badge: "In Use", badgeStatus: "ASSIGNED" },
    ];
  }

  return [{ label: "Total Records", value: rows.length }];
}

function IcRefresh() {
  return <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/></svg>;
}

function IcDownload() {
  return <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>;
}
