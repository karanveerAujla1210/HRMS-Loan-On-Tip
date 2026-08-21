"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import PageHeader from "@/components/PageHeader";
import DataTable from "@/components/DataTable";

type Row = Record<string, unknown>;

export default function EmployeeDocumentsPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [docs, setDocs] = useState<Row[]>([]);
  const [docTypes, setDocTypes] = useState<Row[]>([]);
  const [empName, setEmpName] = useState("");
  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const [empRes, docsRes, typesRes] = await Promise.all([
      supabase.from("employees").select("display_name,company_id").eq("id", id).single(),
      supabase.from("employee_documents")
        .select("id,file_name,storage_path,status,issue_date,expiry_date,created_at,document_types(name),uploaded_by_emp:uploaded_by(display_name),verified_by_emp:verified_by(display_name)")
        .eq("employee_id", id)
        .order("created_at", { ascending: false }),
      supabase.from("document_types").select("id,name,code").order("name"),
    ]);
    setEmpName(String(empRes.data?.display_name ?? "Employee"));
    const mapped = ((docsRes.data ?? []) as Record<string, unknown>[]).map((r) => ({
      ...r,
      document_type: (r.document_types as Record<string, unknown> | null)?.name ?? "—",
      uploaded_by:   (r.uploaded_by_emp as Record<string, unknown> | null)?.display_name ?? "—",
      verified_by:   (r.verified_by_emp as Record<string, unknown> | null)?.display_name ?? "—",
    }));
    setDocs(mapped as Row[]);
    setDocTypes((typesRes.data as Row[]) ?? []);
    setLoading(false);
  }, [id]);

  useEffect(() => { void load(); }, [load]);

  async function handleUpload(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSaving(true);
    setMsg(null);
    const fd = new FormData(e.currentTarget);

    // Get current user's employee_id for uploaded_by
    const { data: { session } } = await supabase.auth.getSession();
    let uploaderId: string | null = null;
    if (session) {
      const { data: prof } = await supabase.from("profiles").select("employee_id").eq("auth_user_id", session.user.id).single();
      uploaderId = prof?.employee_id ?? null;
    }

    const { error } = await supabase.from("employee_documents").insert({
      employee_id: id,
      document_type_id: fd.get("document_type_id"),
      storage_path: fd.get("storage_path") || "pending-upload",
      file_name: fd.get("file_name"),
      issue_date: fd.get("issue_date") || null,
      expiry_date: fd.get("expiry_date") || null,
      status: "ACTIVE",
      uploaded_by: uploaderId,
    });

    if (error) { setMsg(`Error: ${error.message}`); setSaving(false); return; }
    setMsg("Document record added.");
    setShowForm(false);
    void load();
    setSaving(false);
  }

  async function markVerified(row: Row) {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return;
    const { data: prof } = await supabase.from("profiles").select("employee_id").eq("auth_user_id", session.user.id).single();
    await supabase.from("employee_documents").update({
      verified_by: prof?.employee_id ?? null,
      verified_at: new Date().toISOString(),
      status: "VERIFIED",
    }).eq("id", String(row.id));
    void load();
  }

  return (
    <>
      <PageHeader
        title={`${empName} — Documents`}
        subtitle="Employee document records"
        actions={
          <div style={{ display: "flex", gap: 8 }}>
            <button className="btn btn-secondary btn-sm" onClick={() => router.back()}>← Back</button>
            <button className="btn btn-primary btn-sm" onClick={() => setShowForm(true)}>+ Add document</button>
          </div>
        }
      />

      <div className="page-body">
        {msg && <div className={`alert ${msg.startsWith("Error") ? "alert-error" : "alert-success"}`}>{msg}</div>}

        <div className="card">
          {loading ? (
            <div className="loading-spinner"><div className="spinner" /> Loading…</div>
          ) : (
            <DataTable
              rows={docs}
              columns={["document_type","file_name","status","issue_date","expiry_date","uploaded_by","verified_by","created_at"]}
              action={(row) =>
                String(row.status) !== "VERIFIED" ? (
                  <button className="btn btn-sm btn-primary" onClick={() => markVerified(row)}>Verify</button>
                ) : null
              }
            />
          )}
        </div>
      </div>

      {showForm && (
        <div className="modal-backdrop">
          <div className="modal">
            <div className="modal-header">
              <h2>Add document</h2>
              <button className="btn btn-ghost btn-sm" onClick={() => setShowForm(false)}>✕</button>
            </div>
            <form onSubmit={handleUpload}>
              <div className="modal-body">
                <div className="form-group">
                  <label>Document type *</label>
                  <select name="document_type_id" required defaultValue="">
                    <option value="" disabled>Select type</option>
                    {docTypes.map((dt) => (
                      <option key={String(dt.id)} value={String(dt.id)}>{String(dt.name)}</option>
                    ))}
                  </select>
                </div>
                <div className="form-group">
                  <label>File name *</label>
                  <input name="file_name" required placeholder="e.g. aadhaar_card.pdf" />
                </div>
                <div className="form-group">
                  <label>Storage path / URL</label>
                  <input name="storage_path" placeholder="Supabase storage path or URL" />
                </div>
                <div className="form-row">
                  <div className="form-group"><label>Issue date</label><input name="issue_date" type="date" /></div>
                  <div className="form-group"><label>Expiry date</label><input name="expiry_date" type="date" /></div>
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setShowForm(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary" disabled={saving}>{saving ? "Saving…" : "Add"}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
