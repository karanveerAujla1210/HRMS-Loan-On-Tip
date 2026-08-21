"use client";

import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import PageHeader from "@/components/PageHeader";
import DataTable from "@/components/DataTable";

type Row = Record<string, unknown>;
const COLS = ["display_name", "attendance_date", "old_check_in", "new_check_in", "old_check_out", "new_check_out", "reason", "status", "created_at"];

export default function CorrectionsPage() {
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    const { data, error } = await supabase
      .from("attendance_adjustments")
      .select(`
        id,
        reason,
        status,
        created_at,
        old_values,
        new_values,
        attendance:attendance_id(attendance_date, employee:employee_id(display_name))
      `)
      .order("created_at", { ascending: false })
      .limit(200);
    if (error) { setError(error.message); setLoading(false); return; }

    const mapped = ((data ?? []) as Record<string, unknown>[]).map((r) => {
      const att = r.attendance as Record<string, unknown> | null;
      const emp = att?.employee as Record<string, unknown> | null;
      const ov = r.old_values as Record<string, string> | null;
      const nv = r.new_values as Record<string, string> | null;
      return {
        id: r.id,
        display_name: emp?.display_name ?? "—",
        attendance_date: att?.attendance_date ?? "—",
        old_check_in: ov?.check_in_at ?? "—",
        new_check_in: nv?.check_in_at ?? "—",
        old_check_out: ov?.check_out_at ?? "—",
        new_check_out: nv?.check_out_at ?? "—",
        reason: r.reason,
        status: r.status,
        created_at: r.created_at,
      };
    });
    setRows(mapped as Row[]);
    setLoading(false);
  }, []);

  useEffect(() => { void load(); }, [load]);

  async function handleAction(row: Row, action: "APPROVED" | "REJECTED") {
    setMsg(null);
    const res = await fetch("/api/attendance/correction", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ adjustment_id: row.id, action }),
    });
    const json = await res.json() as { error?: string };
    if (json.error) { setMsg(`Error: ${json.error}`); return; }
    setMsg(`Correction ${action.toLowerCase()}.`);
    void load();
  }

  return (
    <>
      <PageHeader
        title="Attendance Corrections"
        subtitle="Review and approve correction requests"
        actions={<button className="btn btn-ghost btn-sm" onClick={() => void load()}>↻ Refresh</button>}
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
                String(row.status) === "PENDING" ? (
                  <div style={{ display: "flex", gap: 6 }}>
                    <button className="btn btn-sm btn-primary" onClick={() => handleAction(row, "APPROVED")}>Approve</button>
                    <button className="btn btn-sm btn-danger" onClick={() => handleAction(row, "REJECTED")}>Reject</button>
                  </div>
                ) : null
              }
            />
          )}
        </div>
      </div>
    </>
  );
}
