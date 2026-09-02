"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { useProfile } from "@/lib/useProfile";
import { PageHeader, DataTable, Modal, useForm, Input, Select, SkeletonTable, Skeleton } from "@/components";
import { useToast } from "@/components/Toast";

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

type Option = { id: string; name: string };

export default function PeoplePage() {
  const router = useRouter();
  const { companyId, loading: profileLoading } = useProfile();
  const { showToast } = useToast();
  const [employees, setEmployees] = useState<Row[]>([]);
  const [filtered, setFiltered] = useState<Row[]>([]);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [deptFilter, setDeptFilter] = useState("ALL");
  const [departments, setDepartments] = useState<string[]>([]);
  const [deptOptions, setDeptOptions] = useState<Option[]>([]);
  const [desigOptions, setDesigOptions] = useState<Option[]>([]);
  const [locOptions, setLocOptions] = useState<Option[]>([]);
  const [currentPage, setCurrentPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);

  const load = useCallback(async () => {
    if (!companyId) { if (!profileLoading) setLoading(false); return; }
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

    const depts = Array.from(new Set(list.map((e) => String(e.department ?? "")).filter(Boolean)));
    setDepartments(depts);

    // Load real department / designation / location options for the Add form
    const [dRes, dgRes, lRes] = await Promise.all([
      supabase.from("departments").select("id,name").eq("company_id", companyId).eq("is_active", true).order("name"),
      supabase.from("designations").select("id,name").eq("company_id", companyId).eq("is_active", true).order("name"),
      supabase.from("locations").select("id,name").eq("company_id", companyId).eq("is_active", true).order("name"),
    ]);
    setDeptOptions((dRes.data as Option[]) ?? []);
    setDesigOptions((dgRes.data as Option[]) ?? []);
    setLocOptions((lRes.data as Option[]) ?? []);

    setLoading(false);
  }, [companyId, profileLoading]);

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

  const form = useForm({
    first_name: "",
    last_name: "",
    official_email: "",
    official_mobile: "",
    joining_date: new Date().toISOString().slice(0, 10),
    department: "",
    designation: "",
    location: "",
  }, (values) => {
    const errors: Record<string, string> = {};
    if (!values.first_name.trim()) errors.first_name = "First name is required";
    if (!values.last_name.trim()) errors.last_name = "Last name is required";
    if (!values.joining_date) errors.joining_date = "Joining date is required";
    if (values.official_email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(values.official_email)) {
      errors.official_email = "Invalid email format";
    }
    return errors;
  });

  async function handleSubmit(values: typeof form.values) {
    const res = await fetch("/api/employees", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        first_name: values.first_name,
        last_name: values.last_name,
        official_email: values.official_email || null,
        official_mobile: values.official_mobile || null,
        joining_date: values.joining_date,
        department_id: values.department || null,   // real UUID from DB
        designation_id: values.designation || null, // real UUID from DB
        location_id: values.location || null,       // real UUID from DB
      }),
    });
    const json = await res.json();
    if (json.error) {
      showToast({ type: "error", title: "Failed to add employee", message: json.message || json.error });
      return false;
    }
    showToast({ type: "success", title: "Employee added", message: `${values.first_name} ${values.last_name} has been added.` });
    return true;
  }

  const handleFormSubmit = form.handleSubmit(async (values) => {
    const success = await handleSubmit(values);
    if (success) {
      form.resetForm();
      setShowForm(false);
      void load();
    }
  });

  // Pagination calculation
  const totalPages = Math.ceil(filtered.length / PAGE_SIZE) || 1;
  const paginatedRows = filtered.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

  if (loading) {
    return (
      <>
        <PageHeader
          title="People"
          subtitle="Staff members registered"
          breadcrumbs={[{ label: "Dashboard", href: "/dashboard" }, { label: "People Directory" }]}
          actions={
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              <Skeleton variant="rectangular" width={120} height={36} />
              <Skeleton variant="rectangular" width={140} height={36} />
            </div>
          }
        />
        <div className="page-body">
          <div className="card">
            <div className="card-header" style={{ flexWrap: "wrap", gap: 10 }}>
              <div style={{ display: "flex", gap: 10, flex: 1, flexWrap: "wrap", alignItems: "center" }}>
                <Skeleton variant="text" width={280} />
                <Skeleton variant="text" width={140} />
                <Skeleton variant="text" width={160} />
              </div>
              <Skeleton variant="text" width={200} />
            </div>
            <SkeletonTable rows={5} columns={8} />
          </div>
        </div>
      </>
    );
  }

  return (
    <>
      <PageHeader
        title="People"
        subtitle={`${employees.length} total staff members registered`}
        breadcrumbs={[{ label: "Dashboard", href: "/dashboard" }, { label: "People Directory" }]}
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
            striped
            hoverable
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
        </div>
      </div>

      <Modal
        isOpen={showForm}
        onClose={() => { form.resetForm(); setShowForm(false); }}
        title="Add New Employee"
        size="lg"
        footer={
          <>
            <button className="btn btn-secondary" onClick={() => { form.resetForm(); setShowForm(false); }}>
              Cancel
            </button>
          </>
        }
      >
        <form onSubmit={handleFormSubmit}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
            <Input
              label="First Name *"
              name="first_name"
              value={form.values.first_name}
              onChange={form.handleChange("first_name")}
              onBlur={form.handleBlur("first_name")}
              error={form.meta.first_name.touched ? form.errors.first_name?.message : null}
              placeholder="Rahul"
              required
            />
            <Input
              label="Last Name *"
              name="last_name"
              value={form.values.last_name}
              onChange={form.handleChange("last_name")}
              onBlur={form.handleBlur("last_name")}
              error={form.meta.last_name.touched ? form.errors.last_name?.message : null}
              placeholder="Sharma"
              required
            />
            <Input
              label="Official Work Email"
              name="official_email"
              type="email"
              value={form.values.official_email}
              onChange={form.handleChange("official_email")}
              onBlur={form.handleBlur("official_email")}
              error={form.meta.official_email.touched ? form.errors.official_email?.message : null}
              placeholder="rahul@company.com"
            />
            <Input
              label="Mobile Number"
              name="official_mobile"
              value={form.values.official_mobile}
              onChange={form.handleChange("official_mobile")}
              onBlur={form.handleBlur("official_mobile")}
              placeholder="+91 98765 43210"
            />
            <Input
              label="Joining Date *"
              name="joining_date"
              type="date"
              value={form.values.joining_date}
              onChange={form.handleChange("joining_date")}
              onBlur={form.handleBlur("joining_date")}
              error={form.meta.joining_date.touched ? form.errors.joining_date?.message : null}
              required
            />
            <Select
              label="Department"
              name="department"
              value={form.values.department}
              onChange={form.handleChange("department")}
              onBlur={form.handleBlur("department")}
              options={deptOptions.map(d => ({ value: d.id, label: d.name }))}
              placeholder="Select department"
            />
            <Select
              label="Designation"
              name="designation"
              value={form.values.designation}
              onChange={form.handleChange("designation")}
              onBlur={form.handleBlur("designation")}
              options={desigOptions.map(d => ({ value: d.id, label: d.name }))}
              placeholder="Select designation"
            />
            <Select
              label="Location"
              name="location"
              value={form.values.location}
              onChange={form.handleChange("location")}
              onBlur={form.handleBlur("location")}
              options={locOptions.map(l => ({ value: l.id, label: l.name }))}
              placeholder="Select location"
            />
          </div>
          <div style={{ marginTop: 20, display: "flex", justifyContent: "flex-end", gap: 10 }}>
            <button type="submit" className="btn btn-primary" disabled={form.isSubmitting}>
              {form.isSubmitting ? "Saving…" : "Add Employee"}
            </button>
          </div>
        </form>
      </Modal>
    </>
  );
}