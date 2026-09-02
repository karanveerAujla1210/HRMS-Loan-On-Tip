"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import { useProfile } from "@/lib/useProfile";
import { PageHeader, DataTable, SkeletonDashboard, SkeletonPageHeader } from "@/components";

type Row = Record<string, unknown>;

export default function DashboardPage() {
  const { companyId, role } = useProfile();
  const [metrics, setMetrics] = useState<Row>({});
  const [attendance, setAttendance] = useState<Row[]>([]);
  const [leaves, setLeaves] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!companyId) { setLoading(false); return; }
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

  const isAdmin = !role || ["SUPER_ADMIN","HR_ADMIN","FINANCE_ADMIN","OPERATIONS_ADMIN","MANAGER"].includes(role);

  if (loading) {
    return (
      <>
        <SkeletonPageHeader />
        <SkeletonDashboard />
      </>
    );
  }

  return (
    <>
      <PageHeader
        title="Dashboard"
        subtitle="Live HR and operations overview"
        actions={
          <div style={{ display: "flex", gap: 8 }}>
            <Link href="/self-service" className="btn btn-secondary btn-sm">
              👤 My Self-Service
            </Link>
            <button className="btn btn-secondary btn-sm" onClick={() => void load()}>↻ Refresh</button>
          </div>
        }
      />

      <div className="page-body">
        {error && <div className="alert alert-error">{error}</div>}

        {/* Quick Actions Bar */}
        <div className="quick-actions-bar">
          <div className="quick-actions-title">Quick Actions:</div>
          <div className="quick-actions-list">
            <Link href="/people" className="quick-action-btn">
              <span>👥</span> People Directory
            </Link>
            <Link href="/attendance" className="quick-action-btn">
              <span>⏱️</span> Attendance Logs
            </Link>
            <Link href="/attendance/corrections" className="quick-action-btn">
              <span>✏️</span> Corrections
            </Link>
            <Link href="/leave" className="quick-action-btn">
              <span>🏖️</span> Leave Approvals
            </Link>
            <Link href="/payroll" className="quick-action-btn">
              <span>💵</span> Payroll Runs
            </Link>
            <Link href="/assets" className="quick-action-btn">
              <span>💻</span> Asset Inventory
            </Link>
            <Link href="/organisation" className="quick-action-btn">
              <span>🏢</span> Organisation Setup
            </Link>
            <Link href="/reports" className="quick-action-btn">
              <span>📊</span> Reports
            </Link>
            <Link href="/download-app" className="quick-action-btn">
              <span>📱</span> Get Mobile App
            </Link>
          </div>
        </div>

        {/* Primary stats - Clickable Links */}
        <div className="stats-grid" style={{ gridTemplateColumns: "repeat(4,1fr)" }}>
          <Link href="/people" className="stat-card stat-card-link">
            <div className="stat-card-header">
              <div className="stat-label">Active employees</div>
              <span className="stat-arrow">→</span>
            </div>
            <div className="stat-value">{active}</div>
            <div className="stat-sub">Total headcount · View directory</div>
          </Link>

          <Link href="/attendance" className="stat-card stat-card-link">
            <div className="stat-card-header">
              <div className="stat-label">Present today</div>
              <span className="stat-arrow">→</span>
            </div>
            <div className="stat-value" style={{ color: "var(--green)" }}>{present}</div>
            <div className="stat-sub">{rate}% attendance rate</div>
            <div className="progress-bar"><div className="progress-fill" style={{ width: `${rate}%` }} /></div>
          </Link>

          <Link href="/attendance" className="stat-card stat-card-link">
            <div className="stat-card-header">
              <div className="stat-label">Absent today</div>
              <span className="stat-arrow">→</span>
            </div>
            <div className="stat-value" style={{ color: "var(--red)" }}>{absent}</div>
            <div className="stat-sub">{late} late · {halfDay} half-day</div>
          </Link>

          <Link href="/leave" className="stat-card stat-card-link">
            <div className="stat-card-header">
              <div className="stat-label">On leave today</div>
              <span className="stat-arrow">→</span>
            </div>
            <div className="stat-value" style={{ color: "var(--purple)" }}>{onLeave}</div>
            <div className="stat-sub">{Number(metrics.pending_leaves ?? 0)} pending approvals</div>
          </Link>
        </div>

        {/* Secondary stats — admin only */}
        {isAdmin && (
          <div className="stats-grid" style={{ gridTemplateColumns: "repeat(4,1fr)" }}>
            <Link href="/people" className="stat-card stat-card-link">
              <div className="stat-card-header">
                <div className="stat-label">New joiners (30d)</div>
                <span className="stat-arrow">→</span>
              </div>
              <div className="stat-value">{Number(metrics.new_joiners_30d ?? 0)}</div>
              <div className="stat-sub">{Number(metrics.on_notice ?? 0)} on notice period</div>
            </Link>

            <Link href="/attendance/corrections" className="stat-card stat-card-link">
              <div className="stat-card-header">
                <div className="stat-label">Pending corrections</div>
                <span className="stat-arrow">→</span>
              </div>
              <div className="stat-value" style={{ color: "var(--amber)" }}>{Number(metrics.pending_corrections ?? 0)}</div>
              <div className="stat-sub">{Number(metrics.open_exceptions ?? 0)} open exceptions</div>
            </Link>

            <Link href="/assets" className="stat-card stat-card-link">
              <div className="stat-card-header">
                <div className="stat-label">Assets assigned</div>
                <span className="stat-arrow">→</span>
              </div>
              <div className="stat-value">{Number(metrics.assigned_assets ?? 0)}</div>
              <div className="stat-sub">{Number(metrics.available_assets ?? 0)} available in stock</div>
            </Link>

            <Link href="/payroll" className="stat-card stat-card-link">
              <div className="stat-card-header">
                <div className="stat-label">Payroll runs</div>
                <span className="stat-arrow">→</span>
              </div>
              <div className="stat-value">{Number(metrics.draft_payroll_runs ?? 0)}</div>
              <div className="stat-sub">{Number(metrics.pending_payroll_approvals ?? 0)} pending approval</div>
            </Link>
          </div>
        )}

        {/* Dashboard tables with direct links */}
        <div className="dashboard-grid">
          <div className="card">
            <div className="card-header">
              <div>
                <h2>Today&apos;s attendance</h2>
                <p>{attendance.length} records shown</p>
              </div>
              <Link href="/attendance" className="btn btn-secondary btn-sm">
                View All Attendance →
              </Link>
            </div>
            <DataTable rows={attendance} columns={["display_name","department","status","check_in_at","check_out_at","worked_minutes"]} striped hoverable />
          </div>

          <div className="card">
            <div className="card-header">
              <div>
                <h2>Pending leave approvals</h2>
                <p>{leaves.length} requests</p>
              </div>
              <Link href="/leave" className="btn btn-secondary btn-sm">
                Manage Leaves →
              </Link>
            </div>
            <DataTable rows={leaves} columns={["display_name","leave_type","from_date","to_date","total_days"]} striped hoverable />
          </div>
        </div>
      </div>
    </>
  );
}