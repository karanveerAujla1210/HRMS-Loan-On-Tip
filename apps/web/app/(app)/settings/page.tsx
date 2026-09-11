"use client";

export const dynamic = "force-dynamic";

import { useCallback, useEffect, useState } from "react";
import PageHeader from "@/components/PageHeader";
import { apiFetch } from "@/lib/api/client";
import { API } from "@/lib/api/endpoints";
import { useProfile } from "@/hooks/useProfile";
import { useToast } from "@/components/Toast";
import { Skeleton } from "@/components/Skeleton";

type Row = Record<string, unknown>;

const DATA_TYPE_LABELS: Record<string, string> = {
  string: "Text",
  number: "Number",
  boolean: "Boolean",
  json: "JSON",
};

const SETTING_GROUPS: Record<string, string[]> = {
  "Attendance & Geofence": [
    "attendance_radius_meters",
    "attendance_grace_minutes",
    "attendance_auto_close_hour",
    "geofence_enabled",
  ],
  "Leave Policy": [
    "leave_carry_forward",
    "leave_max_carry_forward_days",
    "leave_encashment_enabled",
  ],
  "Payroll": [
    "payroll_cycle_day",
    "payroll_currency",
    "payroll_pf_enabled",
    "payroll_esi_enabled",
    "payroll_tds_enabled",
  ],
  "Notifications": [
    "notify_leave_approval",
    "notify_attendance_exception",
    "notify_payroll_generated",
  ],
  "System": [],
};

function groupSettings(rows: Row[]): Record<string, Row[]> {
  const grouped: Record<string, Row[]> = {};
  const assigned = new Set<string>();

  for (const [group, keys] of Object.entries(SETTING_GROUPS)) {
    const matched = rows.filter((r) => keys.includes(String(r.setting_key)));
    if (matched.length > 0) {
      grouped[group] = matched;
      matched.forEach((r) => assigned.add(String(r.setting_key)));
    }
  }

  const remaining = rows.filter((r) => !assigned.has(String(r.setting_key)));
  if (remaining.length > 0) {
    grouped["System"] = [...(grouped["System"] ?? []), ...remaining];
  }

  return grouped;
}

