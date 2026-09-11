"use client";

export const dynamic = "force-dynamic";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { apiFetch } from "@/lib/api/client";
import { API } from "@/lib/api/endpoints";
import { useProfile } from "@/hooks/useProfile";
import { useRoleGuard, type RoleGuardRole } from "@/hooks/useRoleGuard";
import { PageHeader, DataTable, SkeletonDashboard, SkeletonPageHeader, StatusBadge } from "@/components";

type Row = Record<string, unknown>;

import { supabase } from "@/lib/supabase";

const ADMIN_ROLES: RoleGuardRole[] = ["SUPER_ADMIN", "HR_ADMIN", "FINANCE_ADMIN", "ASSET_ADMIN", "OPERATIONS_ADMIN", "LOCATION_ADMIN", "MANAGER"];

const QUICK_ACTIONS = [
  { href: "/people",                 label: "People Directory", Icon: IcUsers,    roles: ["SUPER_ADMIN", "HR_ADMIN", "OPERATIONS_ADMIN", "MANAGER"] },
  { href: "/attendance",             label: "Attendance Logs",  Icon: IcClock,    roles: ["SUPER_ADMIN", "HR_ADMIN", "OPERATIONS_ADMIN", "LOCATION_ADMIN", "MANAGER"] },
  { href: "/attendance/corrections", label: "Corrections",      Icon: IcEdit,     roles: ["SUPER_ADMIN", "HR_ADMIN", "OPERATIONS_ADMIN", "LOCATION_ADMIN", "MANAGER"] },
  { href: "/leave",                  label: "Leave Approvals",  Icon: IcCalendar, roles: ["SUPER_ADMIN", "HR_ADMIN", "OPERATIONS_ADMIN", "LOCATION_ADMIN", "MANAGER"] },
  { href: "/payroll",                label: "Payroll Runs",     Icon: IcCash,     roles: ["SUPER_ADMIN", "HR_ADMIN", "FINANCE_ADMIN"] },
  { href: "/assets",                 label: "Asset Inventory",  Icon: IcBox,      roles: ["SUPER_ADMIN", "HR_ADMIN", "OPERATIONS_ADMIN", "ASSET_ADMIN"] },
  { href: "/organisation",           label: "Organisation",     Icon: IcBuilding, roles: ["SUPER_ADMIN", "HR_ADMIN"] },
  { href: "/reports",                label: "Reports",          Icon: IcChart,    roles: ["SUPER_ADMIN", "HR_ADMIN", "FINANCE_ADMIN", "OPERATIONS_ADMIN", "MANAGER"] },
  { href: "/download-app",           label: "Mobile App",       Icon: IcPhone,    roles: ADMIN_ROLES },
];

