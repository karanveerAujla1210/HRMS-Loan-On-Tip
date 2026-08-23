"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import PageHeader from "@/components/PageHeader";
import DataTable from "@/components/DataTable";
import SubNav from "@/components/SubNav";

const ATTENDANCE_NAV = [
  { href: "/attendance", label: "Daily Attendance", exact: true },
  { href: "/attendance/corrections", label: "Corrections" },
  { href: "/attendance/exceptions", label: "Exceptions & Geofence" },
];

const COLUMNS = ["display_name", "attendance_date", "status", "check_in_at", "check_out_at", "worked_minutes", "late_minutes"];

type Row = Record<string, unknown>;

function today() {
  return new Date().toISOString().slice(0, 10);
}

export default function AttendancePage() {
  const [rows, setRows] = useState<Row[]>([]);
  const [selectedRows, setSelectedRows] = useState<Row[]>([]);
  const [from, setFrom] = useState(today());
  const [to, setTo] = useState(today());
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

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
      .limit(300);

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

  const [bulkLoading, setBulkLoading] = useState(false);

  const handleBulkMarkPresent = async () => {
    if (!confirm("Are you sure you want to mark all active employees as present for the current month up to today? This may take a minute.")) return;
    setBulkLoading(true);
    try {
      const res = await fetch("/api/attendance/bulk-mark", { method: "POST" });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Failed to bulk mark attendance");
      alert(json.message || "Successfully marked attendance.");
      void load();
    } catch (err: any) {
      alert(err.message);
    } finally {
      setBulkLoading(false);
    }
  };

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
              onClick={() => void handleBulkMarkPresent()}
              disabled={bulkLoading}
            >
              {bulkLoading ? "Processing..." : "📅 Bulk Mark Present (This Month)"}
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
            { label: "Present", key: "PRESENT" },
            { label: "Late", key: "LATE" },
            { label: "Absent", key: "ABSENT" },
            { label: "Half day", key: "HALF_DAY" },
          ].map(({ label, key }) => (
            <div className="stat-card" key={key}>
              <div className="stat-label">{label}</div>
              <div className="stat-value">{counts[key] ?? 0}</div>
            </div>
          ))}
        </div>

        <div className="card">
          <div className="card-header" style={{ flexWrap: "wrap", gap: 10 }}>
            <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <label style={{ margin: 0, whiteSpace: "nowrap" }}>From</label>
                <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} style={{ width: "auto" }} />
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <label style={{ margin: 0, whiteSpace: "nowrap" }}>To</label>
                <input type="date" value={to} onChange={(e) => setTo(e.target.value)} style={{ width: "auto" }} />
              </div>
              <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} style={{ width: "auto" }}>
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

          {loading ? (
            <div className="loading-spinner"><div className="spinner" /> Loading…</div>
          ) : (
            <>
              {selectedRows.length > 0 && (
                <div style={{ padding: "10px 15px", backgroundColor: "var(--bg-2)", borderBottom: "1px solid var(--border)", display: "flex", alignItems: "center", gap: 10 }}>
                  <span style={{ fontSize: 14, fontWeight: 500 }}>{selectedRows.length} records selected</span>
                  <button className="btn btn-secondary btn-sm" onClick={() => alert("Bulk actions for specific records can be added here.")}>
                    Take Action
                  </button>
                </div>
              )}
              <DataTable 
                rows={rows} 
                columns={COLUMNS} 
                selectable 
                onSelectionChange={setSelectedRows} 
              />
            </>
          )}
        </div>
      </div>
    </>
  );
}