export default function SettingsPage() {
  const { activeCompanyId } = useProfile();
  const { showToast } = useToast();
  const [rows, setRows] = useState<Row[]>([]);
  const [values, setValues] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [dirty, setDirty] = useState<Set<string>>(new Set());

  const load = useCallback(async () => {
    if (!activeCompanyId) return;
    setError(null);
    setLoading(true);
    const res = await apiFetch(API.settings);
    if (res.error) {
      setError(res.error.message);
      setRows([]);
    } else {
      const list = (res.data as { data?: Row[] } | null)?.data ?? [];
      setRows(list);
      const initial: Record<string, string> = {};
      for (const r of list) initial[String(r.setting_key)] = String(r.setting_value ?? "");
      setValues(initial);
    }
    setLoading(false);
  }, [activeCompanyId]);

  useEffect(() => { void load(); }, [load]);

  async function saveSetting(key: string) {
    setSaving(key);
    const res = await apiFetch(API.settings, {
      method: "PATCH",
      body: JSON.stringify({ settings: [{ setting_key: key, setting_value: values[key] ?? "" }] }),
    });
    if (res.error) {
      showToast({ type: "error", title: "Save failed", message: res.error.message });
    } else {
      showToast({ type: "success", title: "Setting saved", message: `${key} updated successfully.` });
      setDirty((prev) => { const next = new Set(prev); next.delete(key); return next; });
      void load();
    }
    setSaving(null);
  }

  async function saveAll() {
    if (dirty.size === 0) return;
    setSaving("__all__");
    const settings = Array.from(dirty).map((key) => ({ setting_key: key, setting_value: values[key] ?? "" }));
    const res = await apiFetch(API.settings, {
      method: "PATCH",
      body: JSON.stringify({ settings }),
    });
    if (res.error) {
      showToast({ type: "error", title: "Save failed", message: res.error.message });
    } else {
      showToast({ type: "success", title: "Settings saved", message: `${dirty.size} setting(s) updated.` });
      setDirty(new Set());
      void load();
    }
    setSaving(null);
  }

  const grouped = groupSettings(rows);

  return (
    <>
      <PageHeader
        title="System Settings"
        subtitle="Configure attendance, payroll, leave policies and system behaviour"
        breadcrumbs={[{ label: "Dashboard", href: "/dashboard" }, { label: "Settings" }]}
        actions={
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            {dirty.size > 0 && (
              <span style={{ fontSize: 12, color: "var(--warning)", fontWeight: 600 }}>
                {dirty.size} unsaved change{dirty.size > 1 ? "s" : ""}
              </span>
            )}
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              onClick={() => void load()}
            >
              <IcRefresh /> Refresh
            </button>
            <button
              type="button"
              className="btn btn-primary btn-sm"
              onClick={() => void saveAll()}
              disabled={dirty.size === 0 || saving === "__all__"}
            >
              {saving === "__all__" ? "Saving…" : "Save All Changes"}
            </button>
          </div>
        }
      />

      <div className="page-body">
        {error && <div className="alert alert-error">{error}</div>}

        {loading ? (
          <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
            {[1, 2, 3].map((i) => (
              <div key={i} className="card" style={{ padding: 24 }}>
                <Skeleton variant="text" width="200px" height={16} style={{ marginBottom: 20 }} />
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))", gap: 16 }}>
                  {[1, 2, 3].map((j) => (
                    <div key={j} style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                      <Skeleton variant="text" width="120px" height={12} />
                      <Skeleton variant="rectangular" height={38} />
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        ) : rows.length === 0 ? (
          <div className="empty-state-card">
            <div className="empty-state-icon"><IcSettings /></div>
            <h3 className="empty-state-title">No settings configured</h3>
            <p className="empty-state-description">System settings will appear here once the company configuration is initialized.</p>
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
            {Object.entries(grouped).map(([group, groupRows]) => (
              <div key={group} className="card">
                <div className="card-header">
                  <div>
                    <h2 style={{ fontSize: 14, fontWeight: 700 }}>{group}</h2>
                    <p>{groupRows.length} configuration key{groupRows.length !== 1 ? "s" : ""}</p>
                  </div>
                </div>
                <div style={{ padding: "20px 24px" }}>
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))", gap: 20 }}>
                    {groupRows.map((r) => {
                      const key = String(r.setting_key);
                      const dataType = String(r.data_type ?? "string");
                      const description = String(r.description ?? "");
                      const isDirty = dirty.has(key);
                      const isSaving = saving === key;

                      return (
                        <div key={key} style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
                            <label style={{ margin: 0, fontSize: 12.5, fontWeight: 600, color: "var(--text-base)" }}>
                              {key.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())}
                            </label>
                            <span style={{
                              fontSize: 10,
                              fontWeight: 600,
                              padding: "2px 6px",
                              borderRadius: 4,
                              background: "var(--bg)",
                              color: "var(--text-muted)",
                              border: "1px solid var(--border)",
                              textTransform: "uppercase",
                              letterSpacing: "0.04em",
                            }}>
                              {DATA_TYPE_LABELS[dataType] ?? dataType}
                            </span>
                          </div>

                          {description && (
                            <p style={{ fontSize: 11.5, color: "var(--text-muted)", margin: 0, lineHeight: 1.4 }}>
                              {description}
                            </p>
                          )}

                          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                            {dataType === "boolean" ? (
                              <select
                                value={values[key] ?? ""}
                                onChange={(e) => {
                                  setValues((prev) => ({ ...prev, [key]: e.target.value }));
                                  setDirty((prev) => new Set([...prev, key]));
                                }}
                                style={{ flex: 1, height: 36, fontSize: 13 }}
                              >
                                <option value="true">Enabled</option>
                                <option value="false">Disabled</option>
                              </select>
                            ) : (
                              <input
                                type={dataType === "number" ? "number" : "text"}
                                value={values[key] ?? ""}
                                onChange={(e) => {
                                  setValues((prev) => ({ ...prev, [key]: e.target.value }));
                                  setDirty((prev) => new Set([...prev, key]));
                                }}
                                style={{ flex: 1, height: 36, fontSize: 13 }}
                                placeholder={`Enter ${dataType} value…`}
                              />
                            )}
                            <button
                              type="button"
                              className="btn btn-primary btn-sm"
                              onClick={() => void saveSetting(key)}
                              disabled={isSaving || !isDirty}
                              style={{ flexShrink: 0, height: 36 }}
                            >
                              {isSaving ? "…" : "Save"}
                            </button>
                          </div>

                          {isDirty && (
                            <span style={{ fontSize: 11, color: "var(--warning)", fontWeight: 600 }}>
                              Unsaved change
                            </span>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </>
  );
}

function IcRefresh() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
      <polyline points="23 4 23 10 17 10" />
      <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10" />
    </svg>
  );
}

function IcSettings() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5}>
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
    </svg>
  );
}
