"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { useProfile } from "@/lib/useProfile";
import PageHeader from "@/components/PageHeader";
import DataTable from "@/components/DataTable";

type Row = Record<string, unknown>;
type Asset = Row & {
  id: string;
  asset_code: string;
  category: string;
  brand: string;
  model: string;
  serial_number: string;
  imei_1: string;
  mobile_number: string;
  status: string;
  condition: string;
  assigned_to: string | null;
  current_employee_id: string | null;
  location: string | null;
  warranty_end: string | null;
  purchase_cost: number | null;
};

const COLS = [
  "asset_code",
  "category",
  "brand",
  "model",
  "serial_number",
  "assigned_to",
  "location",
  "condition",
  "status",
  "warranty_end",
];

export default function AssetsPage() {
  const router = useRouter();
  const { companyId, employeeId } = useProfile();
  const [assets, setAssets] = useState<Asset[]>([]);
  const [employees, setEmployees] = useState<Row[]>([]);
  const [categories, setCategories] = useState<Row[]>([]);
  const [locations, setLocations] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");

  // Modals
  const [showAddForm, setShowAddForm] = useState(false);
  const [assigning, setAssigning] = useState<Asset | null>(null);
  const [returning, setReturning] = useState<Asset | null>(null);
  const [repairing, setRepairing] = useState<Asset | null>(null);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    if (!companyId) { setLoading(false); return; }
    setLoading(true);
    setError(null);
    const [assetsRes, empRes, catRes, locRes] = await Promise.all([
      supabase.from("v_asset_inventory").select("*").eq("company_id", companyId).order("asset_code"),
      supabase
        .from("v_employee_directory")
        .select("id,display_name,employee_code,department")
        .eq("company_id", companyId)
        .eq("employment_status", "ACTIVE")
        .order("display_name")
        .limit(300),
      supabase.from("asset_categories").select("id,name,prefix").eq("company_id", companyId).eq("is_active", true).order("name"),
      supabase.from("locations").select("id,name").eq("company_id", companyId).eq("is_active", true).order("name"),
    ]);

    if (assetsRes.error) setError(assetsRes.error.message);
    setAssets((assetsRes.data as Asset[]) ?? []);
    setEmployees((empRes.data as Row[]) ?? []);
    setCategories((catRes.data as Row[]) ?? []);
    setLocations((locRes.data as Row[]) ?? []);
    setLoading(false);
  }, [companyId]);

  useEffect(() => { void load(); }, [load]);

  const filtered = assets.filter((a) => {
    const matchStatus = statusFilter === "ALL" || a.status === statusFilter;
    const matchSearch =
      !search.trim() ||
      String(a.asset_code ?? "").toLowerCase().includes(search.toLowerCase()) ||
      String(a.model ?? "").toLowerCase().includes(search.toLowerCase()) ||
      String(a.serial_number ?? "").toLowerCase().includes(search.toLowerCase()) ||
      String(a.assigned_to ?? "").toLowerCase().includes(search.toLowerCase()) ||
      String(a.category ?? "").toLowerCase().includes(search.toLowerCase()) ||
      String(a.mobile_number ?? "").toLowerCase().includes(search.toLowerCase());
    return matchStatus && matchSearch;
  });

  // Add Asset
  async function handleAddAsset(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSaving(true);
    setMsg(null);
    const fd = new FormData(e.currentTarget);
    const category = categories.find((c) => c.id === fd.get("asset_category_id"));
    if (!category) { setMsg("Select a category."); setSaving(false); return; }

    const cost = fd.get("purchase_cost") ? Number(fd.get("purchase_cost")) : null;
    const prefix = String(category.prefix ?? "AST").toUpperCase();

    // Generate sequential asset code via DB function
    const { data: codeData, error: codeErr } = await supabase
      .rpc("generate_asset_code", { p_prefix: prefix });
    if (codeErr || !codeData) { setMsg("Failed to generate asset code."); setSaving(false); return; }
    const assetCode = String(codeData);

    const { error } = await supabase.from("assets").insert({
      company_id: companyId,
      asset_category_id: category.id,
      location_id: fd.get("location_id") || null,
      asset_code: assetCode,
      asset_tag: fd.get("asset_tag") || null,
      model: fd.get("model") || null,
      serial_number: fd.get("serial_number") || null,
      imei_1: fd.get("imei_1") || null,
      mobile_number: fd.get("mobile_number") || null,
      sim_number: fd.get("sim_number") || null,
      condition: fd.get("condition") || "GOOD",
      vendor_name: fd.get("vendor_name") || null,
      invoice_number: fd.get("invoice_number") || null,
      purchase_date: fd.get("purchase_date") || null,
      purchase_cost: cost,
      warranty_end: fd.get("warranty_end") || null,
      notes: fd.get("notes") || null,
      status: "AVAILABLE",
    });

    if (error) { setMsg(`Error: ${error.message}`); setSaving(false); return; }
    setShowAddForm(false);
    setMsg(`Asset ${assetCode} added to inventory successfully.`);
    void load();
    setSaving(false);
  }

  // Assign Asset with Handover details
  async function handleAssign(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!assigning) return;
    setSaving(true);
    setMsg(null);
    const fd = new FormData(e.currentTarget);
    const targetEmployeeId = String(fd.get("employee_id") ?? "");
    if (!targetEmployeeId) { setMsg("Select an employee."); setSaving(false); return; }

    const expectedReturn = fd.get("expected_return_date") ? String(fd.get("expected_return_date")) : null;
    const handoverCondition = String(fd.get("condition_at_handover") || "GOOD");
    const remarks = String(fd.get("remarks") || "");

    // 1. Insert active assignment
    const { data: asgn, error: assignErr } = await supabase
      .from("asset_assignments")
      .insert({
        asset_id: assigning.id,
        employee_id: targetEmployeeId,
        assigned_by: employeeId,
        expected_return_date: expectedReturn,
        status: "ACTIVE",
        remarks: remarks || null,
      })
      .select("id")
      .single();

    if (assignErr) { setMsg(`Error: ${assignErr.message}`); setSaving(false); return; }

    // 2. Insert handover record
    if (asgn?.id) {
      await supabase.from("asset_handover").insert({
        asset_assignment_id: asgn.id,
        handover_date: new Date().toISOString().slice(0, 10),
        employee_acknowledged: true,
        condition_at_handover: handoverCondition,
        remarks: remarks || null,
      });
    }

    // 3. Update asset state
    const { error: updateErr } = await supabase
      .from("assets")
      .update({
        current_employee_id: targetEmployeeId,
        status: "ASSIGNED",
        condition: handoverCondition,
      })
      .eq("id", assigning.id);

    if (updateErr) {
      setMsg(`Assigned but status update failed: ${updateErr.message}`);
    } else {
      setMsg(`Asset ${assigning.asset_code} assigned to employee successfully.`);
    }

    setAssigning(null);
    void load();
    setSaving(false);
  }

  // Return Asset with Inspection details
  async function handleReturn(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!returning) return;
    setSaving(true);
    setMsg(null);
    const fd = new FormData(e.currentTarget);

    // Find active assignment
    const { data: asgn } = await supabase
      .from("asset_assignments")
      .select("id")
      .eq("asset_id", returning.id)
      .eq("status", "ACTIVE")
      .single();

    if (!asgn) { setMsg("No active assignment found."); setSaving(false); return; }

    const condition = String(fd.get("condition") || "GOOD");
    const damageDesc = fd.get("damage_description") ? String(fd.get("damage_description")) : null;
    const missingItems = fd.get("missing_items") ? String(fd.get("missing_items")) : null;
    const recoveryAmount = fd.get("recovery_amount") ? Number(fd.get("recovery_amount")) : null;
    const remarks = fd.get("remarks") ? String(fd.get("remarks")) : null;

    // 1. Create return record
    await supabase.from("asset_returns").insert({
      asset_assignment_id: asgn.id,
      return_date: new Date().toISOString().slice(0, 10),
      received_by: employeeId,
      condition_at_return: condition,
      damage_description: damageDesc,
      missing_items: missingItems,
      recovery_amount: recoveryAmount,
      remarks: remarks,
    });

    // 2. Mark assignment returned
    await supabase.from("asset_assignments").update({
      status: "RETURNED",
      returned_at: new Date().toISOString(),
    }).eq("id", asgn.id);

    // 3. Update asset status
    const newStatus = condition === "DAMAGED" ? "DAMAGED" : "AVAILABLE";
    await supabase.from("assets").update({
      status: newStatus,
      condition: condition,
      current_employee_id: null,
    }).eq("id", returning.id);

    setMsg(`Asset ${returning.asset_code} returned. Status: ${newStatus}.`);
    setReturning(null);
    void load();
    setSaving(false);
  }

  // Send to repair
  async function handleSendToRepair(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!repairing) return;
    setSaving(true);
    setMsg(null);
    const fd = new FormData(e.currentTarget);

    const { error: maintErr } = await supabase.from("asset_maintenance").insert({
      asset_id: repairing.id,
      maintenance_type: fd.get("maintenance_type") || "Hardware Repair",
      vendor: fd.get("vendor") || null,
      started_at: new Date().toISOString().slice(0, 10),
      cost: fd.get("cost") ? Number(fd.get("cost")) : null,
      description: fd.get("description") || "Sent for repair",
      status: "IN_PROGRESS",
      created_by: employeeId,
    });

    if (maintErr) { setMsg(`Error: ${maintErr.message}`); setSaving(false); return; }

    await supabase.from("assets").update({ status: "UNDER_REPAIR" }).eq("id", repairing.id);

    setMsg(`Asset ${repairing.asset_code} sent for repair.`);
    setRepairing(null);
    void load();
    setSaving(false);
  }

  const counts = assets.reduce<Record<string, number>>((acc, a) => {
    acc[a.status] = (acc[a.status] ?? 0) + 1;
    return acc;
  }, {});

  return (
    <>
      <PageHeader
        title="Assets"
        subtitle={`${assets.length} items registered across company`}
        actions={
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <button className="btn btn-secondary btn-sm" onClick={() => router.push("/assets/import")}>
              ⬆ Bulk CSV Import
            </button>
            <button className="btn btn-secondary btn-sm" onClick={() => router.push("/assets/maintenance")}>
              🛠 Maintenance & Repairs
            </button>
            <button className="btn btn-ghost btn-sm" onClick={() => void load()}>↻</button>
            <button className="btn btn-primary btn-sm" onClick={() => setShowAddForm(true)}>+ Add Asset</button>
          </div>
        }
      />

      <div className="page-body">
        {error && <div className="alert alert-error">{error}</div>}
        {msg && <div className={`alert ${msg.startsWith("Error") ? "alert-error" : "alert-success"}`}>{msg}</div>}

        {/* Stats Grid */}
        <div className="stats-grid" style={{ gridTemplateColumns: "repeat(5,1fr)", marginBottom: 20 }}>
          {[
            { label: "Total Assets", key: "ALL", count: assets.length },
            { label: "Available (In Stock)", key: "AVAILABLE", count: counts["AVAILABLE"] ?? 0 },
            { label: "Assigned (In Use)", key: "ASSIGNED", count: counts["ASSIGNED"] ?? 0 },
            { label: "Under Repair", key: "UNDER_REPAIR", count: counts["UNDER_REPAIR"] ?? 0 },
            { label: "Damaged / Lost", key: "DAMAGED", count: (counts["DAMAGED"] ?? 0) + (counts["LOST"] ?? 0) },
          ].map(({ label, key, count }) => (
            <div
              className={`stat-card${statusFilter === key ? " active-stat" : ""}`}
              key={key}
              style={{ cursor: "pointer", borderColor: statusFilter === key ? "var(--brand)" : undefined }}
              onClick={() => setStatusFilter(key)}
            >
              <div className="stat-label">{label}</div>
              <div className="stat-value">{count}</div>
            </div>
          ))}
        </div>

        {/* Inventory Card */}
        <div className="card">
          <div className="card-header" style={{ flexWrap: "wrap", gap: 10 }}>
            <div>
              <h2>Asset Inventory & Allocations</h2>
              <p>{filtered.length} records{statusFilter !== "ALL" ? ` · Filter: ${statusFilter}` : ""}</p>
            </div>
            <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
              <input
                placeholder="Search asset, serial, employee…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                style={{ width: 240 }}
              />
              {statusFilter !== "ALL" && (
                <button className="btn btn-ghost btn-sm" onClick={() => setStatusFilter("ALL")}>Clear filter</button>
              )}
            </div>
          </div>

          {loading ? (
            <div className="loading-spinner"><div className="spinner" /> Loading…</div>
          ) : (
            <DataTable
              rows={filtered}
              columns={COLS}
              action={(row) => {
                const a = row as Asset;
                return (
                  <div style={{ display: "flex", gap: 6, flexWrap: "nowrap" }}>
                    {a.status === "AVAILABLE" && (
                      <>
                        <button className="btn btn-sm btn-primary" onClick={() => setAssigning(a)}>Assign</button>
                        <button className="btn btn-sm btn-secondary" onClick={() => setRepairing(a)}>Repair</button>
                      </>
                    )}
                    {a.status === "ASSIGNED" && (
                      <button className="btn btn-sm btn-secondary" onClick={() => setReturning(a)}>Return</button>
                    )}
                    {a.status === "UNDER_REPAIR" && (
                      <button className="btn btn-sm btn-secondary" onClick={() => router.push("/assets/maintenance")}>
                        View Fix
                      </button>
                    )}
                  </div>
                );
              }}
            />
          )}
        </div>
      </div>

      {/* Add Asset Modal */}
      {showAddForm && (
        <div className="modal-backdrop">
          <div className="modal" style={{ maxWidth: 560 }}>
            <div className="modal-header">
              <h2>Add New Asset to Inventory</h2>
              <button className="btn btn-ghost btn-sm" onClick={() => setShowAddForm(false)}>✕</button>
            </div>
            <form onSubmit={handleAddAsset}>
              <div className="modal-body">
                <div className="form-row">
                  <div className="form-group">
                    <label>Category *</label>
                    <select name="asset_category_id" required defaultValue="">
                      <option value="" disabled>Select category</option>
                      {categories.map((c) => (
                        <option key={String(c.id)} value={String(c.id)}>{String(c.name)}</option>
                      ))}
                    </select>
                  </div>
                  <div className="form-group">
                    <label>Model *</label>
                    <input name="model" required placeholder="e.g. ThinkPad E14 Gen 4" />
                  </div>
                </div>

                <div className="form-row">
                  <div className="form-group">
                    <label>Serial Number</label>
                    <input name="serial_number" placeholder="Unique hardware serial" />
                  </div>
                  <div className="form-group">
                    <label>Asset Tag / Barcode</label>
                    <input name="asset_tag" placeholder="e.g. ACG-LAP-009" />
                  </div>
                </div>

                <div className="form-row">
                  <div className="form-group">
                    <label>IMEI 1 (Mobile)</label>
                    <input name="imei_1" placeholder="15-digit IMEI" />
                  </div>
                  <div className="form-group">
                    <label>Mobile / SIM Number</label>
                    <input name="mobile_number" placeholder="+91 XXXXX XXXXX" />
                  </div>
                </div>

                <div className="form-row">
                  <div className="form-group">
                    <label>Purchase Date</label>
                    <input name="purchase_date" type="date" />
                  </div>
                  <div className="form-group">
                    <label>Purchase Cost (₹)</label>
                    <input name="purchase_cost" type="number" min={0} placeholder="e.g. 58000" />
                  </div>
                </div>

                <div className="form-row">
                  <div className="form-group">
                    <label>Warranty End Date</label>
                    <input name="warranty_end" type="date" />
                  </div>
                  <div className="form-group">
                    <label>Vendor / Supplier</label>
                    <input name="vendor_name" placeholder="Vendor name" />
                  </div>
                </div>

                <div className="form-row">
                  <div className="form-group">
                    <label>Location</label>
                    <select name="location_id" defaultValue="">
                      <option value="">No specific location</option>
                      {locations.map((l) => (
                        <option key={String(l.id)} value={String(l.id)}>{String(l.name)}</option>
                      ))}
                    </select>
                  </div>
                  <div className="form-group">
                    <label>Initial Condition</label>
                    <select name="condition" defaultValue="GOOD">
                      <option value="NEW">Brand New</option>
                      <option value="EXCELLENT">Excellent</option>
                      <option value="GOOD">Good</option>
                      <option value="FAIR">Fair</option>
                    </select>
                  </div>
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setShowAddForm(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary" disabled={saving}>
                  {saving ? "Saving…" : "Add Asset"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Assign Modal with Handover Details */}
      {assigning && (
        <div className="modal-backdrop">
          <div className="modal" style={{ maxWidth: 500 }}>
            <div className="modal-header">
              <h2>Assign Asset {assigning.asset_code}</h2>
              <button className="btn btn-ghost btn-sm" onClick={() => setAssigning(null)}>✕</button>
            </div>
            <form onSubmit={handleAssign}>
              <div className="modal-body">
                <div style={{ background: "var(--bg)", padding: 12, borderRadius: 8, marginBottom: 16, fontSize: 13 }}>
                  <div><strong>Item:</strong> {assigning.model} ({assigning.category})</div>
                  {assigning.serial_number && <div><strong>Serial:</strong> {assigning.serial_number}</div>}
                </div>

                <div className="form-group">
                  <label>Assign to Employee *</label>
                  <select name="employee_id" required defaultValue="">
                    <option value="" disabled>Select staff member</option>
                    {employees.map((emp) => (
                      <option key={String(emp.id)} value={String(emp.id)}>
                        {String(emp.display_name)} · {String(emp.employee_code)} ({String(emp.department ?? "General")})
                      </option>
                    ))}
                  </select>
                </div>

                <div className="form-row">
                  <div className="form-group">
                    <label>Handover Condition</label>
                    <select name="condition_at_handover" defaultValue="GOOD">
                      <option value="NEW">Brand New</option>
                      <option value="EXCELLENT">Excellent</option>
                      <option value="GOOD">Good</option>
                    </select>
                  </div>
                  <div className="form-group">
                    <label>Expected Return Date</label>
                    <input name="expected_return_date" type="date" />
                  </div>
                </div>

                <div className="form-group">
                  <label>Accessories & Remarks</label>
                  <textarea
                    name="remarks"
                    rows={2}
                    placeholder="e.g. Original 65W charger, laptop bag and wireless mouse provided."
                  />
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setAssigning(null)}>Cancel</button>
                <button type="submit" className="btn btn-primary" disabled={saving}>
                  {saving ? "Assigning…" : "Confirm Handover"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Return Modal with Inspection & Damage Checks */}
      {returning && (
        <div className="modal-backdrop">
          <div className="modal" style={{ maxWidth: 520 }}>
            <div className="modal-header">
              <h2>Return & Inspect {returning.asset_code}</h2>
              <button className="btn btn-ghost btn-sm" onClick={() => setReturning(null)}>✕</button>
            </div>
            <form onSubmit={handleReturn}>
              <div className="modal-body">
                <div style={{ background: "var(--bg)", padding: 12, borderRadius: 8, marginBottom: 16, fontSize: 13 }}>
                  <div><strong>Item:</strong> {returning.model}</div>
                  <div><strong>Assigned to:</strong> {returning.assigned_to ?? "—"}</div>
                </div>

                <div className="form-group">
                  <label>Condition at Return *</label>
                  <select name="condition" defaultValue="GOOD">
                    <option value="GOOD">Good — Normal wear & tear</option>
                    <option value="FAIR">Fair — Minor scratches</option>
                    <option value="POOR">Poor — Heavy usage</option>
                    <option value="DAMAGED">Damaged — Requires repair/replacement</option>
                  </select>
                </div>

                <div className="form-row">
                  <div className="form-group">
                    <label>Missing Items / Accessories</label>
                    <input name="missing_items" placeholder="e.g. Charger cable missing" />
                  </div>
                  <div className="form-group">
                    <label>Damage Deduction / Recovery (₹)</label>
                    <input name="recovery_amount" type="number" min={0} placeholder="e.g. 1500" />
                  </div>
                </div>

                <div className="form-group">
                  <label>Damage Details & Inspection Notes</label>
                  <textarea
                    name="damage_description"
                    rows={2}
                    placeholder="Describe any physical/functional defects..."
                  />
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setReturning(null)}>Cancel</button>
                <button type="submit" className="btn btn-primary" disabled={saving}>
                  {saving ? "Processing…" : "Confirm Return to Stock"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Quick Repair Modal */}
      {repairing && (
        <div className="modal-backdrop">
          <div className="modal" style={{ maxWidth: 480 }}>
            <div className="modal-header">
              <h2>Send {repairing.asset_code} to Repair</h2>
              <button className="btn btn-ghost btn-sm" onClick={() => setRepairing(null)}>✕</button>
            </div>
            <form onSubmit={handleSendToRepair}>
              <div className="modal-body">
                <div className="form-group">
                  <label>Maintenance Type *</label>
                  <input name="maintenance_type" required defaultValue="Hardware Repair" />
                </div>
                <div className="form-row">
                  <div className="form-group">
                    <label>Vendor</label>
                    <input name="vendor" placeholder="Vendor / service center" />
                  </div>
                  <div className="form-group">
                    <label>Est. Cost (₹)</label>
                    <input name="cost" type="number" min={0} placeholder="e.g. 2000" />
                  </div>
                </div>
                <div className="form-group">
                  <label>Issue Description *</label>
                  <textarea name="description" rows={2} required placeholder="State problem..." />
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setRepairing(null)}>Cancel</button>
                <button type="submit" className="btn btn-primary" disabled={saving}>
                  {saving ? "Sending…" : "Send to Repair"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
