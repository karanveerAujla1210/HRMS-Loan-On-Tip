"use client";

import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useProfile } from "@/lib/useProfile";
import PageHeader from "@/components/PageHeader";
import DataTable from "@/components/DataTable";
type Row = Record<string, unknown>;

const COLS = ["payroll_month", "payroll_year", "status", "employee_count", "gross_pay", "net_pay", "created_at"];

const MONTHS = [
  "January","February","March","April","May","June",
  "July","August","September","October","November","December",
];

export default function PayrollPage() {
  const { companyId } = useProfile();
  const [runs, setRuns] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    if (!companyId) return;
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
  }, [companyId]);

  useEffect(() => { void load(); }, [load]);

  async function calculateRun(row: Row) {
    setMsg(null);
    const res = await fetch("/api/payroll/calculate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ payroll_run_id: row.id }),
    });
    const json = await res.json() as { error?: string; data?: { employee_count: number; net_pay: number } };
    if (json.error) { setMsg(`Error: ${json.error}`); return; }
    setMsg(`Calculated: ${json.data?.employee_count} employees, net ₹${json.data?.net_pay?.toLocaleString("en-IN")}.`);
    void load();
  }

  async function approveRun(row: Row) {
    setMsg(null);
    const { error } = await supabase
      .from("payroll_runs")
      .update({ status: "APPROVED" })
      .eq("id", row.id);
    if (error) { setMsg(`Error: ${error.message}`); return; }
    setMsg("Payroll run approved.");
    void load();
  }

  async function createRun(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSaving(true);
    setMsg(null);
    const fd = new FormData(e.currentTarget);
    const month = Number(fd.get("month"));
    const year = Number(fd.get("year"));
    const periodStart = new Date(year, month - 1, 1).toISOString().slice(0, 10);
    const periodEnd = new Date(year, month, 0).toISOString().slice(0, 10);
    const { error } = await supabase.from("payroll_runs").insert({
      company_id: companyId,
      payroll_month: month,
      payroll_year: year,
      period_start: periodStart,
      period_end: periodEnd,
      status: "DRAFT",
    });
    if (error) { setMsg(`Error: ${error.message}`); setSaving(false); return; }
    setShowForm(false);
    setMsg("Payroll run created as draft.");
    void load();
    setSaving(false);
  }

  const currentYear = new Date().getFullYear();

  return (
    <>
      <PageHeader
        title="Payroll"
        subtitle="Monthly payroll runs"
        actions={
          <>
            <button className="btn btn-ghost btn-sm" onClick={() => void load()}>↻</button>
            <button className="btn btn-primary btn-sm" onClick={() => setShowForm(true)}>+ New run</button>
          </>
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
              rows={runs}
              columns={COLS}
              action={(row) => (
                <div style={{ display: "flex", gap: 6 }}>
                  <a href={`/payroll/${String(row.id)}`} className="btn btn-sm btn-secondary">View</a>
                  {String(row.status) === "DRAFT" && (
                    <button className="btn btn-sm btn-secondary" onClick={() => calculateRun(row)}>Calculate</button>
                  )}
                  {String(row.status) === "CALCULATED" && (
                    <button className="btn btn-sm btn-primary" onClick={() => approveRun(row)}>Approve</button>
                  )}
                </div>
              )}
            />
          )}
        </div>
      </div>

      {showForm && (
        <div className="modal-backdrop">
          <div className="modal">
            <div className="modal-header">
              <h2>Create payroll run</h2>
              <button className="btn btn-ghost btn-sm" onClick={() => setShowForm(false)}>✕</button>
            </div>
            <form onSubmit={createRun}>
              <div className="modal-body">
                <div className="form-row">
                  <div className="form-group">
                    <label>Month *</label>
                    <select name="month" required defaultValue="">
                      <option value="" disabled>Select month</option>
                      {MONTHS.map((m, i) => (
                        <option key={m} value={i + 1}>{m}</option>
                      ))}
                    </select>
                  </div>
                  <div className="form-group">
                    <label>Year *</label>
                    <select name="year" required defaultValue={currentYear}>
                      {[currentYear - 1, currentYear, currentYear + 1].map((y) => (
                        <option key={y} value={y}>{y}</option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setShowForm(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary" disabled={saving}>
                  {saving ? "Creating…" : "Create draft"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
