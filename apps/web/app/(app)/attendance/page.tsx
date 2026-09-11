"use client";

export const dynamic = "force-dynamic";

import { useCallback, useEffect, useState } from "react";
import { apiFetch } from "@/lib/api/client";
import { API } from "@/lib/api/endpoints";
import { useProfile } from "@/hooks/useProfile";
import { PageHeader, DataTable, SubNav, Modal, useToast, SkeletonTable, Skeleton, StatusBadge } from "@/components";

const ATTENDANCE_NAV = [
  { href: "/attendance", label: "Daily Attendance", exact: true },
  { href: "/attendance/calendar", label: "Calendar View" },
  { href: "/attendance/corrections", label: "Corrections & Approvals" },
  { href: "/attendance/exceptions", label: "Exceptions & Geofence" },
];

const COLUMNS = ["display_name", "attendance_date", "status", "check_in_at", "check_out_at", "worked_minutes", "late_minutes"];

type Row = Record<string, unknown>;

function today() {
  return new Date().toISOString().slice(0, 10);
}

const ADMIN_ROLES = ["SUPER_ADMIN", "HR_ADMIN", "OPERATIONS_ADMIN", "LOCATION_ADMIN", "MANAGER"];

export default function AttendancePage() {
  const { showToast } = useToast();
  const { activeCompanyId: companyId, role, loading: profileLoading } = useProfile();
  const [rows, setRows] = useState<Row[]>([]);
  const [selectedRows, setSelectedRows] = useState<Row[]>([]);
  const [from, setFrom] = useState(today());
  const [to, setTo] = useState(today());
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showBulkModal, setShowBulkModal] = useState(false);
  const [bulkLoading, setBulkLoading] = useState(false);
  const [bulkForm, setBulkForm] = useState({
    from_date: new Date().toISOString().slice(0, 10),
    to_date: today(),
    status: "PRESENT" as "PRESENT" | "ABSENT" | "LATE" | "HALF_DAY" | "ON_LEAVE" | "HOLIDAY" | "WEEKLY_OFF",
  });

  useEffect(() => {
    if (!profileLoading && role && !ADMIN_ROLES.includes(role)) {
      window.location.replace("/self-service");
    }
  }, [profileLoading, role]);

  const load = useCallback(async () => {
    if (!companyId) { if (!profileLoading) setLoading(false); return; }
    setLoading(true);
    setError(null);

    const params = new URLSearchParams({
      from: from,
      to: to,
      scope: "company",
      pageSize: "500",
    });
    if (statusFilter !== "ALL") params.set("status", statusFilter);

    const res = await apiFetch<{ data: Row[]; pagination: unknown }>(`/api/attendance?${params.toString()}`);
    if (res.error) setError(res.error.message);
    const list = res.data?.data ?? [];
    setRows(list.map((r: Row) => ({
      ...r,
      display_name: (r.employees as { display_name?: string } | null)?.display_name ?? r.display_name ?? "",
    })));
    setLoading(false);
  }, [companyId, profileLoading, from, to, statusFilter]);

  useEffect(() => { void load(); }, [load]);

  const counts = rows.reduce<Record<string, number>>((acc, r) => {
    const s = String(r.status ?? "UNKNOWN");
    acc[s] = (acc[s] ?? 0) + 1;
    return acc;
  }, {});

  const handleBulkMark = async () => {
    setBulkLoading(true);
    try {
      const res = await apiFetch<{ message?: string; marked?: number }>(API.attendance.bulkMark, {
        method: "POST",
        body: JSON.stringify({
          ...bulkForm,
          employee_ids: selectedRows.length > 0
            ? Array.from(new Set(
                selectedRows
                  .map((row) => String(row.employee_id ?? ""))
                  .filter((id) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id))
              ))
            : undefined,
        }),
      });
      if (res.error) throw new Error(res.error.message || "Failed to bulk mark attendance");

      showToast({
        type: "success",
        title: "Attendance marked",
        message: res.data?.message || `Successfully marked ${res.data?.marked ?? 0} attendance records.`,
      });
      setShowBulkModal(false);
      void load();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Unknown error";
      showToast({ type: "error", title: "Failed to mark attendance", message });
    } finally {
      setBulkLoading(false);
    }
  };

  const statusOptions = [
    { value: "PRESENT", label: "Present" },
    { value: "ABSENT", label: "Absent" },
    { value: "LATE", label: "Late" },
    { value: "HALF_DAY", label: "Half Day" },
    { value: "ON_LEAVE", label: "On Leave" },
    { value: "HOLIDAY", label: "Holiday" },
    { value: "WEEKLY_OFF", label: "Weekly Off" },
  ];

  if (loading) {
    return (
      <>
        <PageHeader
          title="Attendance Management"
          subtitle="Daily check-in and check-out logs"
          breadcrumbs={[
            { label: "Dashboard", href: "/dashboard" },
            { label: "Attendance Logs" },
          ]}
          actions={
            <div style={{ display: "flex", gap: 8 }}>
              <Skeleton variant="rectangular" width={180} height={36} />
              <Skeleton variant="rectangular" width={100} height={36} />
            </div>
          }
        />
        <SubNav items={ATTENDANCE_NAV} />
        <div className="page-body">
          <div className="stats-grid" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", marginBottom: 20 }}>
            <Skeleton variant="stat" />
            <Skeleton variant="stat" />
            <Skeleton variant="stat" />
            <Skeleton variant="stat" />
          </div>
          <div className="card">
            <SkeletonTable rows={6} columns={7} />
          </div>
        </div>
      </>
    );
  }

  return (
    <>
      <PageHeader
        title="Attendance Management"
        subtitle="Daily punch logs, shift timings and work duration records"
        badge={<StatusBadge status="PRESENT" customLabel={`${rows.length} Logs`} size="sm" />}
        breadcrumbs={[
          { label: "Dashboard", href: "/dashboard" },
          { label: "Attendance Logs" },
        ]}
        actions={
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
            <button
              type="button"
              className="btn btn-primary btn-sm"
              onClick={() => {
                const now = new Date();
                setBulkForm({
                  from_date: `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-01`,
                  to_date: today(),
                  status: "PRESENT",
                });
                setShowBulkModal(true);
              }}
              disabled={bulkLoading}
            >
              📅 Bulk Mark Attendance
            </button>
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              onClick={() => void load()}
            >
              ↻ Refresh
            </button>
          </div>
        }
      />

      <SubNav items={ATTENDANCE_NAV} />

      <div className="page-body">
        {error && <div className="alert alert-error">{error}</div>}

        {/* Attendance Summary Stat Cards */}
        <div className="stats-grid" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", marginBottom: 20 }}>
          <div className="metric-kpi-card">
            <div className="metric-header">
              <span className="metric-title">Present Count</span>
              <span className="status-badge badge-green status-badge-sm">Active</span>
            </div>
            <div className="metric-value-row">
              <span className="metric-number tabular-num">{counts.PRESENT ?? 0}</span>
            </div>
            <span className="metric-sub">Punched on time</span>
          </div>

          <div className="metric-kpi-card">
            <div className="metric-header">
              <span className="metric-title">Late Arrivals</span>
              <span className="status-badge badge-amber status-badge-sm">Delayed</span>
            </div>
            <div className="metric-value-row">
              <span className="metric-number tabular-num" style={{ color: "var(--warning)" }}>{counts.LATE ?? 0}</span>
            </div>
            <span className="metric-sub">Marked after grace period</span>
          </div>

          <div className="metric-kpi-card">
            <div className="metric-header">
              <span className="metric-title">Absent / Unmarked</span>
              <span className="status-badge badge-red status-badge-sm">Absent</span>
            </div>
            <div className="metric-value-row">
              <span className="metric-number tabular-num" style={{ color: "var(--danger)" }}>{counts.ABSENT ?? 0}</span>
            </div>
            <span className="metric-sub">No check-in recorded</span>
          </div>

          <div className="metric-kpi-card">
            <div className="metric-header">
              <span className="metric-title">Half Day / Leave</span>
              <span className="status-badge badge-purple status-badge-sm">Partial</span>
            </div>
            <div className="metric-value-row">
              <span className="metric-number tabular-num" style={{ color: "var(--purple)" }}>
                {(counts.HALF_DAY ?? 0) + (counts.ON_LEAVE ?? 0)}
              </span>
            </div>
            <span className="metric-sub">{counts.HALF_DAY ?? 0} half-day · {counts.ON_LEAVE ?? 0} on leave</span>
          </div>
        </div>

        {/* Filter Toolbar */}
        <div className="filter-toolbar">
          <div className="filter-group">
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <label style={{ margin: 0, fontSize: 12, fontWeight: 600, color: "var(--text-muted)" }}>From</label>
              <input
                type="date"
                value={from}
                onChange={(e) => setFrom(e.target.value)}
                style={{ height: 36, padding: "0 10px", fontSize: 13 }}
              />
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <label style={{ margin: 0, fontSize: 12, fontWeight: 600, color: "var(--text-muted)" }}>To</label>
              <input
                type="date"
                value={to}
                onChange={(e) => setTo(e.target.value)}
                style={{ height: 36, padding: "0 10px", fontSize: 13 }}
              />
            </div>
            <select
              className="filter-select"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              aria-label="Filter by punch status"
            >
              <option value="ALL">All Statuses</option>
              <option value="PRESENT">Present</option>
              <option value="LATE">Late</option>
              <option value="ABSENT">Absent</option>
              <option value="HALF_DAY">Half Day</option>
              <option value="ON_LEAVE">On Leave</option>
            </select>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <button
              type="button"
              className="btn btn-ghost btn-sm"
              onClick={() => {
                setFrom(today());
                setTo(today());
                setStatusFilter("ALL");
              }}
            >
              Today
            </button>
            <span style={{ fontSize: 12.5, color: "var(--text-muted)", fontWeight: 500 }}>
              {rows.length} records logged
            </span>
          </div>
        </div>

        {/* Attendance Records Table */}
        <DataTable
          rows={rows}
          columns={COLUMNS}
          selectable
          onSelectionChange={setSelectedRows}
          striped
          hoverable
          emptyTitle="No attendance punches found"
          emptyMessage="No attendance activity logged for the selected dates."
        />
      </div>

      {/* Bulk Attendance Modal */}
      <Modal
        isOpen={showBulkModal}
        onClose={() => setShowBulkModal(false)}
        title="Bulk Mark Attendance"
        size="md"
        footer={
          <>
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => setShowBulkModal(false)}
              disabled={bulkLoading}
            >
              Cancel
            </button>
            <button
              type="button"
              className="btn btn-primary"
              onClick={handleBulkMark}
              disabled={bulkLoading}
            >
              {bulkLoading ? "Processing…" : "Mark Attendance"}
            </button>
          </>
        }
      >
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <div className="alert alert-info" style={{ fontSize: 13 }}>
            <strong>Scope:</strong> {selectedRows.length > 0
              ? `Marking attendance for ${new Set(selectedRows.map((row) => String(row.employee_id ?? "")).filter(Boolean)).size} selected employee(s).`
              : "Marking attendance for all active employees across the company."}
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
            <div className="form-group">
              <label>From Date *</label>
              <input
                type="date"
                value={bulkForm.from_date}
                onChange={(e) => setBulkForm((prev) => ({ ...prev, from_date: e.target.value }))}
                required
              />
            </div>
            <div className="form-group">
              <label>To Date *</label>
              <input
                type="date"
                value={bulkForm.to_date}
                onChange={(e) => setBulkForm((prev) => ({ ...prev, to_date: e.target.value }))}
                required
              />
            </div>
          </div>

          <div className="form-group">
            <label>Attendance Status *</label>
            <select
              value={bulkForm.status}
              onChange={(e) => setBulkForm((prev) => ({ ...prev, status: e.target.value as typeof bulkForm.status }))}
            >
              {statusOptions.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>
        </div>
      </Modal>
    </>
  );
}