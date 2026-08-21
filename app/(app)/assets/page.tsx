"use client";

import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import PageHeader from "@/components/PageHeader";
import DataTable from "@/components/DataTable";

const COMPANY_ID = "00000000-0000-0000-0000-000000000001";
type Row = Record<string, unknown>;
type Asset = Row & { id: string; asset_code: string; status: string };

const COLS = ["asset_code", "category", "brand", "model", "serial_number", "assigned_to", "status", "warranty_end"];

export default function AssetsPage() {
  const [assets, setAssets] = useState<Asset[]>([]);
  const [employees, setEmployees] = useState<Row[]>([]);
  const [categories, setCategories] = useState<Row[]>([]);
  const [locations, setLocations] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [showAddForm, setShowAddForm] = useState(false);
  const [assigning, setAssigning] = useState<Asset | null>(null);
  const [saving, setSaving] = useState(false);
  const [statusFilter, setStatusFilter] = useState("ALL");

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    const [assetsRes, empRes, catRes, locRes] = await Promise.all([
      supabase.from("v_asset_inventory").select("*").eq("company_id", COMPANY_ID).order("asset_code"),
      supabase.from("v_employee_directory").select("id,display_name,employee_code").eq("company_id", COMPANY_ID).eq("employment_status", "ACTIVE").order("display_name").limit(200),
      supabase.from("asset_categories").select("id,name,prefix").eq("company_id", COMPANY_ID).eq("is_active", true).order("name"),
      supabase.from("locations").select("id,name").eq("company_id", COMPANY_ID).eq("is_active", true).order("name"),
    ]);
    if (assetsRes.error) setError(assetsRes.error.message);
    setAssets((assetsRes.data as Asset[]) ?? []);
    setEmployees((empRes.data as Row[]) ?? []);
    setCategories((catRes.data as Row[]) ?? []);
    setLocations((locRes.data as Row[]) ?? []);
    setLoading(false);
  }, []);

  useEffect(() => { void load(); }, [load]);

  const filtered = statusFilter === "ALL" ? assets : assets.filter((a) => a.status === statusFilter);

  async function handleAddAsset(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSaving(true);
    setMsg(null);
    const fd = new FormData(e.currentTarget);
    const category = categories.find((c) => c.id === fd.get("asset_category_id"));
    if (!category) { setMsg("Select a category."); setSaving(false); return; }

    const { error } = await supabase.from("assets").insert({
      company_id: COMPANY_ID,
      asset_category_id: category.id,
      location_id: fd.get("location_id") || null,
      asset_code: `${String(category.prefix ?? "AST").toUpperCase()}-${Date.now().toString().slice(-8)}`,
      asset_tag: fd.get("asset_tag") || null,
      brand: fd.get("brand") || null,
      model: fd.get("model") || null,
      serial_number: fd.get("serial_number") || null,
      condition: fd.get("condition") || "GOOD",
      status: "AVAILABLE",
    });

    if (error) { setMsg(`Error: ${error.message}`); setSaving(false); return; }
    setShowAddForm(false);
    setMsg("Asset added to inventory.");
    void load();
    setSaving(false);
  }

  async function handleAssign(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!assigning) return;
    setSaving(true);
    setMsg(null);
    const employeeId = String(new FormData(e.currentTarget).get("employee_id") ?? "");
    if (!employeeId) { setMsg("Select an employee."); setSaving(false); return; }

    const { error: assignErr } = await supabase.from("asset_assignments").insert({
      asset_id: assigning.id,
      employee_id: employeeId,
      status: "ACTIVE",
    });
    if (assignErr) { setMsg(`Error: ${assignErr.message}`); setSaving(false); return; }

    const { error: updateErr } = await supabase.from("assets")
      .update({ current_employee_id: employeeId, status: "ASSIGNED" })
      .eq("id", assigning.id);
    if (updateErr) { setMsg(`Assigned but status update failed: ${updateErr.message}`); }
    else setMsg("Asset assigned successfully.");

    setAssigning(null);
    void load();
    setSaving(false);
  }

  return (
    <>
      <PageHeader
        title="Assets"
        subtitle={`${assets.length} assets tracked`}
        actions={
          <>
            <button className="btn btn-ghost btn-sm" onClick={() => void load()}>↻</button>
            <button className="btn btn-primary btn-sm" onClick={() => setShowAddForm(true)}>+ Add asset</button>
          </>
        }
      />

      <div className="page-body">
        {error && <div className="alert alert-error">{error}</div>}
        {msg && <div className="alert alert-success">{msg}</div>}

        <div className="stats-grid" style={{ gridTemplateColumns: "repeat(4,1fr)", marginBottom: 20 }}>
          {[
            { label: "Total", key: "ALL" },
            { label: "Available", key: "AVAILABLE" },
            { label: "Assigned", key: "ASSIGNED" },
            { label: "In repair", key: "IN_REPAIR" },
          ].map(({ label, key }) => (
            <div className="stat-card" key={key} style={{ cursor: "pointer" }} onClick={() => setStatusFilter(key)}>
              <div className="stat-label">{label}</div>
              <div className="stat-value">
                {key === "ALL" ? assets.length : assets.filter((a) => a.status === key).length}
              </div>
            </div>
          ))}
        </div>

        <div className="card">
          <div className="card-header">
            <div>
              <h2>Asset inventory</h2>
              <p>{filtered.length} records{statusFilter !== "ALL" ? ` · ${statusFilter}` : ""}</p>
            </div>
            {statusFilter !== "ALL" && (
              <button className="btn btn-ghost btn-sm" onClick={() => setStatusFilter("ALL")}>Clear filter</button>
            )}
          </div>
          {loading ? (
            <div className="loading-spinner"><div className="spinner" /> Loading…</div>
          ) : (
            <DataTable
              rows={filtered}
              columns={COLS}
              action={(row) =>
                (row as Asset).status === "AVAILABLE" ? (
                  <button className="btn btn-sm btn-primary" onClick={() => setAssigning(row as Asset)}>
                    Assign
                  </button>
                ) : null
              }
            />
          )}
        </div>
      </div>

      {showAddForm && (
        <div className="modal-backdrop">
          <div className="modal">
            <div className="modal-header">
              <h2>Add asset</h2>
              <button className="btn btn-ghost btn-sm" onClick={() => setShowAddForm(false)}>✕</button>
            </div>
            <form onSubmit={handleAddAsset}>
              <div className="modal-body">
                <div className="form-group">
                  <label>Category *</label>
                  <select name="asset_category_id" required defaultValue="">
                    <option value="" disabled>Select category</option>
                    {categories.map((c) => (
                      <option key={String(c.id)} value={String(c.id)}>{String(c.name)}</option>
                    ))}
                  </select>
                </div>
                <div className="form-row">
                  <div className="form-group">
                    <label>Brand</label>
                    <input name="brand" placeholder="e.g. Lenovo" />
                  </div>
                  <div className="form-group">
                    <label>Model</label>
                    <input name="model" placeholder="e.g. ThinkPad E14" />
                  </div>
                </div>
                <div className="form-row">
                  <div className="form-group">
                    <label>Asset tag</label>
                    <input name="asset_tag" placeholder="Optional tag" />
                  </div>
                  <div className="form-group">
                    <label>Serial number</label>
                    <input name="serial_number" placeholder="Unique serial" />
                  </div>
                </div>
                <div className="form-row">
                  <div className="form-group">
                    <label>Location</label>
                    <select name="location_id" defaultValue="">
                      <option value="">No location</option>
                      {locations.map((l) => (
                        <option key={String(l.id)} value={String(l.id)}>{String(l.name)}</option>
                      ))}
                    </select>
                  </div>
                  <div className="form-group">
                    <label>Condition</label>
                    <select name="condition" defaultValue="GOOD">
                      <option value="GOOD">Good</option>
                      <option value="FAIR">Fair</option>
                      <option value="POOR">Poor</option>
                    </select>
                  </div>
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setShowAddForm(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary" disabled={saving}>
                  {saving ? "Saving…" : "Add asset"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {assigning && (
        <div className="modal-backdrop">
          <div className="modal">
            <div className="modal-header">
              <h2>Assign {assigning.asset_code}</h2>
              <button className="btn btn-ghost btn-sm" onClick={() => setAssigning(null)}>✕</button>
            </div>
            <form onSubmit={handleAssign}>
              <div className="modal-body">
                <div className="form-group">
                  <label>Assign to employee *</label>
                  <select name="employee_id" required defaultValue="">
                    <option value="" disabled>Select employee</option>
                    {employees.map((emp) => (
                      <option key={String(emp.id)} value={String(emp.id)}>
                        {String(emp.display_name)} · {String(emp.employee_code)}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setAssigning(null)}>Cancel</button>
                <button type="submit" className="btn btn-primary" disabled={saving}>
                  {saving ? "Assigning…" : "Confirm assignment"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
