"use client";

import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useProfile } from "@/lib/useProfile";
import PageHeader from "@/components/PageHeader";
import DataTable from "@/components/DataTable";

type Row = Record<string, unknown>;

export default function DashboardPage() {
  const { companyId, role } = useProfile();
  const [metrics, setMetrics] = useState<Row>({});
  const [attendance, setAttendance] = useState<Row[]>([]);
  const [leaves, setLeaves] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!companyId) return;
    setLoading(true);
    setError(null);

    const [metricsRes, attendanceRes, leavesRes] = await Promise.all([
      supabase.from("v_dashboard_metrics").select("*").eq("company_id", companyId).maybeSingle(),
      supabase.from("v_today_attendance").select("display_name,status,check_in_at,check_out_at,worked_minutes,department").order("display_name").limit(10),
      supabase.from("v_pending_leave_approvals").select("display_name,leave_type,from_date,to_date,total_days").order("submitted_at", { ascending: false }).limit(10),
    ]);

    if (metricsRes.error) setError(metricsRes.error.message);
    setMetrics((metricsRes.data as Row) ?? {});
    setAttendance((attendanceRes.data as Row[]) ?? []);
    setLeaves((leavesRes.data as Row[]) ?? []);
    setLoading(false);
  }, [companyId]);

  useEffect(() => { void load(); }, [load]);

  const active   = Number(metrics.active_employees ?? 0);
  const present  = Number(metrics.present_today ?? 0);
  const absent   = Number(metrics.absent_today ?? 0);
  const late     = Number(metrics.late_today ?? 0);
  const halfDay  = Number(metrics.half_day_today ?? 0);
  const onLeave  = Number(metrics.on_leave_today ?? 0);
  const rate     = active ? Math.round((present / active) * 100) : 0;

  const isAdmin = role && ["SUPER_ADMIN","HR_ADMIN","FINANCE_ADMIN","OPERATIONS_ADMIN","MANAGER"].includes(role);

  return (
    <>
      <PageHeader
        title="Dashboard"
        subtitle="Live operations overview"
        actions={
          <button className="btn btn-secondary btn-sm" onClick={() => void load()}>↻ Refresh</button>
        }
      />

      <div className="page-body">
        {error && <div className="alert alert-error">{error}</div>}

        {loading ? (
          <div className="loading-spinner"><div className="spinner" /> Loading…</div>
        ) : (
          <>
            {/* Primary stats */}
            <div className="stats-grid" style={{ gridTemplateColumns: "repeat(4,1fr)" }}>
              <div className="stat-card">
                <div className="stat-label">Active employees</div>
                <div className="stat-value">{active}</div>
                <div className="stat-sub">Total headcount</div>
              </div>
              <div className="stat-card">
                <div className="stat-label">Present today</div>
                <div className="stat-value" style={{ color: "var(--green)" }}>{present}</div>
                <div className="stat-sub">{rate}% attendance rate</div>
                <div className="progress-bar"><div className="progress-fill" style={{ width: `${rate}%` }} /></div>
              </div>
              <div className="stat-card">
                <div className="stat-label">Absent today</div>
                <div className="stat-value" style={{ color: "var(--red)" }}>{absent}</div>
                <div className="stat-sub">{late} late · {halfDay} half-day</div>
              </div>
              <div className="stat-card">
                <div className="stat-label">On leave today</div>
                <div className="stat-value" style={{ color: "var(--purple)" }}>{onLeave}</div>
                <div className="stat-sub">{Number(metrics.pending_leaves ?? 0)} pending approvals</div>
              </div>
            </div>

            {/* Secondary stats — admin only */}
            {isAdmin && (
              <div className="stats-grid" style={{ gridTemplateColumns: "repeat(4,1fr)" }}>
                <div className="stat-card">
                  <div className="stat-label">New joiners (30d)</div>
                  <div className="stat-value">{Number(metrics.new_joiners_30d ?? 0)}</div>
                  <div className="stat-sub">{Number(metrics.on_notice ?? 0)} on notice period</div>
                </div>
                <div className="stat-card">
                  <div className="stat-label">Pending corrections</div>
                  <div className="stat-value" style={{ color: "var(--amber)" }}>{Number(metrics.pending_corrections ?? 0)}</div>
                  <div className="stat-sub">{Number(metrics.open_exceptions ?? 0)} open exceptions</div>
                </div>
                <div className="stat-card">
                  <div className="stat-label">Assets assigned</div>
                  <div className="stat-value">{Number(metrics.assigned_assets ?? 0)}</div>
                  <div className="stat-sub">{Number(metrics.available_assets ?? 0)} available</div>
                </div>
                <div className="stat-card">
                  <div className="stat-label">Payroll runs</div>
                  <div className="stat-value">{Number(metrics.draft_payroll_runs ?? 0)}</div>
                  <div className="stat-sub">{Number(metrics.pending_payroll_approvals ?? 0)} pending approval</div>
                </div>
              </div>
            )}

            <div className="dashboard-grid">
              <div className="card">
                <div className="card-header">
                  <div><h2>Today's attendance</h2><p>{attendance.length} records shown</p></div>
                </div>
                <DataTable rows={attendance} columns={["display_name","department","status","check_in_at","check_out_at","worked_minutes"]} />
              </div>
              <div className="card">
                <div className="card-header">
                  <div><h2>Pending leave approvals</h2><p>{leaves.length} requests</p></div>
                </div>
                <DataTable rows={leaves} columns={["display_name","leave_type","from_date","to_date","total_days"]} />
              </div>
            </div>
          </>
        )}
      </div>
    </>
  );
}
