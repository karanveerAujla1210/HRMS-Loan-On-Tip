"use client";

import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import PageHeader from "@/components/PageHeader";
import DataTable from "@/components/DataTable";

const COMPANY_ID = "00000000-0000-0000-0000-000000000001";

type Metrics = {
  active_employees?: number;
  present_today?: number;
  pending_leaves?: number;
  available_assets?: number;
};

type Row = Record<string, unknown>;

export default function DashboardPage() {
  const [metrics, setMetrics] = useState<Metrics>({});
  const [attendance, setAttendance] = useState<Row[]>([]);
  const [leaves, setLeaves] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);

    const [metricsRes, attendanceRes, leavesRes] = await Promise.all([
      supabase.from("v_dashboard_metrics").select("*").eq("company_id", COMPANY_ID).maybeSingle(),
      supabase.from("v_today_attendance").select("display_name,status,check_in_at,check_out_at,worked_minutes").order("display_name").limit(8),
      supabase.from("v_pending_leave_approvals").select("display_name,leave_type,from_date,to_date,total_days").order("submitted_at", { ascending: false }).limit(8),
    ]);

    if (metricsRes.error) setError(metricsRes.error.message);
    setMetrics((metricsRes.data as Metrics) ?? {});
    setAttendance((attendanceRes.data as Row[]) ?? []);
    setLeaves((leavesRes.data as Row[]) ?? []);
    setLoading(false);
  }, []);

  useEffect(() => { void load(); }, [load]);

  const active = Number(metrics.active_employees ?? 0);
  const present = Number(metrics.present_today ?? 0);
  const rate = active ? Math.round((present / active) * 100) : 0;

  return (
    <>
      <PageHeader
        title="Dashboard"
        subtitle="Live operations overview"
        actions={
          <button className="btn btn-secondary btn-sm" onClick={() => void load()}>
            ↻ Refresh
          </button>
        }
      />

      <div className="page-body">
        {error && <div className="alert alert-error">{error}</div>}

        {loading ? (
          <div className="loading-spinner"><div className="spinner" /> Loading data…</div>
        ) : (
          <>
            <div className="stats-grid">
              <div className="stat-card">
                <div className="stat-label">Active employees</div>
                <div className="stat-value">{active}</div>
                <div className="stat-sub">Total headcount</div>
              </div>

              <div className="stat-card">
                <div className="stat-label">Today's attendance</div>
                <div className="stat-value">{rate}%</div>
                <div className="stat-sub">{present} checked in today</div>
                <div className="progress-bar">
                  <div className="progress-fill" style={{ width: `${rate}%` }} />
                </div>
              </div>

              <div className="stat-card">
                <div className="stat-label">Pending leave requests</div>
                <div className="stat-value">{Number(metrics.pending_leaves ?? 0)}</div>
                <div className="stat-sub">Awaiting approval</div>
              </div>

              <div className="stat-card">
                <div className="stat-label">Available assets</div>
                <div className="stat-value">{Number(metrics.available_assets ?? 0)}</div>
                <div className="stat-sub">Ready to assign</div>
              </div>
            </div>

            <div className="dashboard-grid">
              <div className="card">
                <div className="card-header">
                  <div>
                    <h2>Today's attendance</h2>
                    <p>{attendance.length} records</p>
                  </div>
                </div>
                <DataTable
                  rows={attendance}
                  columns={["display_name", "status", "check_in_at", "check_out_at", "worked_minutes"]}
                />
              </div>

              <div className="card">
                <div className="card-header">
                  <div>
                    <h2>Pending leave approvals</h2>
                    <p>{leaves.length} requests</p>
                  </div>
                </div>
                <DataTable
                  rows={leaves}
                  columns={["display_name", "leave_type", "from_date", "to_date", "total_days"]}
                />
              </div>
            </div>
          </>
        )}
      </div>
    </>
  );
}
