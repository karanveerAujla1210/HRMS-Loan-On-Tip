"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import PageHeader from "@/components/PageHeader";
import DataTable from "@/components/DataTable";

type Row = Record<string, unknown>;

const COLS = ["display_name", "paid_days", "gross_salary", "total_deductions", "net_salary", "status"];

export default function PayrollRunDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [run, setRun] = useState<Row | null>(null);
  const [items, setItems] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    const [runRes, itemsRes] = await Promise.all([
      supabase.from("payroll_runs").select("*").eq("id", id).single(),
      supabase
        .from("payroll_items")
        .select("id,employee_id,paid_days,gross_salary,total_deductions,net_salary,status,employees(display_name)")
        .eq("payroll_run_id", id)
        .order("gross_salary", { ascending: false }),
    ]);
    if (runRes.error) setError(runRes.error.message);
    setRun(runRes.data as Row);
    const rows = ((itemsRes.data ?? []) as Record<string, unknown>[]).map((r) => ({
      ...r,
      display_name: (r.employees as Record<string, unknown> | null)?.display_name ?? "—",
    }));
    setItems(rows as Row[]);
    setLoading(false);
  }, [id]);

  useEffect(() => { void load(); }, [load]);

  async function exportCsv() {
    const header = ["Employee", "Paid Days", "Gross", "Deductions", "Net"].join(",");
    const rows = items.map((r) =>
      [r.display_name, r.paid_days, r.gross_salary, r.total_deductions, r.net_salary].join(",")
    );
    const blob = new Blob([[header, ...rows].join("\n")], { type: "text/csv" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `payroll-${String(run?.payroll_year)}-${String(run?.payroll_month).padStart(2, "0")}.csv`;
    a.click();
  }

  async function approveRun() {
    setMsg(null);
    const { error } = await supabase.from("payroll_runs").update({ status: "APPROVED" }).eq("id", id);
    if (error) { setMsg(`Error: ${error.message}`); return; }
    setMsg("Payroll run approved.");
    void load();
  }

  const status = String(run?.status ?? "");

  return (
    <>
      <PageHeader
        title={`Payroll Run — ${run ? `${run.payroll_year}/${String(run.payroll_month).padStart(2, "0")}` : "…"}`}
        subtitle={status}
        actions={
          <div style={{ display: "flex", gap: 8 }}>
            <button className="btn btn-secondary btn-sm" onClick={() => router.push("/payroll")}>← Back</button>
            <button className="btn btn-secondary btn-sm" onClick={exportCsv} disabled={!items.length}>⬇ Export CSV</button>
            {status === "CALCULATED" && (
              <button className="btn btn-primary btn-sm" onClick={approveRun}>Approve</button>
            )}
          </div>
        }
      />

      <div className="page-body">
        {error && <div className="alert alert-error">{error}</div>}
        {msg && <div className="alert alert-success">{msg}</div>}

        {run && (
          <div className="stats-grid" style={{ marginBottom: 20 }}>
            {[
              { label: "Employees", value: String(run.employee_count ?? 0) },
              { label: "Gross Pay", value: `₹${Number(run.gross_pay ?? 0).toLocaleString("en-IN")}` },
              { label: "Deductions", value: `₹${Number(run.total_deductions ?? 0).toLocaleString("en-IN")}` },
              { label: "Net Pay", value: `₹${Number(run.net_pay ?? 0).toLocaleString("en-IN")}` },
            ].map(({ label, value }) => (
              <div className="stat-card" key={label}>
                <div className="stat-label">{label}</div>
                <div className="stat-value" style={{ fontSize: 20 }}>{value}</div>
              </div>
            ))}
          </div>
        )}

        <div className="card">
          <div className="card-header">
            <div><h2>Employee payslips</h2><p>{items.length} records</p></div>
          </div>
          {loading ? (
            <div className="loading-spinner"><div className="spinner" /> Loading…</div>
          ) : (
            <DataTable rows={items} columns={COLS} />
          )}
        </div>
      </div>
    </>
  );
}
