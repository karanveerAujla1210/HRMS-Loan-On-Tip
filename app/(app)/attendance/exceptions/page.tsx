"use client";

import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import PageHeader from "@/components/PageHeader";
import DataTable from "@/components/DataTable";

type Row = Record<string, unknown>;
const COLS = ["display_name", "attendance_date", "exception_type", "description", "severity", "status", "raised_at"];

export default function ExceptionsPage() {
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState("OPEN");

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    let query = supabase
      .from("attendance_exceptions")
      .select(`
        id,
        exception_type,
        description,
        severity,
        status,
        raised_at,
        resolution_note,
        attendance:attendance_id(attendance_date, employee:employee_id(display_name))
      `)
      .order("raised_at", { ascending: false })
      .limit(300);

    if (statusFilter !== "ALL") query = query.eq("status", statusFilter);

    const { data, error } = await query;
    if (error) { setError(error.message); setLoading(false); return; }

    const mapped = ((data ?? []) as Record<string, unknown>[]).map((r) => {
      const att = r.attendance as Record<string, unknown> | null;
      const emp = att?.employee as Record<string, unknown> | null;
      return {
        id: r.id,
        display_name: emp?.display_name ?? "—",
        attendance_date: att?.attendance_date ?? "—",
        exception_type: r.exception_type,
        description: r.description,
        severity: r.severity,
        status: r.status,
        raised_at: r.raised_at,
      };
    });
    setRows(mapped as Row[]);
    setLoading(false);
  }, [statusFilter]);

  useEffect(() => { void load(); }, [load]);

  async function resolve(row: Row, note: string) {
    setMsg(null);
    const res = await fetch(`/api/attendance/exceptions/${String(row.id)}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "RESOLVED", resolution_note: note }),
    });
    const json = await res.json();
    if (json.error) { setMsg(`Error: ${json.error}`); return; }
    setMsg("Exception resolved.");
    void load();
  }

  return (
    <>
      <PageHeader
        title="Attendance Exceptions"
        subtitle="Geo, accuracy and mock-location flags"
        actions={
          <div style={{ display: "flex", gap: 8 }}>
            <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} style={{ width: "auto" }}>
              <option value="OPEN">Open</option>
              <option value="RESOLVED">Resolved</option>
              <option value="ALL">All</option>
            </select>
            <button className="btn btn-ghost btn-sm" onClick={() => void load()}>↻</button>
          </div>
        }
      />
      <div className="page-body">
        {error && <div className="alert alert-error">{error}</div>}
        {msg && <div className="alert alert-success">{msg}</div>}
        <div className="card">
          {loading ? (
            <div className="loading-spinner"><div className="spinner" /> Loading…</div>
          ) : (
            <DataTable
              rows={rows}
              columns={COLS}
              action={(row) =>
                String(row.status) === "OPEN" ? (
                  <button
                    className="btn btn-sm btn-primary"
                    onClick={() => {
                      const note = window.prompt("Resolution note:");
                      if (note !== null) void resolve(row, note);
                    }}
                  >
                    Resolve
                  </button>
                ) : null
              }
            />
          )}
        </div>
      </div>
    </>
  );
}
