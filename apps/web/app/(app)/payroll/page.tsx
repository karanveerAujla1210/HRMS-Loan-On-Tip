"use client";

export const dynamic = "force-dynamic";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import { apiFetch } from "@/lib/api/client";
import { API } from "@/lib/api/endpoints";
import { useProfile } from "@/hooks/useProfile";
import { PageHeader, DataTable, StatusBadge, Modal, SkeletonPageHeader, SkeletonTable } from "@/components";
import { useRoleGuard } from "@/hooks/useRoleGuard";

type Row = Record<string, unknown>;

const COLS = ["payroll_month", "payroll_year", "status", "employee_count", "gross_pay", "net_pay", "created_at"];

const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

export default function PayrollPage() {
  const { activeCompanyId: companyId, loading: profileLoading } = useProfile();
  const { allowed, loading: guardLoading } = useRoleGuard({
    allowedRoles: ["SUPER_ADMIN", "HR_ADMIN", "FINANCE_ADMIN"],
  });
  const [runs, setRuns] = useState<Row[]>([]);
  const [, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [calculatingId, setCalculatingId] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!companyId) { if (!profileLoading) setLoading(false); return; }
    setLoading(true);
    setError(null);
    const { data, error } = await supabase
      .from("payroll_runs")
      .select("id,payroll_month,payroll_year,status,employee_count,gross_pay,net_pay,created_at")
      .eq("company_id", companyId)
      .order("created_at", { ascending: false })
      .limit(50);
    if (error) setError(error.message);
    setRuns((data as Row[]) ?? []);
    setLoading(false);
  }, [companyId, profileLoading]);

  useEffect(() => { void load(); }, [load]);

  async function calculateRun(row: Row) {
    setMsg(null);
    const id = String(row.id);
    setCalculatingId(id);
    const res = await apiFetch<{ employee_count: number; net_pay: number }>(API.payroll.calculate, {
      method: "POST",
      body: JSON.stringify({ payroll_run_id: row.id }),
    });
    setCalculatingId(null);
    if (res.error) { setMsg(`Error: ${res.error.message}`); return; }
    setMsg(`Calculated successfully: ${res.data?.employee_count} staff, Net ₹${res.data?.net_pay?.toLocaleString("en-IN")}.`);
    void load();
  }

  async function approveRun(row: Row) {
    setMsg(null);
    const res = await apiFetch(API.payroll.run(String(row.id)), {
      method: "PATCH",
      body: JSON.stringify({ action: "APPROVED" }),
    });
    if (res.error) { setMsg(`Error: ${res.error.message}`); return; }
    setMsg("Payroll cycle approved successfully.");
    void load();
  }

  async function lockRun(row: Row) {
    setMsg(null);
    const res = await apiFetch(API.payroll.run(String(row.id)), {
      method: "PATCH",
      body: JSON.stringify({ action: "LOCKED" }),
    });
    if (res.error) { setMsg(`Error: ${res.error.message}`); return; }
    setMsg("Payroll cycle locked and immutable.");
    void load();
  }

  async function createRun(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSaving(true);
    setMsg(null);
    const fd = new FormData(e.currentTarget);
    const month = Number(fd.get("month"));
    const year = Number(fd.get("year"));

    const res = await apiFetch(API.payroll.runs, {
      method: "POST",
      body: JSON.stringify({ payroll_month: month, payroll_year: year }),
    });
    if (res.error) { setMsg(`Error: ${res.error.message}`); setSaving(false); return; }
    setShowForm(false);
    setMsg("Payroll cycle initiated as Draft.");
    void load();
    setSaving(false);
  }

  const currentYear = new Date().getFullYear();

  // Summary figures
  const totalNet = runs.reduce((sum, r) => sum + (Number(r.net_pay) || 0), 0);
  const activeEmployeesCovered = runs[0] ? Number(runs[0].employee_count || 0) : 0;


  // Guard: show skeleton while loading, redirect fires automatically if unauthorized
  if (guardLoading || profileLoading) {
    return (<><SkeletonPageHeader /><SkeletonTable rows={6} /></>);
  }
  if (!allowed) return null;

  return (
    <>
      <PageHeader
        title="Payroll & Compensation"
        subtitle="Monthly salary computation, statutory registers and disbursement batches"
        badge={<StatusBadge status="ACTIVE" customLabel="Statutory Compliant" size="sm" />}
        breadcrumbs={[
          { label: "Dashboard", href: "/dashboard" },
          { label: "Payroll Runs" },
        ]}
        actions={
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              onClick={() => void load()}
            >
              ↻ Refresh
            </button>
            <button
              type="button"
              className="btn btn-primary btn-sm"
              onClick={() => setShowForm(true)}
            >
              + Initiate Payroll Run
            </button>
          </div>
        }
      />

      <div className="page-body">
        {error && <div className="alert alert-error">{error}</div>}
        {msg && <div className="alert alert-success">{msg}</div>}

        {/* Financial KPI Summary Cards */}
        <div className="stats-grid" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", marginBottom: 24 }}>
          <div className="metric-kpi-card">
            <div className="metric-header">
              <span className="metric-title">Recent Run Net Payout</span>
              <span className="status-badge badge-green status-badge-sm">Latest Cycle</span>
            </div>
            <div className="metric-value-row">
              <span className="metric-number tabular-num">
                {runs[0]?.net_pay ? `₹${Number(runs[0].net_pay).toLocaleString("en-IN")}` : "₹0"}
              </span>
            </div>
            <span className="metric-sub">
              {runs[0] ? `${MONTHS[Number(runs[0].payroll_month) - 1] ?? "Month"} ${runs[0].payroll_year}` : "No runs recorded"}
            </span>
          </div>

          <div className="metric-kpi-card">
            <div className="metric-header">
              <span className="metric-title">Enrolled Staff</span>
              <span className="status-badge badge-blue status-badge-sm">Coverage</span>
            </div>
            <div className="metric-value-row">
              <span className="metric-number tabular-num">{activeEmployeesCovered}</span>
            </div>
            <span className="metric-sub">Employees processed in current run</span>
          </div>

          <div className="metric-kpi-card">
            <div className="metric-header">
              <span className="metric-title">Cumulative Disbursements</span>
              <span className="status-badge badge-gray status-badge-sm">History</span>
            </div>
            <div className="metric-value-row">
              <span className="metric-number tabular-num font-semibold">
                ₹{totalNet.toLocaleString("en-IN", { maximumFractionDigits: 0 })}
              </span>
            </div>
            <span className="metric-sub">Across {runs.length} completed and draft runs</span>
          </div>
        </div>

        {/* Payroll Runs History Table */}
        <div className="card">
          <div className="card-header" style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div>
              <h2>Payroll Runs History</h2>
              <p>Review monthly computation batches and approve payouts</p>
            </div>
            <span style={{ fontSize: 12.5, color: "var(--text-muted)", fontWeight: 500 }}>
              {runs.length} batches recorded
            </span>
          </div>

          <DataTable
            rows={runs}
            columns={COLS}
            action={(row) => (
              <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                <Link
                  href={`/payroll/${String(row.id)}`}
                  className="btn btn-sm btn-secondary"
                >
                  View Details
                </Link>
                {String(row.status) === "DRAFT" && (
                  <button
                    type="button"
                    className="btn btn-sm btn-secondary"
                    onClick={() => calculateRun(row)}
                    disabled={calculatingId === String(row.id)}
                  >
                    {calculatingId === String(row.id) ? "Calculating…" : "⚡ Compute"}
                  </button>
                )}
                {String(row.status) === "CALCULATED" && (
                  <button
                    type="button"
                    className="btn btn-sm btn-primary"
                    onClick={() => approveRun(row)}
                  >
                    ✓ Approve
                  </button>
                )}
                {String(row.status) === "APPROVED" && (
                  <button
                    type="button"
                    className="btn btn-sm btn-secondary"
                    onClick={() => lockRun(row)}
                  >
                    🔒 Lock
                  </button>
                )}
              </div>
            )}
            striped
            hoverable
            emptyTitle="No payroll cycles created yet"
            emptyMessage="Click 'Initiate Payroll Run' to start a new monthly computation batch."
          />
        </div>
      </div>

      {/* Modern Modal for New Payroll Run */}
      <Modal
        isOpen={showForm}
        onClose={() => setShowForm(false)}
        title="Initiate Monthly Payroll Run"
        size="md"
      >
        <form onSubmit={createRun}>
          <div style={{ padding: "8px 0" }}>
            <p style={{ fontSize: 13, color: "var(--text-muted)", marginBottom: 20 }}>
              Select the salary computation period. The system will compile attendance records, leave deductions, and salary structures for all active staff in ACG Leasing Limited.
            </p>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 20 }}>
              <div className="form-group">
                <label>Payroll Month *</label>
                <select name="month" defaultValue={new Date().getMonth() + 1} required>
                  {MONTHS.map((m, i) => (
                    <option key={m} value={i + 1}>{m}</option>
                  ))}
                </select>
              </div>

              <div className="form-group">
                <label>Payroll Year *</label>
                <select name="year" defaultValue={currentYear} required>
                  {[currentYear - 1, currentYear, currentYear + 1].map((y) => (
                    <option key={y} value={y}>{y}</option>
                  ))}
                </select>
              </div>
            </div>

            <div className="alert alert-info" style={{ fontSize: 12.5 }}>
              <strong>Audit Notice:</strong> A draft run will be created. Calculations can be previewed, reviewed, and adjusted before approval.
            </div>
          </div>

          <div
            style={{
              marginTop: 20,
              paddingTop: 16,
              borderTop: "1px solid var(--border)",
              display: "flex",
              justifyContent: "flex-end",
              gap: 10,
            }}
          >
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => setShowForm(false)}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="btn btn-primary"
              disabled={saving}
            >
              {saving ? "Creating Draft…" : "Create Draft Run"}
            </button>
          </div>
        </form>
      </Modal>
    </>
  );
}
