"use client";

import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import PageHeader from "@/components/PageHeader";
import DataTable from "@/components/DataTable";

const COMPANY_ID = "00000000-0000-0000-0000-000000000001";
type Row = Record<string, unknown>;

const COLUMNS = ["employee_code", "display_name", "department", "designation", "location", "employment_status", "joining_date", "official_email"];

export default function PeoplePage() {
  const [employees, setEmployees] = useState<Row[]>([]);
  const [filtered, setFiltered] = useState<Row[]>([]);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    const { data, error } = await supabase
      .from("v_employee_directory")
      .select("*")
      .eq("company_id", COMPANY_ID)
      .order("display_name")
      .limit(200);
    if (error) setError(error.message);
    setEmployees((data as Row[]) ?? []);
    setLoading(false);
  }, []);

  useEffect(() => { void load(); }, [load]);

  useEffect(() => {
    let list = employees;
    if (statusFilter !== "ALL") list = list.filter((e) => String(e.employment_status).toUpperCase() === statusFilter);
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter((e) =>
        String(e.display_name ?? "").toLowerCase().includes(q) ||
        String(e.employee_code ?? "").toLowerCase().includes(q) ||
        String(e.official_email ?? "").toLowerCase().includes(q)
      );
    }
    setFiltered(list);
  }, [employees, search, statusFilter]);

  async function handleAddEmployee(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSaving(true);
    setFormError(null);
    const fd = new FormData(e.currentTarget);

    const { error } = await supabase.from("employees").insert({
      company_id: COMPANY_ID,
      first_name: fd.get("first_name"),
      last_name: fd.get("last_name"),
      official_email: fd.get("official_email") || null,
      official_mobile: fd.get("official_mobile") || null,
      joining_date: fd.get("joining_date"),
      employment_status: "ACTIVE",
    });

    if (error) { setFormError(error.message); setSaving(false); return; }
    setShowForm(false);
    void load();
    setSaving(false);
  }

  return (
    <>
      <PageHeader
        title="People"
        subtitle={`${employees.length} employees`}
        actions={
          <button className="btn btn-primary btn-sm" onClick={() => setShowForm(true)}>
            + Add employee
          </button>
        }
      />

      <div className="page-body">
        {error && <div className="alert alert-error">{error}</div>}

        <div className="card">
          <div className="card-header">
            <div style={{ display: "flex", gap: 10, flex: 1, flexWrap: "wrap" }}>
              <input
                placeholder="Search by name, code or email…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                style={{ maxWidth: 280 }}
              />
              <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} style={{ width: "auto" }}>
                <option value="ALL">All statuses</option>
                <option value="ACTIVE">Active</option>
                <option value="INACTIVE">Inactive</option>
                <option value="TERMINATED">Terminated</option>
              </select>
            </div>
            <button className="btn btn-ghost btn-sm" onClick={() => void load()}>↻</button>
          </div>

          {loading ? (
            <div className="loading-spinner"><div className="spinner" /> Loading…</div>
          ) : (
            <DataTable rows={filtered} columns={COLUMNS} />
          )}
        </div>
      </div>

      {showForm && (
        <div className="modal-backdrop">
          <div className="modal">
            <div className="modal-header">
              <h2>Add employee</h2>
              <button className="btn btn-ghost btn-sm" onClick={() => setShowForm(false)}>✕</button>
            </div>
            <form onSubmit={handleAddEmployee}>
              <div className="modal-body">
                {formError && <div className="alert alert-error" style={{ marginBottom: 16 }}>{formError}</div>}
                <div className="form-row">
                  <div className="form-group">
                    <label>First name *</label>
                    <input name="first_name" required placeholder="Rahul" />
                  </div>
                  <div className="form-group">
                    <label>Last name *</label>
                    <input name="last_name" required placeholder="Sharma" />
                  </div>
                </div>
                <div className="form-group">
                  <label>Work email</label>
                  <input name="official_email" type="email" placeholder="rahul@acgleasing.com" />
                </div>
                <div className="form-group">
                  <label>Mobile</label>
                  <input name="official_mobile" placeholder="+91 98765 43210" />
                </div>
                <div className="form-group">
                  <label>Joining date *</label>
                  <input name="joining_date" type="date" required />
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setShowForm(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary" disabled={saving}>
                  {saving ? "Saving…" : "Add employee"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
