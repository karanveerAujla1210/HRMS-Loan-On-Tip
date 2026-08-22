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
            <DataTable rows={rows} columns={COLUMNS} />
          )}
        </div>
      </div>
    </>
  );
}
