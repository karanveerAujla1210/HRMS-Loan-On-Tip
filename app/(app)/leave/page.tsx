"use client";

import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { PageHeader, DataTable, useToast, ConfirmModal, SkeletonTable, Skeleton } from "@/components";

type Row = Record<string, unknown>;

const PENDING_COLS = ["display_name", "leave_type", "from_date", "to_date", "total_days", "reason", "submitted_at"];
const ALL_COLS = ["display_name", "leave_type", "from_date", "to_date", "total_days", "status", "submitted_at"];

export default function LeavePage() {
  const { showToast } = useToast();
  const [pending, setPending] = useState<Row[]>([]);
  const [all, setAll] = useState<Row[]>([]);
  const [tab, setTab] = useState<"pending" | "all">("pending");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [confirmLeave, setConfirmLeave] = useState<{ id: string; action: "APPROVED" | "REJECTED" } | null>(null);
  const [actionLoading, setActionLoading] = useState(false);

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

  const handleActionClick = (row: Row, action: "APPROVED" | "REJECTED") => {
    const leaveId = String(row.leave_request_id ?? row.id);
    setConfirmLeave({ id: leaveId, action });
  };

  const handleConfirm = async () => {
    if (!confirmLeave) return;
    setActionLoading(true);
    try {
      const res = await fetch(`/api/leaves/${confirmLeave.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: confirmLeave.action, comments: "" }),
      });
      const json = await res.json();
      if (json.error) {
        showToast({ type: "error", title: "Action failed", message: json.message || json.error });
        return;
      }
      showToast({ 
        type: "success", 
        title: "Leave updated", 
        message: `Leave request ${confirmLeave.action.toLowerCase()} successfully.`,
      });
      setConfirmLeave(null);
      void load();
    } catch (err: any) {
      showToast({ type: "error", title: "Action failed", message: err.message });
    } finally {
      setActionLoading(false);
    }
  };

  const rows = tab === "pending" ? pending : all;
  const cols = tab === "pending" ? PENDING_COLS : ALL_COLS;

  if (loading) {
    return (
      <>
        <PageHeader
          title="Leave"
          subtitle="Leave applications, team quotas and approval workflows"
          breadcrumbs={[
            { label: "Dashboard", href: "/dashboard" },
            { label: "Leave Approvals" },
          ]}
          actions={
            <Skeleton variant="rectangular" width={100} height={36} />
          }
        />
        <div className="page-body">
          <div style={{ display: "flex", gap: 8, marginBottom: 20 }}>
            <Skeleton variant="rectangular" width={120} height={36} />
            <Skeleton variant="rectangular" width={100} height={36} />
          </div>
          <div className="card">
            <SkeletonTable rows={5} columns={7} />
          </div>
        </div>
      </>
    );
  }

  return (
    <>
      <PageHeader
        title="Leave"
        subtitle="Leave applications, team quotas and approval workflows"
        breadcrumbs={[
          { label: "Dashboard", href: "/dashboard" },
          { label: "Leave Approvals" },
        ]}
        actions={
          <button className="btn btn-secondary btn-sm" onClick={() => void load()}>↻ Refresh</button>
        }
      />

      <div className="page-body">
        {error && <div className="alert alert-error">{error}</div>}

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
          <DataTable
            rows={rows}
            columns={cols}
            action={
              tab === "pending"
                ? (row) => (
                    <div style={{ display: "flex", gap: 6 }}>
                      <button 
                        className="btn btn-sm btn-primary" 
                        onClick={() => handleActionClick(row, "APPROVED")}
                        disabled={actionLoading}
                      >
                        Approve
                      </button>
                      <button 
                        className="btn btn-sm btn-danger" 
                        onClick={() => handleActionClick(row, "REJECTED")}
                        disabled={actionLoading}
                      >
                        Reject
                      </button>
                    </div>
                  )
                : undefined
            }
            striped
            hoverable
          />
        </div>
      </div>

      <ConfirmModal
        isOpen={!!confirmLeave}
        onClose={() => setConfirmLeave(null)}
        onConfirm={handleConfirm}
        title={confirmLeave?.action === "APPROVED" ? "Approve Leave Request" : "Reject Leave Request"}
        message={confirmLeave?.action === "APPROVED" 
          ? "Are you sure you want to approve this leave request? The employee's leave balance will be deducted." 
          : "Are you sure you want to reject this leave request? The employee will be notified."}
        confirmLabel={confirmLeave?.action === "APPROVED" ? "Approve" : "Reject"}
        cancelLabel="Cancel"
        variant={confirmLeave?.action === "APPROVED" ? "primary" : "danger"}
        loading={actionLoading}
      />
    </>
  );
}