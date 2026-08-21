"use client";

import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useProfile } from "@/lib/useProfile";
import PageHeader from "@/components/PageHeader";
import DataTable from "@/components/DataTable";

type Row = Record<string, unknown>;
type Tab = "departments" | "designations" | "locations" | "shifts" | "leave_types" | "holidays";

export default function OrganisationPage() {
  const { companyId } = useProfile();
  const [tab, setTab] = useState<Tab>("departments");
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editing, setEditing] = useState<Row | null>(null);

  const load = useCallback(async () => {
    if (!companyId) return;
    setLoading(true);
    setMsg(null);

    let q;
    if (tab === "departments") q = supabase.from("departments").select("id,department_code,name,is_active").eq("company_id", companyId).order("name");
    else if (tab === "designations") q = supabase.from("designations").select("id,designation_code,name,level,is_active").eq("company_id", companyId).order("level");
    else if (tab === "locations") q = supabase.from("locations").select("id,location_code,name,city,state,attendance_radius_meters,is_active").eq("company_id", companyId).order("name");
    else if (tab === "shifts") q = supabase.from("shifts").select("id,shift_code,name,start_time,end_time,grace_minutes,is_active").eq("company_id", companyId).order("name");
    else if (tab === "leave_types") q = supabase.from("leave_types").select("id,code,name,is_paid,allows_half_day,requires_document,is_active").eq("company_id", companyId).order("name");
    else q = supabase.from("holidays").select("id,name,holiday_date,is_optional,description").eq("company_id", companyId).order("holiday_date");

    const { data, error } = await q;
    if (error) setMsg(error.message);
    setRows((data as Row[]) ?? []);
    setLoading(false);
  }, [companyId, tab]);

  useEffect(() => { void load(); }, [load]);

  async function handleSave(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!companyId) return;
    setSaving(true);
    setMsg(null);
    const fd = new FormData(e.currentTarget);

    let payload: Record<string, unknown> = { company_id: companyId };
    let table = "";

    if (tab === "departments") {
      table = "departments";
      payload = { ...payload, department_code: fd.get("code"), name: fd.get("name"), is_active: true };
    } else if (tab === "designations") {
      table = "designations";
      payload = { ...payload, designation_code: fd.get("code"), name: fd.get("name"), level: Number(fd.get("level")) || null, is_active: true };
    } else if (tab === "locations") {
      table = "locations";
      payload = {
        ...payload,
        location_code: fd.get("code"), name: fd.get("name"),
        city: fd.get("city") || null, state: fd.get("state") || null,
        latitude: fd.get("latitude") ? Number(fd.get("latitude")) : null,
        longitude: fd.get("longitude") ? Number(fd.get("longitude")) : null,
        attendance_radius_meters: Number(fd.get("radius")) || 150,
        is_active: true,
      };
    } else if (tab === "shifts") {
      table = "shifts";
      payload = {
        ...payload,
        shift_code: fd.get("code"), name: fd.get("name"),
        start_time: fd.get("start_time"), end_time: fd.get("end_time"),
        grace_minutes: Number(fd.get("grace_minutes")) || 15,
        is_active: true,
      };
    } else if (tab === "leave_types") {
      table = "leave_types";
      payload = {
        ...payload,
        code: fd.get("code"), name: fd.get("name"),
        is_paid: fd.get("is_paid") === "true",
        allows_half_day: fd.get("allows_half_day") === "true",
        requires_document: fd.get("requires_document") === "true",
        is_active: true,
      };
    } else {
      table = "holidays";
      payload = {
        ...payload,
        name: fd.get("name"),
        holiday_date: fd.get("holiday_date"),
        is_optional: fd.get("is_optional") === "true",
        description: fd.get("description") || null,
      };
    }

    let error;
    if (editing) {
      ({ error } = await supabase.from(table).update(payload).eq("id", String(editing.id)));
    } else {
      ({ error } = await supabase.from(table).insert(payload));
    }

    if (error) { setMsg(`Error: ${error.message}`); setSaving(false); return; }
    setMsg(editing ? "Updated successfully." : "Created successfully.");
    setShowForm(false);
    setEditing(null);
    void load();
    setSaving(false);
  }

  async function toggleActive(row: Row) {
    if (tab === "holidays") {
      await supabase.from("holidays").delete().eq("id", String(row.id));
      void load();
      return;
    }
    const table = tab === "departments" ? "departments"
      : tab === "designations" ? "designations"
      : tab === "locations" ? "locations"
      : tab === "shifts" ? "shifts"
      : "leave_types";
    await supabase.from(table).update({ is_active: !row.is_active }).eq("id", String(row.id));
    void load();
  }

  const TABS: { key: Tab; label: string }[] = [
    { key: "departments",  label: "Departments" },
    { key: "designations", label: "Designations" },
    { key: "locations",    label: "Locations" },
    { key: "shifts",       label: "Shifts" },
    { key: "leave_types",  label: "Leave Types" },
    { key: "holidays",     label: "Holidays" },
  ];

  const cols: Record<Tab, string[]> = {
    departments:  ["department_code", "name", "is_active"],
    designations: ["designation_code", "name", "level", "is_active"],
    locations:    ["location_code", "name", "city", "state", "attendance_radius_meters", "is_active"],
    shifts:       ["shift_code", "name", "start_time", "end_time", "grace_minutes", "is_active"],
    leave_types:  ["code", "name", "is_paid", "allows_half_day", "is_active"],
    holidays:     ["name", "holiday_date", "is_optional", "description"],
  };

  return (
    <>
      <PageHeader
        title="Organisation"
        subtitle="Departments, designations, locations, shifts, leave types and holidays"
        actions={
          <button className="btn btn-primary btn-sm" onClick={() => { setEditing(null); setShowForm(true); }}>
            + Add {tab.replace("_", " ").replace(/s$/, "")}
          </button>
        }
      />

      <div className="page-body">
        {msg && <div className={`alert ${msg.startsWith("Error") ? "alert-error" : "alert-success"}`}>{msg}</div>}

        <div style={{ display: "flex", gap: 8, marginBottom: 20, flexWrap: "wrap" }}>
          {TABS.map(({ key, label }) => (
            <button key={key} className={`btn btn-sm ${tab === key ? "btn-primary" : "btn-secondary"}`} onClick={() => setTab(key)}>
              {label}
            </button>
          ))}
        </div>

        <div className="card">
          <div className="card-header">
            <div><h2>{TABS.find(t => t.key === tab)?.label}</h2><p>{rows.length} records</p></div>
            <button className="btn btn-ghost btn-sm" onClick={() => void load()}>↻</button>
          </div>
          {loading ? (
            <div className="loading-spinner"><div className="spinner" /> Loading…</div>
          ) : (
            <DataTable
              rows={rows}
              columns={cols[tab]}
              action={(row) => (
                <div style={{ display: "flex", gap: 6 }}>
                  <button className="btn btn-sm btn-secondary" onClick={() => { setEditing(row); setShowForm(true); }}>Edit</button>
                  {tab === "holidays" ? (
                    <button className="btn btn-sm btn-danger" onClick={() => toggleActive(row)}>Delete</button>
                  ) : (
                    <button className={`btn btn-sm ${row.is_active ? "btn-danger" : "btn-secondary"}`} onClick={() => toggleActive(row)}>
                      {row.is_active ? "Deactivate" : "Activate"}
                    </button>
                  )}
                </div>
              )}
            />
          )}
        </div>
      </div>

      {showForm && (
        <div className="modal-backdrop">
          <div className="modal" style={{ maxWidth: 520 }}>
            <div className="modal-header">
              <h2>{editing ? "Edit" : "Add"} {tab.replace("_", " ").replace(/s$/, "")}</h2>
              <button className="btn btn-ghost btn-sm" onClick={() => { setShowForm(false); setEditing(null); }}>✕</button>
            </div>
            <form onSubmit={handleSave}>
              <div className="modal-body">
                <FormFields tab={tab} editing={editing} />
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => { setShowForm(false); setEditing(null); }}>Cancel</button>
                <button type="submit" className="btn btn-primary" disabled={saving}>{saving ? "Saving…" : "Save"}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}

function FormFields({ tab, editing }: { tab: Tab; editing: Row | null }) {
  const v = (k: string) => String(editing?.[k] ?? "");

  if (tab === "departments") return (
    <div className="form-row">
      <div className="form-group"><label>Code *</label><input name="code" required defaultValue={v("department_code")} placeholder="e.g. CREDIT" /></div>
      <div className="form-group"><label>Name *</label><input name="name" required defaultValue={v("name")} placeholder="e.g. Credit" /></div>
    </div>
  );

  if (tab === "designations") return (
    <>
      <div className="form-row">
        <div className="form-group"><label>Code *</label><input name="code" required defaultValue={v("designation_code")} placeholder="e.g. CREDIT_MGR" /></div>
        <div className="form-group"><label>Name *</label><input name="name" required defaultValue={v("name")} placeholder="e.g. Credit Manager" /></div>
      </div>
      <div className="form-group"><label>Level (1=junior, 10=top)</label><input name="level" type="number" min={1} max={10} defaultValue={v("level")} /></div>
    </>
  );

  if (tab === "locations") return (
    <>
      <div className="form-row">
        <div className="form-group"><label>Code *</label><input name="code" required defaultValue={v("location_code")} placeholder="e.g. DEL-HO" /></div>
        <div className="form-group"><label>Name *</label><input name="name" required defaultValue={v("name")} placeholder="e.g. Delhi Head Office" /></div>
      </div>
      <div className="form-row">
        <div className="form-group"><label>City</label><input name="city" defaultValue={v("city")} /></div>
        <div className="form-group"><label>State</label><input name="state" defaultValue={v("state")} /></div>
      </div>
      <div className="form-row">
        <div className="form-group"><label>Latitude</label><input name="latitude" type="number" step="any" defaultValue={v("latitude")} /></div>
        <div className="form-group"><label>Longitude</label><input name="longitude" type="number" step="any" defaultValue={v("longitude")} /></div>
      </div>
      <div className="form-group"><label>Geo-fence radius (metres)</label><input name="radius" type="number" defaultValue={v("attendance_radius_meters") || "150"} /></div>
    </>
  );

  if (tab === "shifts") return (
    <>
      <div className="form-row">
        <div className="form-group"><label>Code *</label><input name="code" required defaultValue={v("shift_code")} placeholder="e.g. GENERAL" /></div>
        <div className="form-group"><label>Name *</label><input name="name" required defaultValue={v("name")} placeholder="e.g. General Shift" /></div>
      </div>
      <div className="form-row">
        <div className="form-group"><label>Start time *</label><input name="start_time" type="time" required defaultValue={v("start_time") || "09:30"} /></div>
        <div className="form-group"><label>End time *</label><input name="end_time" type="time" required defaultValue={v("end_time") || "18:30"} /></div>
      </div>
      <div className="form-group"><label>Grace period (minutes)</label><input name="grace_minutes" type="number" defaultValue={v("grace_minutes") || "15"} /></div>
    </>
  );

  if (tab === "leave_types") return (
    <>
      <div className="form-row">
        <div className="form-group"><label>Code *</label><input name="code" required defaultValue={v("code")} placeholder="e.g. CL" /></div>
        <div className="form-group"><label>Name *</label><input name="name" required defaultValue={v("name")} placeholder="e.g. Casual Leave" /></div>
      </div>
      <div className="form-row">
        <div className="form-group">
          <label>Paid leave?</label>
          <select name="is_paid" defaultValue={v("is_paid") || "true"}>
            <option value="true">Yes</option><option value="false">No</option>
          </select>
        </div>
        <div className="form-group">
          <label>Allow half-day?</label>
          <select name="allows_half_day" defaultValue={v("allows_half_day") || "true"}>
            <option value="true">Yes</option><option value="false">No</option>
          </select>
        </div>
      </div>
      <div className="form-group">
        <label>Requires document?</label>
        <select name="requires_document" defaultValue={v("requires_document") || "false"}>
          <option value="false">No</option><option value="true">Yes</option>
        </select>
      </div>
    </>
  );

  // holidays
  return (
    <>
      <div className="form-row">
        <div className="form-group">
          <label>Holiday Name *</label>
          <input name="name" required defaultValue={v("name")} placeholder="e.g. Independence Day" />
        </div>
        <div className="form-group">
          <label>Holiday Date *</label>
          <input name="holiday_date" type="date" required defaultValue={v("holiday_date")} />
        </div>
      </div>
      <div className="form-group">
        <label>Optional / Restricted Holiday?</label>
        <select name="is_optional" defaultValue={v("is_optional") || "false"}>
          <option value="false">No (Gazetted / Mandatory)</option>
          <option value="true">Yes (Optional / Restricted)</option>
        </select>
      </div>
      <div className="form-group">
        <label>Description</label>
        <input name="description" defaultValue={v("description")} placeholder="e.g. National Holiday / Festival" />
      </div>
    </>
  );
}