export default function DashboardPage() {
  const router = useRouter();
  const { activeCompanyId: companyId, role, roles, displayName: profileName, loading: profileLoading } = useProfile();
  const { allowed, loading: guardLoading } = useRoleGuard({ allowedRoles: ADMIN_ROLES });
  const [metrics, setMetrics] = useState<Row>({});
  const [attendance, setAttendance] = useState<Row[]>([]);
  const [leaves, setLeaves] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!companyId) { setLoading(false); return; }
    setLoading(true);
    setError(null);

    const today = new Date().toISOString().slice(0, 10);
    const [metricsRes, attendanceRes, leavesRes] = await Promise.all([
      apiFetch<Record<string, unknown>>(API.dashboard.metrics),
      apiFetch<{ data: Row[] }>(`/api/attendance?scope=company&pageSize=10&from=${today}&to=${today}`),
      apiFetch<{ data: Row[] }>(`/api/leaves?scope=company&status=PENDING&pageSize=10`),
    ]);

    if (metricsRes.error) setError(metricsRes.error.message);
    setMetrics((metricsRes.data as Row) ?? {});
    setAttendance(
      (attendanceRes.data?.data ?? []).map((r: Row) => ({
        ...r,
        display_name: (r.employees as { display_name?: string } | null)?.display_name ?? r.display_name ?? "",
        department: (r.employees as { department?: string } | null)?.department ?? r.department ?? "—",
      }))
    );
    setLeaves(
      (leavesRes.data?.data ?? []).map((r: Row) => ({
        ...r,
        display_name: (r.employees as { display_name?: string } | null)?.display_name ?? r.display_name ?? "",
        leave_type: (r.leave_types as { name?: string } | null)?.name ?? r.leave_type ?? "",
      }))
    );
    setLoading(false);
  }, [companyId]);

  useEffect(() => {
    if (!companyId) return;
    const channel = supabase.channel(`dashboard-metrics-${companyId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'attendance_records' }, () => {
        // For simplicity we re-fetch metrics on any change
        void load();
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [companyId, load]);

  const active  = Number(metrics.active_employees ?? 0);
  const present = Number(metrics.present_today ?? 0);
  const absent  = Number(metrics.absent_today ?? 0);
  const late    = Number(metrics.late_today ?? 0);
  const halfDay = Number(metrics.half_day_today ?? 0);
  const onLeave = Number(metrics.on_leave_today ?? 0);
  const rate    = active ? Math.round((present / active) * 100) : 0;
  const isAdmin = Boolean(role && ADMIN_ROLES.some(r => r === role));
  const availableQuickActions = QUICK_ACTIONS.filter(({ roles: required }) =>
    roles.includes("SUPER_ADMIN") || roles.some(r => required.includes(r))
  );

  useEffect(() => {
    if (!profileLoading && role && !ADMIN_ROLES.some(r => r === role)) {
      router.replace("/self-service");
    }
  }, [profileLoading, role, router]);

  if (loading || profileLoading || guardLoading) {
    return (
      <>
        <SkeletonPageHeader />
        <SkeletonDashboard />
      </>
    );
  }
  if (!allowed) return null;

  const hour = new Date().getHours();
  const greeting = hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";

  // Calculations for distribution bar
  const totalAccounted = Math.max(active, present + absent + late + halfDay + onLeave, 1);
  const presentPct = Math.round((present / totalAccounted) * 100);
  const latePct = Math.round((late / totalAccounted) * 100);
  const halfDayPct = Math.round((halfDay / totalAccounted) * 100);
  const onLeavePct = Math.round((onLeave / totalAccounted) * 100);
  const absentPct = Math.max(0, 100 - presentPct - latePct - halfDayPct - onLeavePct);

  return (
    <>
      <PageHeader
        title="Operations Dashboard"
        subtitle="Real-time people, attendance and operational metrics"
        badge={<StatusBadge status="ACTIVE" customLabel="Live Sync" size="sm" />}
        actions={
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <Link href="/self-service" className="btn btn-secondary btn-sm">
              <IcPerson /> My Self-Service
            </Link>
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              onClick={() => void load()}
              title="Refresh dashboard metrics"
            >
              <IcRefresh /> Refresh
            </button>
          </div>
        }
      />

      <div className="page-body">
        {error && <div className="alert alert-error">{error}</div>}

        {/* Executive Overview Banner */}
        <div
          style={{
            background: "linear-gradient(135deg, #1e293b 0%, #0f172a 100%)",
            border: "1px solid rgba(255, 255, 255, 0.08)",
            borderRadius: "var(--radius-lg)",
            padding: "24px 28px",
            marginBottom: 24,
            color: "#ffffff",
            display: "flex",
            flexWrap: "wrap",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 20,
            boxShadow: "0 4px 20px -2px rgba(15, 23, 42, 0.25)",
            position: "relative",
            overflow: "hidden",
          }}
        >
          {/* Subtle accent glow */}
          <div
            style={{
              position: "absolute",
              top: -40,
              right: -40,
              width: 160,
              height: 160,
              background: "radial-gradient(circle, rgba(232, 85, 52, 0.3) 0%, transparent 70%)",
              pointerEvents: "none",
            }}
            aria-hidden="true"
          />

          <div style={{ position: "relative", zIndex: 1 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
              <span
                style={{
                  display: "inline-block",
                  width: 8,
                  height: 8,
                  borderRadius: "50%",
                  background: "#10b981",
                  boxShadow: "0 0 8px #10b981",
                }}
              />
              <span style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em", color: "#94a3b8" }}>
                ACG Leasing Operations
              </span>
            </div>
            <div style={{ fontSize: 22, fontWeight: 800, fontFamily: "var(--font-display)", letterSpacing: "-0.01em" }}>
              {greeting}, {profileName?.split(" ")[0] ?? "Team"}
            </div>
            <div style={{ fontSize: 13, color: "#94a3b8", marginTop: 4 }}>
              Here is the live workforce and HR operations summary for today
            </div>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: 16, position: "relative", zIndex: 1 }}>
            <div
              style={{
                background: "rgba(255, 255, 255, 0.06)",
                border: "1px solid rgba(255, 255, 255, 0.1)",
                borderRadius: "var(--radius-md)",
                padding: "8px 16px",
                textAlign: "right",
              }}
            >
              <div style={{ fontSize: 11, fontWeight: 600, color: "#94a3b8", textTransform: "uppercase", letterSpacing: "0.05em" }}>
                {new Date().toLocaleDateString("en-IN", { weekday: "long" })}
              </div>
              <div style={{ fontSize: 14, fontWeight: 700, color: "#f8fafc" }}>
                {new Date().toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}
              </div>
            </div>
          </div>
        </div>

        {/* Quick Actions Bar */}
        <div className="quick-actions-bar" style={{ marginBottom: 24 }}>
          <div className="quick-actions-title">Operational Shortcuts</div>
          <div className="quick-actions-list">
            {availableQuickActions.map(({ href, label, Icon }) => (
              <Link key={href} href={href} className="quick-action-btn">
                <Icon />
                <span>{label}</span>
              </Link>
            ))}
          </div>
        </div>

        {/* Primary Operational Stats */}
        <div className="stats-grid" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", marginBottom: 16 }}>
          <StatCard
            href="/people"
            label="Total Active Staff"
            value={active}
            sub="Active headcount across branches"
            icon={<IcUsers />}
            iconColor="var(--info)"
            iconBg="var(--info-light)"
          />
          <StatCard
            href="/attendance"
            label="Present Today"
            value={present}
            sub={`${rate}% overall attendance`}
            icon={<IcCheckCircle />}
            iconColor="var(--success)"
            iconBg="var(--success-light)"
            progress={rate}
            progressColor="var(--success)"
          />
          <StatCard
            href="/attendance"
            label="Absent / Exceptions"
            value={absent}
            sub={`${late} marked late · ${halfDay} half-day`}
            icon={<IcXCircle />}
            iconColor="var(--danger)"
            iconBg="var(--danger-light)"
          />
          <StatCard
            href="/leave"
            label="On Leave Today"
            value={onLeave}
            sub={`${Number(metrics.pending_leaves ?? 0)} approvals awaiting action`}
            icon={<IcCalendar />}
            iconColor="var(--purple)"
            iconBg="var(--purple-light)"
          />
        </div>

        {/* Attendance Health Distribution Bar */}
        <div
          style={{
            background: "var(--surface)",
            border: "1px solid var(--border)",
            borderRadius: "var(--radius-lg)",
            padding: "16px 20px",
            marginBottom: 24,
            boxShadow: "var(--shadow-xs)",
          }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
            <span style={{ fontSize: 12, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em", color: "var(--text-muted)" }}>
              Today&apos;s Attendance Breakdown
            </span>
            <span style={{ fontSize: 12, fontWeight: 600, color: "var(--text-strong)" }}>
              {present} of {active} present ({rate}%)
            </span>
          </div>

          <div
            style={{
              height: 8,
              borderRadius: 4,
              display: "flex",
              overflow: "hidden",
              background: "var(--border-light)",
              gap: 2,
            }}
          >
            {presentPct > 0 && <div style={{ width: `${presentPct}%`, background: "#10b981", borderRadius: 3 }} title={`Present: ${present} (${presentPct}%)`} />}
            {latePct > 0 && <div style={{ width: `${latePct}%`, background: "#f59e0b", borderRadius: 3 }} title={`Late: ${late} (${latePct}%)`} />}
            {halfDayPct > 0 && <div style={{ width: `${halfDayPct}%`, background: "#3b82f6", borderRadius: 3 }} title={`Half Day: ${halfDay} (${halfDayPct}%)`} />}
            {onLeavePct > 0 && <div style={{ width: `${onLeavePct}%`, background: "#8b5cf6", borderRadius: 3 }} title={`On Leave: ${onLeave} (${onLeavePct}%)`} />}
            {absentPct > 0 && <div style={{ width: `${absentPct}%`, background: "#ef4444", borderRadius: 3 }} title={`Absent / Unmarked: ${absentPct}%`} />}
          </div>

          <div style={{ display: "flex", gap: 16, marginTop: 10, flexWrap: "wrap", fontSize: 11, color: "var(--text-muted)" }}>
            <span style={{ display: "flex", alignItems: "center", gap: 5 }}>
              <span style={{ width: 8, height: 8, borderRadius: "50%", background: "#10b981" }} /> Present ({present})
            </span>
            <span style={{ display: "flex", alignItems: "center", gap: 5 }}>
              <span style={{ width: 8, height: 8, borderRadius: "50%", background: "#f59e0b" }} /> Late ({late})
            </span>
            <span style={{ display: "flex", alignItems: "center", gap: 5 }}>
              <span style={{ width: 8, height: 8, borderRadius: "50%", background: "#3b82f6" }} /> Half Day ({halfDay})
            </span>
            <span style={{ display: "flex", alignItems: "center", gap: 5 }}>
              <span style={{ width: 8, height: 8, borderRadius: "50%", background: "#8b5cf6" }} /> Leave ({onLeave})
            </span>
            <span style={{ display: "flex", alignItems: "center", gap: 5 }}>
              <span style={{ width: 8, height: 8, borderRadius: "50%", background: "#ef4444" }} /> Absent ({absent})
            </span>
          </div>
        </div>

        {/* Secondary Admin Operations KPIs */}
        {isAdmin && (
          <div className="stats-grid" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", marginBottom: 24 }}>
            <StatCard
              href="/people"
              label="New Joiners (30d)"
              value={Number(metrics.new_joiners_30d ?? 0)}
              sub={`${Number(metrics.on_notice ?? 0)} on active notice period`}
              icon={<IcUserPlus />}
              iconColor="var(--brand)"
              iconBg="var(--brand-light)"
            />
            <StatCard
              href="/attendance/corrections"
              label="Pending Corrections"
              value={Number(metrics.pending_corrections ?? 0)}
              sub={`${Number(metrics.open_exceptions ?? 0)} open time exceptions`}
              icon={<IcEdit />}
              iconColor="var(--warning)"
              iconBg="var(--warning-light)"
            />
            <StatCard
              href="/assets"
              label="Assets in Deployment"
              value={Number(metrics.assigned_assets ?? 0)}
              sub={`${Number(metrics.available_assets ?? 0)} items ready in inventory`}
              icon={<IcBox />}
              iconColor="var(--info)"
              iconBg="var(--info-light)"
            />
            <StatCard
              href="/payroll"
              label="Payroll Cycles"
              value={Number(metrics.draft_payroll_runs ?? 0)}
              sub={`${Number(metrics.pending_payroll_approvals ?? 0)} pending finance verification`}
              icon={<IcCash />}
              iconColor="var(--success)"
              iconBg="var(--success-light)"
            />
          </div>
        )}

        {/* Dashboard Operational Tables */}
        <div className="dashboard-grid">
          <div className="card">
            <div className="card-header">
              <div>
                <h2>Today&apos;s Attendance Activity</h2>
                <p>{attendance.length} recent punch logs</p>
              </div>
              <Link href="/attendance" className="btn btn-secondary btn-sm">
                View All <IcArrow />
              </Link>
            </div>
            <DataTable
              rows={attendance}
              columns={["display_name", "department", "status", "check_in_at", "check_out_at", "worked_minutes"]}
              striped
              hoverable
              emptyTitle="No attendance punches today"
              emptyMessage="Punch records for today will appear here as employees check in."
            />
          </div>

          <div className="card">
            <div className="card-header">
              <div>
                <h2>Pending Leave Approvals</h2>
                <p>{leaves.length} requests awaiting review</p>
              </div>
              <Link href="/leave" className="btn btn-secondary btn-sm">
                Manage Approvals <IcArrow />
              </Link>
            </div>
            <DataTable
              rows={leaves}
              columns={["display_name", "leave_type", "from_date", "to_date", "total_days"]}
              striped
              hoverable
              emptyTitle="No pending leave requests"
              emptyMessage="All employee leave applications have been reviewed."
            />
          </div>
        </div>
      </div>
    </>
  );
}

// ── Refined StatCard ─────────────────────────────────────────────────────────
interface StatCardProps {
  href: string;
  label: string;
  value: number;
  sub: string;
  icon: React.ReactNode;
  iconColor: string;
  iconBg: string;
  progress?: number;
  progressColor?: string;
}

function StatCard({ href, label, value, sub, icon, iconColor, iconBg, progress, progressColor }: StatCardProps) {
  return (
    <Link href={href} className="metric-kpi-card">
      <div className="metric-header">
        <div className="metric-title">{label}</div>
        <div
          className="metric-icon-wrap"
          style={{ background: iconBg, color: iconColor }}
          aria-hidden="true"
        >
          {icon}
        </div>
      </div>
      <div className="metric-value-row">
        <div className="metric-number tabular-num">
          {value.toLocaleString("en-IN")}
        </div>
      </div>
      <div className="metric-sub">{sub}</div>
      {progress !== undefined && (
        <div className="progress-bar" style={{ marginTop: 10 }}>
          <div className="progress-fill" style={{ width: `${progress}%`, background: progressColor }} />
        </div>
      )}
    </Link>
  );
}

// ── Icons ───────────────────────────────────────────────────────────────────
function IcUsers()     { return <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>; }
function IcClock()     { return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>; }
function IcCalendar()  { return <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>; }
function IcCash()      { return <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><rect x="2" y="6" width="20" height="12" rx="2"/><circle cx="12" cy="12" r="3"/><path d="M6 12h.01M18 12h.01"/></svg>; }
function IcBox()       { return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/><polyline points="3.27 6.96 12 12.01 20.73 6.96"/><line x1="12" y1="22.08" x2="12" y2="12"/></svg>; }
function IcBuilding()  { return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M9 3v18M15 3v18M3 9h18M3 15h18"/></svg>; }
function IcChart()     { return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></svg>; }
function IcPhone()     { return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><rect x="5" y="2" width="14" height="20" rx="2"/><line x1="12" y1="18" x2="12.01" y2="18"/></svg>; }
function IcEdit()      { return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>; }
function IcPerson()    { return <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><circle cx="12" cy="8" r="4"/><path d="M4 20c0-4 3.6-7 8-7s8 3 8 7"/></svg>; }
function IcRefresh()   { return <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/></svg>; }
function IcArrow()     { return <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/></svg>; }
function IcCheckCircle(){ return <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>; }
function IcXCircle()   { return <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>; }
function IcUserPlus()  { return <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="8.5" cy="7" r="4"/><line x1="20" y1="8" x2="20" y2="14"/><line x1="23" y1="11" x2="17" y2="11"/></svg>; }
