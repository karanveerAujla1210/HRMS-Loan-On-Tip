"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { useProfile } from "@/lib/useProfile";
import PageHeader from "@/components/PageHeader";
import DataTable from "@/components/DataTable";

type Row = Record<string, unknown>;

const COLUMNS = [
  "employee_code",
  "display_name",
  "department",
  "designation",
  "location",
  "employment_status",
  "joining_date",
  "official_email",
];

const PAGE_SIZE = 15;

export default function PeoplePage() {
  const router = useRouter();
  const { companyId } = useProfile();
  const [employees, setEmployees] = useState<Row[]>([]);
  const [filtered, setFiltered] = useState<Row[]>([]);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [deptFilter, setDeptFilter] = useState("ALL");
  const [departments, setDepartments] = useState<string[]>([]);
  const [currentPage, setCurrentPage] = useState(1);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!companyId) { setLoading(false); return; }
    setLoading(true);
    setError(null);
    const { data, error } = await supabase
      .from("v_employee_directory")
      .select("*")
      .eq("company_id", companyId)
      .order("display_name")
      .limit(1000);

    if (error) setError(error.message);
    const list = (data as Row[]) ?? [];
    setEmployees(list);

    // Extract unique department list
    const depts = Array.from(new Set(list.map((e) => String(e.department ?? "")).filter(Boolean)));
    setDepartments(depts);

    setLoading(false);
  }, [companyId]);

  useEffect(() => { void load(); }, [load]);

  useEffect(() => {
    let list = employees;
    if (statusFilter !== "ALL") {
      list = list.filter((e) => String(e.employment_status).toUpperCase() === statusFilter);
    }
    if (deptFilter !== "ALL") {
      list = list.filter((e) => String(e.department ?? "") === deptFilter);
    }
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter((e) =>
        String(e.display_name ?? "").toLowerCase().includes(q) ||
        String(e.employee_code ?? "").toLowerCase().includes(q) ||
        String(e.official_email ?? "").toLowerCase().includes(q) ||
        String(e.department ?? "").toLowerCase().includes(q) ||
        String(e.designation ?? "").toLowerCase().includes(q)
      );
    }
    setFiltered(list);
    setCurrentPage(1);
  }, [employees, search, statusFilter, deptFilter]);

  async function handleAddEmployee(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSaving(true);
    setFormError(null);
    const fd = new FormData(e.currentTarget);

    const res = await fetch("/api/employees", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        first_name: fd.get("first_name"),
        last_name: fd.get("last_name"),
        official_email: fd.get("official_email") || null,
        official_mobile: fd.get("official_mobile") || null,
        joining_date: fd.get("joining_date"),
      }),
    });
    const json = await res.json();
    if (json.error) { setFormError(json.error); setSaving(false); return; }
    setShowForm(false);
    void load();
    setSaving(false);
  }

  // Pagination calculation
  const totalPages = Math.ceil(filtered.length / PAGE_SIZE) || 1;
  const paginatedRows = filtered.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

  return (
    <>
      <PageHeader
        title="People"
        subtitle={`${employees.length} total staff members registered`}
        actions={
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <button className="btn btn-secondary btn-sm" onClick={() => router.push("/people/import")}>
              ⬆ Import CSV
            </button>
            <button className="btn btn-primary btn-sm" onClick={() => setShowForm(true)}>
              + Add Employee
            </button>
          </div>
        }
      />

      <div className="page-body">
        {error && <div className="alert alert-error">{error}</div>}

        <div className="card">
          <div className="card-header" style={{ flexWrap: "wrap", gap: 10 }}>
            <div style={{ display: "flex", gap: 10, flex: 1, flexWrap: "wrap", alignItems: "center" }}>
              <input
                placeholder="Search staff by name, code, email, dept…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                style={{ maxWidth: 280 }}
              />
              <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} style={{ width: "auto" }}>
                <option value="ALL">All Statuses</option>
                <option value="ACTIVE">Active</option>
                <option value="ON_NOTICE">On Notice</option>
                <option value="INACTIVE">Inactive</option>
                <option value="TERMINATED">Terminated / Exited</option>
              </select>
              <select value={deptFilter} onChange={(e) => setDeptFilter(e.target.value)} style={{ width: "auto" }}>
                <option value="ALL">All Departments</option>
                {departments.map((d) => (
                  <option key={d} value={d}>{d}</option>
                ))}
              </select>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <span style={{ fontSize: 13, color: "var(--text-3)" }}>
                Showing {paginatedRows.length} of {filtered.length} staff
              </span>
              <button className="btn btn-ghost btn-sm" onClick={() => void load()}>↻</button>
            </div>
          </div>

          {loading ? (
            <div className="loading-spinner"><div className="spinner" /> Loading…</div>
          ) : (
            <>
              <DataTable
                rows={paginatedRows}
                columns={COLUMNS}
                action={(row) => (
                  <button
                    className="btn btn-sm btn-secondary"
                    onClick={() => router.push(`/people/${String(row.id)}`)}
                  >
                    View Profile
                  </button>
                )}
              />

              {/* Pagination Controls */}
              {totalPages > 1 && (
                <div style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  padding: "12px 20px",
                  borderTop: "1px solid var(--border)",
                  fontSize: 13,
                }}>
                  <div style={{ color: "var(--text-3)" }}>
                    Page <strong>{currentPage}</strong> of <strong>{totalPages}</strong> ({filtered.length} staff records)
                  </div>
                  <div style={{ display: "flex", gap: 8 }}>
                    <button
                      className="btn btn-secondary btn-sm"
                      disabled={currentPage <= 1}
                      onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                    >
                      ← Previous
                    </button>
                    <button
                      className="btn btn-secondary btn-sm"
                      disabled={currentPage >= totalPages}
                      onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                    >
                      Next →
                    </button>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {showForm && (
        <div className="modal-backdrop">
          <div className="modal">
            <div className="modal-header">
              <h2>Add New Employee</h2>
              <button className="btn btn-ghost btn-sm" onClick={() => setShowForm(false)}>✕</button>
            </div>
            <form onSubmit={handleAddEmployee}>
              <div className="modal-body">
                {formError && <div className="alert alert-error" style={{ marginBottom: 16 }}>{formError}</div>}
                <div className="form-row">
                  <div className="form-group">
                    <label>First Name *</label>
                    <input name="first_name" required placeholder="Rahul" />
                  </div>
                  <div className="form-group">
                    <label>Last Name *</label>
                    <input name="last_name" required placeholder="Sharma" />
                  </div>
                </div>
                <div className="form-group">
                  <label>Official Work Email</label>
                  <input name="official_email" type="email" placeholder="rahul@acgleasing.com" />
                </div>
                <div className="form-group">
                  <label>Mobile Number</label>
                  <input name="official_mobile" placeholder="+91 98765 43210" />
                </div>
                <div className="form-group">
                  <label>Joining Date *</label>
                  <input name="joining_date" type="date" required defaultValue={new Date().toISOString().slice(0, 10)} />
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setShowForm(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary" disabled={saving}>
                  {saving ? "Saving…" : "Add Employee"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
