"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import PageHeader from "@/components/PageHeader";
import DataTable from "@/components/DataTable";

type Row = Record<string, unknown>;

export default function EmployeeSalaryPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [empName, setEmpName] = useState("");
  const [companyId, setCompanyId] = useState<string | null>(null);
  const [current, setCurrent] = useState<Row | null>(null);
  const [history, setHistory] = useState<Row[]>([]);
  const [structures, setStructures] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const [empRes, currRes, histRes] = await Promise.all([
      supabase.from("employees").select("display_name,company_id").eq("id", id).single(),
      supabase.from("employee_salary_assignments")
        .select("id,annual_ctc,monthly_ctc,effective_from,salary_structures(name)")
        .eq("employee_id", id)
        .eq("is_current", true)
        .maybeSingle(),
      supabase.from("employee_salary_history")
        .select("previous_ctc,new_ctc,effective_date,reason,created_at,approved_by_emp:approved_by(display_name)")
        .eq("employee_id", id)
        .order("effective_date", { ascending: false })
        .limit(20),
    ]);
    setEmpName(String(empRes.data?.display_name ?? "Employee"));
    const cid = empRes.data?.company_id as string | null;
    setCompanyId(cid);
    setCurrent(currRes.data as Row | null);
    const hist = ((histRes.data ?? []) as Record<string, unknown>[]).map((r) => ({
      ...r,
      approved_by: (r.approved_by_emp as Record<string, unknown> | null)?.display_name ?? "—",
    }));
    setHistory(hist as Row[]);

    if (cid) {
      const { data: structs } = await supabase.from("salary_structures").select("id,name").eq("company_id", cid).eq("is_active", true).order("name");
      setStructures((structs as Row[]) ?? []);
    }
    setLoading(false);
  }, [id]);

  useEffect(() => { void load(); }, [load]);

  async function handleAssign(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSaving(true);
    setMsg(null);
    const fd = new FormData(e.currentTarget);
    const annualCtc = Number(fd.get("annual_ctc"));
    const structureId = fd.get("salary_structure_id") as string;
    const effectiveFrom = fd.get("effective_from") as string;

    const { data: { session } } = await supabase.auth.getSession();
    let approverId: string | null = null;
    if (session) {
      const { data: prof } = await supabase.from("profiles").select("employee_id").eq("auth_user_id", session.user.id).single();
      approverId = prof?.employee_id ?? null;
    }

    // Close existing current assignment
    if (current) {
      await supabase.from("employee_salary_assignments")
        .update({ is_current: false, effective_to: effectiveFrom })
        .eq("id", String(current.id));
    }

    // Insert new assignment
    const { error } = await supabase.from("employee_salary_assignments").insert({
      employee_id: id,
      salary_structure_id: structureId || null,
      annual_ctc: annualCtc,
      effective_from: effectiveFrom,
      is_current: true,
      approved_by: approverId,
    });

    if (error) { setMsg(`Error: ${error.message}`); setSaving(false); return; }

    // Write salary history
    await supabase.from("employee_salary_history").insert({
      employee_id: id,
      previous_ctc: current ? Number((current as Record<string, unknown>).annual_ctc) : null,
      new_ctc: annualCtc,
      previous_structure_id: current ? (current as Record<string, unknown>).salary_structure_id : null,
      new_structure_id: structureId || null,
      effective_date: effectiveFrom,
      reason: fd.get("reason") || null,
      approved_by: approverId,
    });

    setMsg("Salary assigned successfully.");
    setShowForm(false);
    void load();
    setSaving(false);
  }

  const curr = current as Record<string, unknown> | null;
  const struct = curr?.salary_structures as Record<string, unknown> | null;

  return (
    <>
      <PageHeader
        title={`${empName} — Salary`}
        subtitle="Salary structure and CTC history"
        actions={
          <div style={{ display: "flex", gap: 8 }}>
            <button className="btn btn-secondary btn-sm" onClick={() => router.back()}>← Back</button>
            <button className="btn btn-primary btn-sm" onClick={() => setShowForm(true)}>
              {current ? "Revise salary" : "Assign salary"}
            </button>
          </div>
        }
      />

      <div className="page-body">
        {msg && <div className={`alert ${msg.startsWith("Error") ? "alert-error" : "alert-success"}`}>{msg}</div>}

        {loading ? (
          <div className="loading-spinner"><div className="spinner" /> Loading…</div>
        ) : (
          <>
            {/* Current salary card */}
            <div className="card" style={{ marginBottom: 20 }}>
              <div className="card-header"><div><h2>Current salary</h2></div></div>
              <div style={{ padding: 20, display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: "12px 32px" }}>
                {[
                  ["Structure",    struct?.name ?? "—"],
                  ["Annual CTC",   curr ? `₹${Number(curr.annual_ctc).toLocaleString("en-IN")}` : "—"],
                  ["Monthly CTC",  curr ? `₹${Number(curr.monthly_ctc).toLocaleString("en-IN")}` : "—"],
                  ["Effective from", curr?.effective_from ?? "—"],
                ].map(([label, val]) => (
                  <div key={String(label)}>
                    <div style={{ fontSize: 11, fontWeight: 600, color: "var(--text-3)", textTransform: "uppercase", letterSpacing: ".5px" }}>{label}</div>
                    <div style={{ fontSize: 15, fontWeight: 700, color: "var(--text)", marginTop: 4 }}>{String(val)}</div>
                  </div>
                ))}
              </div>
            </div>

            {/* Salary history */}
            <div className="card">
              <div className="card-header"><div><h2>Salary history</h2><p>{history.length} revisions</p></div></div>
              <DataTable rows={history} columns={["effective_date","previous_ctc","new_ctc","reason","approved_by","created_at"]} />
            </div>
          </>
        )}
      </div>

      {showForm && (
        <div className="modal-backdrop">
          <div className="modal">
            <div className="modal-header">
              <h2>{current ? "Revise salary" : "Assign salary"}</h2>
              <button className="btn btn-ghost btn-sm" onClick={() => setShowForm(false)}>✕</button>
            </div>
            <form onSubmit={handleAssign}>
              <div className="modal-body">
                <div className="form-group">
                  <label>Salary structure</label>
                  <select name="salary_structure_id" defaultValue="">
                    <option value="">No structure</option>
                    {structures.map((s) => (
                      <option key={String(s.id)} value={String(s.id)}>{String(s.name)}</option>
                    ))}
                  </select>
                </div>
                <div className="form-group">
                  <label>Annual CTC (₹) *</label>
                  <input name="annual_ctc" type="number" required min={0} placeholder="e.g. 600000" />
                </div>
                <div className="form-group">
                  <label>Effective from *</label>
                  <input name="effective_from" type="date" required defaultValue={new Date().toISOString().slice(0, 10)} />
                </div>
                <div className="form-group">
                  <label>Reason</label>
                  <textarea name="reason" rows={2} placeholder="e.g. Annual increment, promotion…" />
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setShowForm(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary" disabled={saving}>{saving ? "Saving…" : "Save"}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
