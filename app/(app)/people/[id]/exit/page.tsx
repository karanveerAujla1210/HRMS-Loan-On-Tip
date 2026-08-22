"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { useProfile } from "@/lib/useProfile";
import PageHeader from "@/components/PageHeader";

type Row = Record<string, unknown>;

export default function EmployeeExitPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { employeeId: currentEmpId, role } = useProfile();
  const [emp, setEmp] = useState<Row | null>(null);
  const [resignation, setResignation] = useState<Row | null>(null);
  const [assignedAssets, setAssignedAssets] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const [empRes, resignRes, assetsRes] = await Promise.all([
      supabase.from("employees").select("id,display_name,employee_code,joining_date,employment_status,notice_period_days,last_working_date,company_id").eq("id", id).single(),
      supabase.from("resignations").select("*").eq("employee_id", id).maybeSingle(),
      supabase.from("asset_assignments").select("id,assets(asset_code,model,serial_number)").eq("employee_id", id).eq("status", "ACTIVE"),
    ]);

    setEmp(empRes.data as Row | null);
    setResignation(resignRes.data as Row | null);
    setAssignedAssets((assetsRes.data ?? []) as Row[]);
    setLoading(false);
  }, [id]);

  useEffect(() => { void load(); }, [load]);

  async function handleCreateResignation(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSaving(true);
    setMsg(null);
    const fd = new FormData(e.currentTarget);
    const resDate = String(fd.get("resignation_date"));
    const lwd = String(fd.get("last_working_date"));

    const res = await fetch(`/api/people/${id}/exit`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ resignation_date: resDate, last_working_date: lwd || null, reason: fd.get("reason") || null }),
    });
    const json = await res.json();
    if (json.error) { setMsg(`Error: ${json.error}`); setSaving(false); return; }
    setMsg("Resignation submitted and employee moved to ON_NOTICE status.");
    void load();
    setSaving(false);
  }

  async function toggleClearance(type: "it" | "finance" | "hr" | "assets") {
    if (!resignation) return;
    setSaving(true);
    setMsg(null);

    const currentVal = type === "it" ? resignation.it_cleared : type === "finance" ? resignation.finance_cleared : type === "hr" ? resignation.hr_cleared : false;
    const patch: Record<string, unknown> = {};
    patch[`${type}_cleared`] = !currentVal;

    const res = await fetch(`/api/people/${id}/exit`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(patch),
    });
    const json = await res.json();
    if (json.error) { setMsg(`Error: ${json.error}`); setSaving(false); return; }
    setMsg(`${type.toUpperCase()} clearance updated.`);
    void load();
    setSaving(false);
  }

  async function handleFinalSettlement(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!resignation) return;
    setSaving(true);
    setMsg(null);
    const fd = new FormData(e.currentTarget);
    const amount = Number(fd.get("ff_amount"));
    const notes = String(fd.get("ff_notes") || "");

    const res = await fetch(`/api/people/${id}/exit`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ff_amount: amount, ff_notes: notes, status: "COMPLETED" }),
    });
    const json = await res.json();
    if (json.error) { setMsg(`Error: ${json.error}`); setSaving(false); return; }
    setMsg("Full & Final (FnF) settlement completed and employee exited successfully.");
    void load();
    setSaving(false);
  }

  if (loading) {
    return (
      <div className="loading-spinner" style={{ minHeight: "60vh" }}>
        <div className="spinner" /> Loading exit details…
      </div>
    );
  }

  const name = String(emp?.display_name ?? "Employee");
  const code = String(emp?.employee_code ?? "");
  const allClear = resignation?.it_cleared && resignation?.finance_cleared && resignation?.hr_cleared;

  return (
    <>
      <PageHeader
        title={`${name} — Exit & Clearance (FnF)`}
        subtitle={`${code} · Status: ${String(emp?.employment_status ?? "ACTIVE")}`}
        actions={
          <button className="btn btn-secondary btn-sm" onClick={() => router.push(`/people/${id}`)}>
            ← Back to Profile
          </button>
        }
      />

      <div className="page-body">
        {msg && <div className={`alert ${msg.startsWith("Error") ? "alert-error" : "alert-success"}`}>{msg}</div>}

        {!resignation ? (
          <div className="card" style={{ maxWidth: 640, margin: "0 auto" }}>
            <div className="card-header">
              <div>
                <h2>Initiate Resignation / Exit Process</h2>
                <p>Record resignation details and start multi-department clearance</p>
              </div>
            </div>
            <form onSubmit={handleCreateResignation}>
              <div className="card-body">
                <div className="form-row">
                  <div className="form-group">
                    <label>Resignation Notice Date *</label>
                    <input name="resignation_date" type="date" required defaultValue={new Date().toISOString().slice(0, 10)} />
                  </div>
                  <div className="form-group">
                    <label>Expected Last Working Date (LWD)</label>
                    <input name="last_working_date" type="date" />
                  </div>
                </div>
                <div className="form-group">
                  <label>Resignation Reason / Feedback</label>
                  <textarea name="reason" rows={3} placeholder="Reason for leaving, notice period discussion, etc..." />
                </div>
              </div>
              <div className="card-footer" style={{ display: "flex", justifyContent: "flex-end" }}>
                <button type="submit" className="btn btn-primary" disabled={saving}>
                  {saving ? "Initiating…" : "Initiate Exit Clearance"}
                </button>
              </div>
            </form>
          </div>
        ) : (
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20 }}>
            {/* Clearance Checkpoints */}
            <div className="card">
              <div className="card-header">
                <div>
                  <h2>Department Clearances</h2>
                  <p>All departments must sign off before final settlement</p>
                </div>
              </div>
              <div className="card-body" style={{ display: "grid", gap: 16 }}>
                {/* IT & Asset Clearance */}
                <div style={{ border: "1px solid var(--border)", borderRadius: 8, padding: 14, background: resignation.it_cleared ? "#f0fdf4" : "var(--bg)" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <div>
                      <strong style={{ fontSize: 14 }}>1. IT & Hardware Clearance</strong>
                      <div style={{ fontSize: 12, color: "var(--text-3)", marginTop: 2 }}>
                        {assignedAssets.length === 0 ? (
                          <span style={{ color: "var(--green)" }}>✓ 0 active assets assigned</span>
                        ) : (
                          <span style={{ color: "var(--red)" }}>⚠ {assignedAssets.length} assets still assigned (Return required)</span>
                        )}
                      </div>
                    </div>
                    <button
                      className={`btn btn-sm ${resignation.it_cleared ? "btn-primary" : "btn-secondary"}`}
                      onClick={() => toggleClearance("it")}
                      disabled={saving}
                    >
                      {resignation.it_cleared ? "✓ Cleared" : "Sign Off IT"}
                    </button>
                  </div>
                </div>

                {/* Finance Clearance */}
                <div style={{ border: "1px solid var(--border)", borderRadius: 8, padding: 14, background: resignation.finance_cleared ? "#f0fdf4" : "var(--bg)" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <div>
                      <strong style={{ fontSize: 14 }}>2. Finance & Dues Clearance</strong>
                      <div style={{ fontSize: 12, color: "var(--text-3)", marginTop: 2 }}>
                        Salary advances, expense claims, company card dues
                      </div>
                    </div>
                    <button
                      className={`btn btn-sm ${resignation.finance_cleared ? "btn-primary" : "btn-secondary"}`}
                      onClick={() => toggleClearance("finance")}
                      disabled={saving}
                    >
                      {resignation.finance_cleared ? "✓ Cleared" : "Sign Off Finance"}
                    </button>
                  </div>
                </div>

                {/* HR Clearance */}
                <div style={{ border: "1px solid var(--border)", borderRadius: 8, padding: 14, background: resignation.hr_cleared ? "#f0fdf4" : "var(--bg)" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <div>
                      <strong style={{ fontSize: 14 }}>3. HR Exit Interview & Documents</strong>
                      <div style={{ fontSize: 12, color: "var(--text-3)", marginTop: 2 }}>
                        Exit interview questionnaire, handover docs, ID card return
                      </div>
                    </div>
                    <button
                      className={`btn btn-sm ${resignation.hr_cleared ? "btn-primary" : "btn-secondary"}`}
                      onClick={() => toggleClearance("hr")}
                      disabled={saving}
                    >
                      {resignation.hr_cleared ? "✓ Cleared" : "Sign Off HR"}
                    </button>
                  </div>
                </div>
              </div>
            </div>

            {/* FnF Settlement Card */}
            <div className="card">
              <div className="card-header">
                <div>
                  <h2>Full & Final (FnF) Settlement</h2>
                  <p>Calculated dues and final release</p>
                </div>
                {resignation.status === "COMPLETED" && (
                  <span className="pill pill-green">FnF Closed</span>
                )}
              </div>
              <form onSubmit={handleFinalSettlement}>
                <div className="card-body">
                  <div className="form-group">
                    <label>Net FnF Payout Amount (₹) *</label>
                    <input
                      name="ff_amount"
                      type="number"
                      min={0}
                      required
                      defaultValue={Number(resignation.ff_amount) || 0}
                      placeholder="e.g. 85000"
                    />
                  </div>
                  <div className="form-group">
                    <label>Settlement Breakdown & Notes</label>
                    <textarea
                      name="ff_notes"
                      rows={4}
                      defaultValue={String(resignation.ff_notes ?? "")}
                      placeholder="e.g. Gratuity: ₹35,000, 15 days Leave Encashment: ₹25,000, Pro-rated salary: ₹25,000. Total Net: ₹85,000"
                    />
                  </div>
                </div>
                <div className="card-footer" style={{ display: "flex", justifyContent: "flex-end" }}>
                  <button
                    type="submit"
                    className="btn btn-primary"
                    disabled={saving || !allClear || resignation.status === "COMPLETED"}
                  >
                    {saving ? "Finalizing…" : resignation.status === "COMPLETED" ? "Settled" : "Approve & Complete Exit"}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </>
  );
}
