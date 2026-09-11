"use client";

export const dynamic = "force-dynamic";

import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { apiFetch } from "@/lib/api/client";
import { API } from "@/lib/api/endpoints";
import { PageHeader, DataTable, useToast, ConfirmModal, SkeletonTable, Skeleton, StatusBadge } from "@/components";
import { useProfile } from "@/hooks/useProfile";

type Row = Record<string, unknown>;

const PENDING_COLS = ["display_name", "leave_type", "from_date", "to_date", "total_days", "reason", "submitted_at"];
const ALL_COLS = ["display_name", "leave_type", "from_date", "to_date", "total_days", "status", "submitted_at"];

const ADMIN_ROLES = ["SUPER_ADMIN", "HR_ADMIN", "OPERATIONS_ADMIN", "LOCATION_ADMIN", "MANAGER"];

export default function LeavePage() {
  const { showToast } = useToast();
  const { activeCompanyId: companyId, role, loading: profileLoading } = useProfile();
  const [pending, setPending] = useState<Row[]>([]);
  const [all, setAll] = useState<Row[]>([]);
  const [tab, setTab] = useState<"pending" | "all">("pending");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [confirmLeave, setConfirmLeave] = useState<{ id: string; action: "APPROVED" | "REJECTED" } | null>(null);
  const [actionLoading, setActionLoading] = useState(false);

  useEffect(() => {
    if (!profileLoading && role && !ADMIN_ROLES.includes(role)) {
      window.location.replace("/self-service");
    }
  }, [profileLoading, role]);

  const load = useCallback(async () => {
    if (!companyId) { if (!profileLoading) setLoading(false); return; }
    setLoading(true);
    setError(null);
    const [pendingRes, allRes] = await Promise.all([
      supabase.from("v_pending_leave_approvals").select("*").eq("company_id", companyId).order("submitted_at", { ascending: false }).limit(100),
      supabase.from("leave_requests").select("id,from_date,to_date,total_days,status,submitted_at,employees(display_name,company_id),leave_types(name)").eq("employees.company_id", companyId).order("submitted_at", { ascending: false }).limit(200),
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
  }, [companyId, profileLoading]);

  useEffect(() => { void load(); }, [load]);

  const handleActionClick = (row: Row, action: "APPROVED" | "REJECTED") => {
    const leaveId = String(row.leave_request_id ?? row.id);
    setConfirmLeave({ id: leaveId, action });
  };

  const handleConfirm = async () => {
    if (!confirmLeave) return;
    setActionLoading(true);
    try {
      const res = await apiFetch(API.leaves.action(confirmLeave.id), {
        method: "PATCH",
        body: JSON.stringify({ action: confirmLeave.action, comments: "" }),
      });
      if (res.error) {
        showToast({ type: "error", title: "Action failed", message: res.error.message });
        return;
      }
      showToast({ 
        type: "success", 
        title: "Leave updated", 
        message: `Leave request ${confirmLeave.action.toLowerCase()} successfully.`,
      });
      setConfirmLeave(null);
      void load();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Unknown error";
      showToast({ type: "error", title: "Action failed", message });
    } finally {
      setActionLoading(false);
    }
  };

  const approvedCount = all.filter((r) => String(r.status).toUpperCase() === "APPROVED").length;
  const rejectedCount = all.filter((r) => String(r.status).toUpperCase() === "REJECTED").length;

  const rows = tab === "pending" ? pending : all;
  const cols = tab === "pending" ? PENDING_COLS : ALL_COLS;

  if (loading) {
    return (
      <>
        <PageHeader
          title="Leave Approvals"
          subtitle="Review applications, approvals and balances"
          breadcrumbs={[
            { label: "Dashboard", href: "/dashboard" },
            { label: "Leave Management" },
          ]}
          actions={<Skeleton variant="rectangular" width={100} height={36} />}
        />
        <div className="page-body">
          <div className="stats-grid" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", marginBottom: 20 }}>
            <Skeleton variant="stat" />
            <Skeleton variant="stat" />
            <Skeleton variant="stat" />
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
        title="Leave Management"
        subtitle="Manage employee leave requests, quotas and manager approvals"
        badge={
          pending.length > 0 ? (
            <StatusBadge status="PENDING" customLabel={`${pending.length} Pending`} size="sm" />
          ) : (
            <StatusBadge status="APPROVED" customLabel="All Clear" size="sm" />
          )
        }
        breadcrumbs={[
          { label: "Dashboard", href: "/dashboard" },
          { label: "Leave Management" },
        ]}
        actions={
          <button
            type="button"
            className="btn btn-secondary btn-sm"
            onClick={() => void load()}
          >
            ↻ Refresh
          </button>
        }
      />

      <div className="page-body">
        {error && <div className="alert alert-error">{error}</div>}

        {/* Leave KPI Metrics */}
        <div className="stats-grid" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", marginBottom: 20 }}>
          <div className="metric-kpi-card">
            <div className="metric-header">
              <span className="metric-title">Pending Action</span>
              <span className="status-badge badge-amber status-badge-sm">Requires Review</span>
            </div>
            <div className="metric-value-row">
              <span className="metric-number tabular-num" style={{ color: pending.length > 0 ? "var(--warning)" : "var(--text-strong)" }}>
                {pending.length}
              </span>
            </div>
            <span className="metric-sub">Awaiting manager/admin decision</span>
          </div>

          <div className="metric-kpi-card">
            <div className="metric-header">
              <span className="metric-title">Approved Leaves</span>
              <span className="status-badge badge-green status-badge-sm">Approved</span>
            </div>
            <div className="metric-value-row">
              <span className="metric-number tabular-num">{approvedCount}</span>
            </div>
            <span className="metric-sub">Granted this cycle</span>
          </div>

          <div className="metric-kpi-card">
            <div className="metric-header">
              <span className="metric-title">Total Processed</span>
              <span className="status-badge badge-gray status-badge-sm">History</span>
            </div>
            <div className="metric-value-row">
              <span className="metric-number tabular-num">{all.length}</span>
            </div>
            <span className="metric-sub">{rejectedCount} applications rejected</span>
          </div>
        </div>

        {/* Tab Controls & Records */}
        <div className="card">
          <div
            className="card-header"
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              flexWrap: "wrap",
              gap: 12,
            }}
          >
            <div className="segmented-tabs">
              <button
                type="button"
                className={`segmented-tab ${tab === "pending" ? "active" : ""}`}
                onClick={() => setTab("pending")}
              >
                Pending Approvals ({pending.length})
              </button>
              <button
                type="button"
                className={`segmented-tab ${tab === "all" ? "active" : ""}`}
                onClick={() => setTab("all")}
              >
                All Applications ({all.length})
              </button>
            </div>

            <span style={{ fontSize: 12.5, color: "var(--text-muted)", fontWeight: 500 }}>
              Showing {rows.length} record{rows.length === 1 ? "" : "s"}
            </span>
          </div>

          <DataTable
            rows={rows}
            columns={cols}
            action={
              tab === "pending"
                ? (row) => (
                    <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                      <button 
                        type="button"
                        className="btn btn-primary btn-sm"
                        style={{ background: "#10b981", borderColor: "#10b981", padding: "4px 10px" }}
                        onClick={() => handleActionClick(row, "APPROVED")}
                        disabled={actionLoading}
                        title="Approve leave request"
                      >
                        ✓ Approve
                      </button>
                      <button 
                        type="button"
                        className="btn btn-secondary btn-sm"
                        style={{ color: "var(--danger)", padding: "4px 10px" }}
                        onClick={() => handleActionClick(row, "REJECTED")}
                        disabled={actionLoading}
                        title="Reject leave request"
                      >
                        ✕ Reject
                      </button>
                    </div>
                  )
                : undefined
            }
            striped
            hoverable
            emptyTitle={tab === "pending" ? "No pending leave requests" : "No leave history found"}
            emptyMessage={tab === "pending" ? "All employee leave applications have been reviewed." : "No leave records match the company scope."}
          />
        </div>
      </div>

      <ConfirmModal
        isOpen={!!confirmLeave}
        onClose={() => setConfirmLeave(null)}
        onConfirm={handleConfirm}
        title={confirmLeave?.action === "APPROVED" ? "Approve Leave Request" : "Reject Leave Request"}
        message={
          confirmLeave?.action === "APPROVED" 
            ? "Are you sure you want to approve this leave request? The employee's leave balance will be updated automatically." 
            : "Are you sure you want to reject this leave request? The employee will receive notification."
        }
        confirmLabel={confirmLeave?.action === "APPROVED" ? "Approve Leave" : "Reject Leave"}
        cancelLabel="Cancel"
        variant={confirmLeave?.action === "APPROVED" ? "primary" : "danger"}
        loading={actionLoading}
      />
    </>
  );
}