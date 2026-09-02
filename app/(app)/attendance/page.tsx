"use client";

export const dynamic = "force-dynamic";

import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { PageHeader, DataTable, SubNav, Modal, useToast, SkeletonTable, Skeleton } from "@/components";

const ATTENDANCE_NAV = [
  { href: "/attendance", label: "Daily Attendance", exact: true },
  { href: "/attendance/calendar", label: "Calendar" },
  { href: "/attendance/corrections", label: "Corrections" },
  { href: "/attendance/exceptions", label: "Exceptions & Geofence" },
];

const COLUMNS = ["display_name", "attendance_date", "status", "check_in_at", "check_out_at", "worked_minutes", "late_minutes"];

type Row = Record<string, unknown>;

function today() {
  return new Date().toISOString().slice(0, 10);
}

export default function AttendancePage() {
  const { showToast } = useToast();
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

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);

    let query = supabase
      .from("v_attendance")
      .select("*")
      .gte("attendance_date", from)
      .lte("attendance_date", to)
      .order("attendance_date", { ascending: false })
      .order("display_name")
      .limit(500);

    if (statusFilter !== "ALL") query = query.eq("status", statusFilter);

    const { data, error } = await query;
    if (error) setError(error.message);
    setRows((data as Row[]) ?? []);
    setLoading(false);
  }, [from, to, statusFilter]);

  useEffect(() => { void load(); }, [load]);

  const counts = rows.reduce<Record<string, number>>((acc, r) => {
    const s = String(r.status ?? "UNKNOWN");
    acc[s] = (acc[s] ?? 0) + 1;
    return acc;
  }, {});

  const handleBulkMark = async () => {
    setBulkLoading(true);
    try {
      const res = await fetch("/api/attendance/bulk-mark", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...bulkForm,
          employee_ids: Array.from(new Set(selectedRows.map((row) => String(row.employee_id ?? "")).filter(Boolean))),
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Failed to bulk mark attendance");
      
      showToast({ 
        type: "success", 
        title: "Attendance marked", 
        message: json.message || `Successfully marked ${json.marked ?? 0} attendance records.`,
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
    { value: "PRESENT", label: "Present", color: "var(--green)" },
    { value: "ABSENT", label: "Absent", color: "var(--red)" },
    { value: "LATE", label: "Late", color: "var(--amber)" },
    { value: "HALF_DAY", label: "Half Day", color: "var(--purple)" },
    { value: "ON_LEAVE", label: "On Leave", color: "var(--blue)" },
    { value: "HOLIDAY", label: "Holiday", color: "var(--purple)" },
    { value: "WEEKLY_OFF", label: "Weekly Off", color: "var(--gray)" },
  ];

  if (loading) {
    return (
      <>
        <PageHeader
          title="Attendance"
          subtitle="Daily check-in and check-out records"
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
          <div className="stats-grid" style={{ gridTemplateColumns: "repeat(4,1fr)", marginBottom: 20 }}>
            <Skeleton variant="stat" />
            <Skeleton variant="stat" />
            <Skeleton variant="stat" />
            <Skeleton variant="stat" />
          </div>
          <div className="card">
            <div className="card-header" style={{ flexWrap: "wrap", gap: 10 }}>
              <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
                <Skeleton variant="text" width="100px" />
                <Skeleton variant="text" width="100px" />
                <Skeleton variant="text" width="120px" />
              </div>
              <Skeleton variant="text" width="100px" />
            </div>
            <SkeletonTable rows={5} columns={7} />
          </div>
        </div>
      </>
    );
  }

  return (
    <>
      <PageHeader
        title="Attendance"
        subtitle="Daily check-in and check-out records"
        breadcrumbs={[
          { label: "Dashboard", href: "/dashboard" },
          { label: "Attendance Logs" },
        ]}
        actions={
          <div style={{ display: "flex", gap: 8 }}>
            <button 
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
            <button className="btn btn-secondary btn-sm" onClick={() => void load()}>↻ Refresh</button>
          </div>
        }
      />

      <SubNav items={ATTENDANCE_NAV} />

      <div className="page-body">
        {error && <div className="alert alert-error">{error}</div>}

        <div className="stats-grid" style={{ gridTemplateColumns: "repeat(4,1fr)", marginBottom: 20 }}>
          {[
            { label: "Present", key: "PRESENT", color: "var(--green)" },
            { label: "Late", key: "LATE", color: "var(--amber)" },
            { label: "Absent", key: "ABSENT", color: "var(--red)" },
            { label: "Half day", key: "HALF_DAY", color: "var(--purple)" },
          ].map(({ label, key, color }) => (
            <div className="stat-card" key={key}>
              <div className="stat-label">{label}</div>
              <div className="stat-value" style={{ color }}>{counts[key] ?? 0}</div>
            </div>
          ))}
        </div>

        <div className="card">
          <div className="card-header" style={{ flexWrap: "wrap", gap: 10 }}>
            <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <label style={{ margin: 0, whiteSpace: "nowrap", fontSize: 12, fontWeight: 600, color: "var(--text-2)" }}>From</label>
                <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} style={{ width: "auto", padding: "8px 12px" }} />
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <label style={{ margin: 0, whiteSpace: "nowrap", fontSize: 12, fontWeight: 600, color: "var(--text-2)" }}>To</label>
                <input type="date" value={to} onChange={(e) => setTo(e.target.value)} style={{ width: "auto", padding: "8px 12px" }} />
              </div>
              <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} style={{ width: "auto", padding: "8px 12px" }}>
                <option value="ALL">All statuses</option>
                <option value="PRESENT">Present</option>
                <option value="LATE">Late</option>
                <option value="ABSENT">Absent</option>
                <option value="HALF_DAY">Half day</option>
                <option value="ON_LEAVE">On leave</option>
              </select>
            </div>
            <span style={{ fontSize: 12, color: "var(--text-3)", marginLeft: "auto" }}>{rows.length} records</span>
          </div>

          <>
            {selectedRows.length > 0 && (
              <div style={{ 
                padding: "10px 15px", 
                background: "var(--brand-light)", 
                borderBottom: "1px solid var(--border)", 
                display: "flex", 
                alignItems: "center", 
                gap: 10,
                color: "var(--brand-dark)",
                fontWeight: 500,
              }}>
                <span>{selectedRows.length} record{selectedRows.length > 1 ? "s" : ""} selected</span>
                <button className="btn btn-secondary btn-sm" onClick={() => setSelectedRows([])}>
                  Clear Selection
                </button>
              </div>
            )}
            <DataTable 
              rows={rows} 
              columns={COLUMNS} 
              selectable 
              onSelectionChange={setSelectedRows}
              striped
              hoverable
            />
          </>
        </div>
      </div>

      <Modal
        isOpen={showBulkModal}
        onClose={() => setShowBulkModal(false)}
        title="Bulk Mark Attendance"
        size="md"
        footer={
          <>
            <button className="btn btn-secondary" onClick={() => setShowBulkModal(false)} disabled={bulkLoading}>
              Cancel
            </button>
            <button className="btn btn-primary" onClick={handleBulkMark} disabled={bulkLoading}>
              {bulkLoading ? "Processing..." : "Mark Attendance"}
            </button>
          </>
        }
      >
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <div className="alert alert-info" style={{ fontSize: 13 }}>
            <strong>Note:</strong> {selectedRows.length > 0
              ? `This will mark attendance for ${new Set(selectedRows.map((row) => String(row.employee_id ?? "")).filter(Boolean)).size} selected staff member(s).`
              : "This will mark attendance for all active employees in the selected date range."} Existing records will be overwritten.
          </div>
          
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
            <div className="form-group">
              <label>From Date *</label>
              <input 
                type="date" 
                value={bulkForm.from_date} 
                onChange={(e) => setBulkForm(prev => ({ ...prev, from_date: e.target.value }))}
                style={{ width: "100%", padding: "9px 12px", border: "1px solid var(--border)", borderRadius: "6px" }}
                required
              />
            </div>
            <div className="form-group">
              <label>To Date *</label>
              <input 
                type="date" 
                value={bulkForm.to_date} 
                onChange={(e) => setBulkForm(prev => ({ ...prev, to_date: e.target.value }))}
                style={{ width: "100%", padding: "9px 12px", border: "1px solid var(--border)", borderRadius: "6px" }}
                required
              />
            </div>
          </div>
          
          <div className="form-group">
            <label>Status *</label>
            <select 
              value={bulkForm.status} 
              onChange={(e) => setBulkForm(prev => ({ ...prev, status: e.target.value as typeof bulkForm.status }))}
              style={{ width: "100%", padding: "9px 12px", border: "1px solid var(--border)", borderRadius: "6px" }}
            >
              {statusOptions.map(opt => (
                <option key={opt.value} value={opt.value} style={{ color: opt.color }}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>
          
          <div style={{ padding: "12px", background: "var(--bg)", borderRadius: "8px", fontSize: 13, color: "var(--text-2)" }}>
            <strong>Date Range:</strong> {bulkForm.from_date} to {bulkForm.to_date}
          </div>
        </div>
      </Modal>
    </>
  );
}