"use client";

import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import PageHeader from "@/components/PageHeader";
import DataTable from "@/components/DataTable";

type Row = Record<string, unknown>;

const PENDING_COLS = ["display_name", "leave_type", "from_date", "to_date", "total_days", "reason", "submitted_at"];
const ALL_COLS = ["display_name", "leave_type", "from_date", "to_date", "total_days", "status", "submitted_at"];

export default function LeavePage() {
  const [pending, setPending] = useState<Row[]>([]);
  const [all, setAll] = useState<Row[]>([]);
  const [tab, setTab] = useState<"pending" | "all">("pending");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionMsg, setActionMsg] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    const [pendingRes, allRes] = await Promise.all([
      supabase.from("v_pending_leave_approvals").select("*").order("submitted_at", { ascending: false }).limit(100),
      supabase.from("leave_requests").select("id,from_date,to_date,total_days,status,submitted_at,employees(display_name),leave_types(name)").order("submitted_at", { ascending: false }).limit(200),
    ]);
    if (pendingRes.error) setError(pendingRes.error.message);
    setPending((pendingRes.data as Row[]) ?? []);
    const allMapped = ((allRes.data ?? []) as Record<string, unknown>[]).map((r) => ({
      ...r,
      display_name: (r.employees as Record<string, unknown> | null)?.display_name ?? "—",
      leave_type: (r.leave_types as Record<string, unknown> | null)?.name ?? "—",
    }));
    setAll(allMapped as Row[]);
    setLoading(false);
  }, []);

  useEffect(() => { void load(); }, [load]);

  async function handleAction(row: Row, action: "APPROVED" | "REJECTED") {
    setActionMsg(null);
    const leaveId = String(row.leave_request_id ?? row.id);

    const res = await fetch(`/api/leaves/${leaveId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action, note: "" }),
    });
    const json = await res.json();
    if (json.error) { setActionMsg(`Error: ${json.error}`); return; }
    setActionMsg(`Leave request ${action.toLowerCase()} successfully.`);
    void load();
  }

  const rows = tab === "pending" ? pending : all;
  const cols = tab === "pending" ? PENDING_COLS : ALL_COLS;

  return (
    <>
      <PageHeader
        title="Leave"
        subtitle="Leave requests and approvals"
        actions={
          <button className="btn btn-ghost btn-sm" onClick={() => void load()}>↻ Refresh</button>
        }
      />

      <div className="page-body">
        {error && <div className="alert alert-error">{error}</div>}
        {actionMsg && <div className="alert alert-success">{actionMsg}</div>}

        <div style={{ display: "flex", gap: 8, marginBottom: 20 }}>
          <button
            className={`btn ${tab === "pending" ? "btn-primary" : "btn-secondary"} btn-sm`}
            onClick={() => setTab("pending")}
          >
            Pending ({pending.length})
          </button>
          <button
            className={`btn ${tab === "all" ? "btn-primary" : "btn-secondary"} btn-sm`}
            onClick={() => setTab("all")}
          >
            All requests
          </button>
        </div>

        <div className="card">
          {loading ? (
            <div className="loading-spinner"><div className="spinner" /> Loading…</div>
          ) : (
            <DataTable
              rows={rows}
              columns={cols}
              action={
                tab === "pending"
                  ? (row) => (
                      <div style={{ display: "flex", gap: 6 }}>
                        <button className="btn btn-sm btn-primary" onClick={() => handleAction(row, "APPROVED")}>
                          Approve
                        </button>
                        <button className="btn btn-sm btn-danger" onClick={() => handleAction(row, "REJECTED")}>
                          Reject
                        </button>
                      </div>
                    )
                  : undefined
              }
            />
          )}
        </div>
      </div>
    </>
  );
}
