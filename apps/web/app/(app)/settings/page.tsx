"use client";

export const dynamic = "force-dynamic";

import { useCallback, useEffect, useState } from "react";
import PageHeader from "@/components/PageHeader";
import DataTable from "@/components/DataTable";
import { apiFetch } from "@/lib/api/client";
import { API } from "@/lib/api/endpoints";
import { useProfile } from "@/hooks/useProfile";

type Row = Record<string, unknown>;

export default function SettingsPage() {
  const { activeCompanyId } = useProfile();
  const [rows, setRows] = useState<Row[]>([]);
  const [values, setValues] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveMsg, setSaveMsg] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!activeCompanyId) return;
    setError(null);
    const res = await apiFetch(API.settings);
    if (res.error) { setError(res.error.message); setRows([]); }
    else {
      const list = (res.data as { data?: Row[] } | null)?.data ?? [];
      setRows(list);
      const initial: Record<string, string> = {};
      for (const r of list) initial[String(r.setting_key)] = String(r.setting_value ?? "");
      setValues(initial);
    }
  }, [activeCompanyId]);

  useEffect(() => { void load(); }, [load]);

  async function saveSetting(key: string) {
    setSaving(true);
    setSaveMsg(null);
    const res = await apiFetch(API.settings, {
      method: "PATCH",
      body: JSON.stringify({ settings: [{ setting_key: key, setting_value: values[key] ?? "" }] }),
    });
    if (res.error) setSaveMsg(`Error: ${res.error.message}`);
    else { setSaveMsg("Settings saved."); void load(); }
    setSaving(false);
  }

  return (
    <>
      <PageHeader
        title="Settings"
        subtitle="System configuration (Super Admin)"
        breadcrumbs={[{ label: "Dashboard", href: "/dashboard" }, { label: "Settings" }]}
      />
      <div className="page-body">
        {error && <div className="alert alert-error">{error}</div>}
        {saveMsg && <div className={`alert ${saveMsg.startsWith("Error") ? "alert-error" : "alert-success"}`}>{saveMsg}</div>}

        <div className="card">
          <div className="card-header"><div><h2>Configuration</h2><p>{rows.length} keys</p></div></div>
          <DataTable
            rows={rows}
            columns={["setting_key", "setting_value", "data_type", "description"]}
          />
        </div>

        <div className="card" style={{ marginTop: 16 }}>
          <div className="card-header"><div><h2>Edit Keys</h2></div></div>
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {rows.map((r) => {
              const key = String(r.setting_key);
              return (
                <div key={key} style={{ display: "flex", gap: 8, alignItems: "center" }}>
                  <code style={{ flex: 1 }}>{key}</code>
                  <input
                    className="form-input"
                    value={values[key] ?? ""}
                    onChange={(e) => setValues((prev) => ({ ...prev, [key]: e.target.value }))}
                  />
                  <button className="btn btn-sm btn-primary" onClick={() => saveSetting(key)} disabled={saving}>
                    Save
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </>
  );
}