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
        .select("id,employee_id,paid_days,gross_salary,total_deductions,net_salary,status,employees(display_name,employee_code,official_email)")
        .eq("payroll_run_id", id)
        .order("gross_salary", { ascending: false }),
    ]);
    if (runRes.error) setError(runRes.error.message);
    setRun(runRes.data as Row);
    const rows = ((itemsRes.data ?? []) as Record<string, unknown>[]).map((r) => ({
      ...r,
      display_name: (r.employees as Record<string, unknown> | null)?.display_name ?? "—",
      employee_code: (r.employees as Record<string, unknown> | null)?.employee_code ?? "—",
      official_email: (r.employees as Record<string, unknown> | null)?.official_email ?? "—",
    }));
    setItems(rows as Row[]);
    setLoading(false);
  }, [id]);

  useEffect(() => { void load(); }, [load]);

  async function exportCsv() {
    const header = ["Employee Code", "Employee Name", "Paid Days", "Gross Salary", "Total Deductions", "Net Salary", "Status"].join(",");
    const rows = items.map((r) =>
      [
        `"${String(r.employee_code ?? "")}"`,
        `"${String(r.display_name ?? "")}"`,
        r.paid_days,
        r.gross_salary,
        r.total_deductions,
        r.net_salary,
        r.status,
      ].join(",")
    );
    const blob = new Blob([[header, ...rows].join("\n")], { type: "text/csv" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `payroll-register-${String(run?.payroll_year)}-${String(run?.payroll_month).padStart(2, "0")}.csv`;
    a.click();
  }

  async function exportBankCms() {
    if (!items.length) return;
    const empIds = items.map((i) => i.employee_id);
    const { data: banks } = await supabase
      .from("employee_bank_accounts")
      .select("employee_id,account_holder_name,bank_name,ifsc_code,account_number_encrypted,account_number_last4")
      .in("employee_id", empIds)
      .eq("is_primary", true);

    const bankMap = new Map((banks ?? []).map((b) => [b.employee_id, b]));

    const header = ["Beneficiary Name", "Account Number", "IFSC Code", "Amount (INR)", "Payment Mode", "Narration / Reference"].join(",");
    const rows = items.map((item) => {
      const b = bankMap.get(item.employee_id as string);
      const accNo = b?.account_number_encrypted || b?.account_number_last4 || "00000000";
      const ifsc = b?.ifsc_code || "HDFC0000001";
      const name = b?.account_holder_name || item.display_name;
      const ref = `SALARY-${String(run?.payroll_month).padStart(2, "0")}/${String(run?.payroll_year)}`;
      return [`"${name}"`, `"${accNo}"`, `"${ifsc}"`, item.net_salary, "NEFT", `"${ref}"`].join(",");
    });

    const blob = new Blob([[header, ...rows].join("\n")], { type: "text/csv" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `bank-payout-cms-${String(run?.payroll_year)}-${String(run?.payroll_month).padStart(2, "0")}.csv`;
    a.click();
  }

  async function approveRun() {
    setMsg(null);
    const res = await fetch(`/api/payroll/runs/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "APPROVED" }),
    });
    const json = await res.json();
    if (json.error) { setMsg(`Error: ${json.error}`); return; }
    setMsg("Payroll run approved successfully.");
    void load();
  }

  async function lockRun() {
    setMsg(null);
    const res = await fetch(`/api/payroll/runs/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "LOCKED" }),
    });
    const json = await res.json();
    if (json.error) { setMsg(`Error: ${json.error}`); return; }
    setMsg("Payroll run locked successfully.");
    void load();
  }

  const status = String(run?.status ?? "");

  const runTitle = run ? `${run.payroll_year}/${String(run.payroll_month).padStart(2, "0")}` : "…";

  return (
    <>
      <PageHeader
        title={`Payroll Run — ${runTitle}`}
        subtitle={`Status: ${status}`}
        breadcrumbs={[
          { label: "Dashboard", href: "/dashboard" },
          { label: "Payroll Runs", href: "/payroll" },
          { label: `Run ${runTitle}` },
        ]}
        actions={
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <button className="btn btn-secondary btn-sm" onClick={() => router.push("/payroll")}>← Payroll Runs</button>
            <button className="btn btn-secondary btn-sm" onClick={exportCsv} disabled={!items.length}>
              ⬇ Payroll Register CSV
            </button>
            <button className="btn btn-secondary btn-sm" onClick={exportBankCms} disabled={!items.length}>
              🏦 Bank CMS Payout Sheet
            </button>
            {status === "CALCULATED" && (
              <button className="btn btn-primary btn-sm" onClick={approveRun}>Approve Payroll</button>
            )}
            {status === "APPROVED" && (
              <button className="btn btn-primary btn-sm" onClick={lockRun}>Lock Payroll</button>
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
              { label: "Total Deductions", value: `₹${Number(run.total_deductions ?? 0).toLocaleString("en-IN")}` },
              { label: "Net Payout", value: `₹${Number(run.net_pay ?? 0).toLocaleString("en-IN")}` },
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
            <div>
              <h2>Employee Payslip Records</h2>
              <p>{items.length} employee payroll calculations</p>
            </div>
          </div>
          {loading ? (
            <div className="loading-spinner"><div className="spinner" /> Loading…</div>
          ) : (
            <DataTable
              rows={items}
              columns={COLS}
              action={(row) => (
                <button
                  className="btn btn-sm btn-primary"
                  onClick={() => router.push(`/payroll/payslip/${String(row.id)}`)}
                >
                  📄 View Payslip
                </button>
              )}
            />
          )}
        </div>
      </div>
    </>
  );
}
