"use client";

export const dynamic = "force-dynamic";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { useProfile } from "@/lib/useProfile";
import PageHeader from "@/components/PageHeader";
import DataTable from "@/components/DataTable";
import SubNav from "@/components/SubNav";

const ASSETS_NAV = [
  { href: "/assets", label: "Asset Inventory", exact: true },
  { href: "/assets/maintenance", label: "Maintenance & Repairs" },
  { href: "/assets/import", label: "Bulk CSV Import" },
];

type Row = Record<string, unknown>;
type MaintenanceRecord = Row & {
  id: string;
  asset_id: string;
  asset_code: string;
  model: string;
  category: string;
  maintenance_type: string;
  vendor: string;
  cost: number | null;
  status: string;
  started_at: string | null;
  completed_at: string | null;
  description: string;
};

const COLS = ["asset_code", "category", "model", "maintenance_type", "vendor", "cost", "status", "started_at", "completed_at"];

const MAINTENANCE_TYPES = [
  "Hardware Repair",
  "Screen / Display Replacement",
  "Battery / Power Issue",
  "Keyboard / Trackpad Fix",
  "OS / Software Reinstall",
  "RAM / SSD Upgrade",
  "Routine Servicing",
  "Warranty Claim",
  "Other",
];

export default function AssetMaintenancePage() {
  const router = useRouter();
  const { companyId, employeeId } = useProfile();
  const [records, setRecords] = useState<MaintenanceRecord[]>([]);
  const [assets, setAssets] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [search, setSearch] = useState("");

  const [showLogModal, setShowLogModal] = useState(false);
  const [completingRecord, setCompletingRecord] = useState<MaintenanceRecord | null>(null);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    if (!companyId) { setLoading(false); return; }
    setLoading(true);
    setError(null);

    const [maintRes, assetsRes] = await Promise.all([
      supabase
        .from("v_asset_maintenance")
        .select("*")
        .eq("company_id", companyId)
        .order("created_at", { ascending: false }),
      supabase
        .from("v_asset_inventory")
        .select("id,asset_code,model,category,serial_number,status")
        .eq("company_id", companyId)
        .order("asset_code"),
    ]);

    if (maintRes.error) setError(maintRes.error.message);
    setRecords((maintRes.data as MaintenanceRecord[]) ?? []);
    setAssets((assetsRes.data as Row[]) ?? []);
    setLoading(false);
  }, [companyId]);

  useEffect(() => { void load(); }, [load]);

  const filtered = records.filter((r) => {
    const matchStatus = statusFilter === "ALL" || r.status === statusFilter;
    const matchSearch =
      !search.trim() ||
      String(r.asset_code ?? "").toLowerCase().includes(search.toLowerCase()) ||
      String(r.model ?? "").toLowerCase().includes(search.toLowerCase()) ||
      String(r.vendor ?? "").toLowerCase().includes(search.toLowerCase()) ||
      String(r.maintenance_type ?? "").toLowerCase().includes(search.toLowerCase());
    return matchStatus && matchSearch;
  });

  const totalCost = records.reduce((acc, r) => acc + (Number(r.cost) || 0), 0);
  const openCount = records.filter((r) => r.status === "OPEN" || r.status === "IN_PROGRESS").length;
  const completedCount = records.filter((r) => r.status === "COMPLETED").length;

  async function handleLogMaintenance(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSaving(true);
    setMsg(null);
    const fd = new FormData(e.currentTarget);
    const assetId = String(fd.get("asset_id") ?? "");
    if (!assetId) {
      setMsg("Please select an asset.");
      setSaving(false);
      return;
    }

    const costVal = fd.get("cost") ? Number(fd.get("cost")) : null;

    const res = await fetch("/api/assets/maintenance", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        asset_id: assetId,
        maintenance_type: fd.get("maintenance_type"),
        vendor: fd.get("vendor") || null,
        started_at: fd.get("started_at") || new Date().toISOString().slice(0, 10),
        cost: costVal,
        description: fd.get("description") || null,
      }),
    });
    const json = await res.json();
    if (json.error) { setMsg(`Error: ${json.error}`); setSaving(false); return; }

    setShowLogModal(false);
    setMsg("Maintenance ticket logged and asset status marked as UNDER_REPAIR.");
    void load();
    setSaving(false);
  }

  async function handleCompleteMaintenance(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!completingRecord) return;
    setSaving(true);
    setMsg(null);
    const fd = new FormData(e.currentTarget);
    const actualCost = fd.get("actual_cost") ? Number(fd.get("actual_cost")) : completingRecord.cost;
    const completedDate = String(fd.get("completed_at") || new Date().toISOString().slice(0, 10));
    const resolutionNote = String(fd.get("resolution_note") || "");
    const condition = String(fd.get("condition") || "GOOD");

    const res = await fetch(`/api/assets/maintenance/${completingRecord.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        cost: actualCost,
        completed_at: completedDate,
        description: resolutionNote || undefined,
        condition: condition as "EXCELLENT" | "GOOD" | "FAIR",
      }),
    });
    const json = await res.json();
    if (json.error) { setMsg(`Error: ${json.error}`); setSaving(false); return; }

    setCompletingRecord(null);
    setMsg("Maintenance ticket completed. Asset returned to inventory as AVAILABLE.");
    void load();
    setSaving(false);
  }

  return (
    <>
      <PageHeader
        title="Asset Maintenance"
        subtitle="Track repairs, servicing, vendor bills and hardware health"
        breadcrumbs={[
          { label: "Dashboard", href: "/dashboard" },
          { label: "Assets", href: "/assets" },
          { label: "Maintenance & Repairs" },
        ]}
        actions={
          <div style={{ display: "flex", gap: 8 }}>
            <button className="btn btn-secondary btn-sm" onClick={() => void load()}>↻ Refresh</button>
            <button className="btn btn-primary btn-sm" onClick={() => setShowLogModal(true)}>+ Log Repair / Service</button>
          </div>
        }
      />

      <SubNav items={ASSETS_NAV} />

      <div className="page-body">
        {error && <div className="alert alert-error">{error}</div>}
        {msg && <div className="alert alert-success">{msg}</div>}

        {/* Stats */}
        <div className="stats-grid" style={{ gridTemplateColumns: "repeat(4,1fr)", marginBottom: 20 }}>
          <div className="stat-card" style={{ cursor: "pointer" }} onClick={() => setStatusFilter("ALL")}>
            <div className="stat-label">Total Tickets</div>
            <div className="stat-value">{records.length}</div>
            <div className="stat-sub">Lifetime servicing logs</div>
          </div>
          <div className="stat-card" style={{ cursor: "pointer" }} onClick={() => setStatusFilter("IN_PROGRESS")}>
            <div className="stat-label">In Repair</div>
            <div className="stat-value" style={{ color: "var(--amber)" }}>{openCount}</div>
            <div className="stat-sub">Currently with vendor</div>
          </div>
          <div className="stat-card" style={{ cursor: "pointer" }} onClick={() => setStatusFilter("COMPLETED")}>
            <div className="stat-label">Repaired / Fixed</div>
            <div className="stat-value" style={{ color: "var(--green)" }}>{completedCount}</div>
            <div className="stat-sub">Back in service</div>
          </div>
          <div className="stat-card">
            <div className="stat-label">Total Repair Cost</div>
            <div className="stat-value" style={{ fontSize: 20 }}>₹{totalCost.toLocaleString("en-IN")}</div>
            <div className="stat-sub">Hardware upkeep expenses</div>
          </div>
        </div>

        {/* Records card */}
        <div className="card">
          <div className="card-header" style={{ flexWrap: "wrap", gap: 10 }}>
            <div>
              <h2>Maintenance History & Repairs</h2>
              <p>{filtered.length} records{statusFilter !== "ALL" ? ` · ${statusFilter}` : ""}</p>
            </div>
            <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
              <input
                placeholder="Search ticket, asset, vendor…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                style={{ width: 220 }}
              />
              <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} style={{ width: "auto" }}>
                <option value="ALL">All Statuses</option>
                <option value="IN_PROGRESS">In Progress</option>
                <option value="OPEN">Open</option>
                <option value="COMPLETED">Completed</option>
              </select>
            </div>
          </div>

          {loading ? (
            <div className="loading-spinner"><div className="spinner" /> Loading…</div>
          ) : (
            <DataTable
              rows={filtered}
              columns={COLS}
              action={(row) => {
                const r = row as MaintenanceRecord;
                if (r.status !== "COMPLETED") {
                  return (
                    <button className="btn btn-sm btn-primary" onClick={() => setCompletingRecord(r)}>
                      Complete Fix
                    </button>
                  );
                }
                return <span className="pill pill-green">Resolved</span>;
              }}
            />
          )}
        </div>
      </div>

      {/* Log Maintenance Modal */}
      {showLogModal && (
        <div className="modal-backdrop">
          <div className="modal" style={{ maxWidth: 540 }}>
            <div className="modal-header">
              <h2>Log Asset Repair / Servicing</h2>
              <button className="btn btn-ghost btn-sm" onClick={() => setShowLogModal(false)}>✕</button>
            </div>
            <form onSubmit={handleLogMaintenance}>
              <div className="modal-body">
                <div className="form-group">
                  <label>Select Asset to Send for Repair *</label>
                  <select name="asset_id" required defaultValue="">
                    <option value="" disabled>Choose asset</option>
                    {assets.map((a) => (
                      <option key={String(a.id)} value={String(a.id)}>
                        {String(a.asset_code)} — {String(a.model)} ({String(a.category)} · {String(a.status)})
                      </option>
                    ))}
                  </select>
                </div>

                <div className="form-row">
                  <div className="form-group">
                    <label>Maintenance Type *</label>
                    <select name="maintenance_type" required defaultValue={MAINTENANCE_TYPES[0]}>
                      {MAINTENANCE_TYPES.map((t) => (
                        <option key={t} value={t}>{t}</option>
                      ))}
                    </select>
                  </div>
                  <div className="form-group">
                    <label>Repair Vendor / Service Center</label>
                    <input name="vendor" placeholder="e.g. Lenovo Service Center / Local IT" />
                  </div>
                </div>

                <div className="form-row">
                  <div className="form-group">
                    <label>Estimated / Approved Cost (₹)</label>
                    <input name="cost" type="number" min={0} placeholder="e.g. 3500" />
                  </div>
                  <div className="form-group">
                    <label>Start Date</label>
                    <input name="started_at" type="date" defaultValue={new Date().toISOString().slice(0, 10)} />
                  </div>
                </div>

                <div className="form-group">
                  <label>Issue Description & Symptoms *</label>
                  <textarea
                    name="description"
                    rows={3}
                    required
                    placeholder="Describe issue (e.g. Screen flickering, battery swelling, keyboard water spill)..."
                  />
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setShowLogModal(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary" disabled={saving}>
                  {saving ? "Saving…" : "Create Repair Ticket"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Complete Maintenance Modal */}
      {completingRecord && (
        <div className="modal-backdrop">
          <div className="modal" style={{ maxWidth: 500 }}>
            <div className="modal-header">
              <h2>Complete Maintenance for {completingRecord.asset_code}</h2>
              <button className="btn btn-ghost btn-sm" onClick={() => setCompletingRecord(null)}>✕</button>
            </div>
            <form onSubmit={handleCompleteMaintenance}>
              <div className="modal-body">
                <div style={{ background: "var(--bg)", padding: 12, borderRadius: 8, marginBottom: 16, fontSize: 13 }}>
                  <div><strong>Issue:</strong> {completingRecord.description || "—"}</div>
                  <div style={{ marginTop: 4 }}><strong>Vendor:</strong> {completingRecord.vendor || "—"}</div>
                </div>

                <div className="form-row">
                  <div className="form-group">
                    <label>Actual Invoiced Cost (₹) *</label>
                    <input
                      name="actual_cost"
                      type="number"
                      min={0}
                      required
                      defaultValue={completingRecord.cost ?? 0}
                    />
                  </div>
                  <div className="form-group">
                    <label>Completion Date *</label>
                    <input
                      name="completed_at"
                      type="date"
                      required
                      defaultValue={new Date().toISOString().slice(0, 10)}
                    />
                  </div>
                </div>

                <div className="form-group">
                  <label>Post-Repair Asset Condition</label>
                  <select name="condition" defaultValue="GOOD">
                    <option value="EXCELLENT">Excellent / Like New</option>
                    <option value="GOOD">Good</option>
                    <option value="FAIR">Fair</option>
                  </select>
                </div>

                <div className="form-group">
                  <label>Resolution Remarks</label>
                  <textarea
                    name="resolution_note"
                    rows={2}
                    placeholder="e.g. Display panel replaced under warranty, testing complete."
                  />
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setCompletingRecord(null)}>Cancel</button>
                <button type="submit" className="btn btn-primary" disabled={saving}>
                  {saving ? "Confirming…" : "Mark Fixed & Return to Stock"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
