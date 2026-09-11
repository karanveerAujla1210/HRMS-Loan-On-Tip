"use client";

export const dynamic = "force-dynamic";

import { useCallback, useEffect, useState } from "react";
import PageHeader from "@/components/PageHeader";
import DataTable from "@/components/DataTable";
import { apiFetch } from "@/lib/api/client";
import { API } from "@/lib/api/endpoints";
import { useProfile } from "@/hooks/useProfile";

type Row = Record<string, unknown>;

const ACTIONS = ["", "SETTINGS_UPDATE", "SETTLEMENT", "EMPLOYEE_CREATE", "EMPLOYEE_UPDATE", "ASSET_ASSIGN", "ASSET_RETURN", "LEAVE_APPROVE", "PAYROLL_APPROVE"];

export default function AuditPage() {
  const { companyId } = useProfile();
  const [rows, setRows] = useState<Row[]>([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [action, setAction] = useState("");
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!companyId) return;
    setError(null);
    const res = await apiFetch(
      `${API.audit}?page=${page}&pageSize=50${action ? `&action=${encodeURIComponent(action)}` : ""}`
    );
    if (res.error) { setError(res.error.message); setRows([]); }
    else {
      const body = res.data as { data: Row[]; pagination?: { total_pages?: number } } | null;
      // Flatten the `employees` join into an `actor` column for display.
      const mapped = (body?.data ?? []).map((r) => {
        const emp = r.employees as Record<string, unknown> | null;
        return { ...r, actor: emp?.display_name ?? "—" };
      });
      setRows(mapped);
      setTotalPages(body?.pagination?.total_pages ?? 1);
    }
  }, [companyId, page, action]);

  useEffect(() => { void load(); }, [load]);

  return (
    <>
      <PageHeader
        title="Audit Logs"
        subtitle="System-wide administrative history (Super Admin)"
        breadcrumbs={[{ label: "Dashboard", href: "/dashboard" }, { label: "Audit Logs" }]}
      />
      <div className="page-body">
        {error && <div className="alert alert-error">{error}</div>}

        <div className="card" style={{ marginBottom: 16 }}>
          <div className="card-header"><div><h2>Filters</h2></div></div>
          <div className="form-row">
            <div className="form-group">
              <label>Action</label>
              <select value={action} onChange={(e) => { setAction(e.target.value); setPage(1); }}>
                {ACTIONS.map((a) => <option key={a} value={a}>{a || "All actions"}</option>)}
              </select>
            </div>
          </div>
        </div>

        <DataTable
          rows={rows}
          columns={["created_at", "action", "entity_type", "entity_id", "actor"]}
        />

        {totalPages > 1 && (
          <div style={{ display: "flex", gap: 8, marginTop: 16, alignItems: "center" }}>
            <button className="btn btn-sm btn-secondary" disabled={page <= 1} onClick={() => setPage(page - 1)}>← Prev</button>
            <span>Page {page} of {totalPages}</span>
            <button className="btn btn-sm btn-secondary" disabled={page >= totalPages} onClick={() => setPage(page + 1)}>Next →</button>
          </div>
        )}
      </div>
    </>
  );
}