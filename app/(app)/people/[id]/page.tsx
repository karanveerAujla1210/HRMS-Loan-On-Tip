"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import PageHeader from "@/components/PageHeader";

type Emp = Record<string, unknown>;

export default function EmployeeDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [emp, setEmp] = useState<Emp | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [depts, setDepts] = useState<Emp[]>([]);
  const [desigs, setDesigs] = useState<Emp[]>([]);
  const [locs, setLocs] = useState<Emp[]>([]);

  const load = useCallback(async () => {
    setLoading(true);
    const [empRes, deptRes, desigRes, locRes] = await Promise.all([
      supabase.from("employees").select("*").eq("id", id).single(),
      supabase.from("departments").select("id,name"),
      supabase.from("designations").select("id,name"),
      supabase.from("locations").select("id,name"),
    ]);
    if (empRes.error) setError(empRes.error.message);
    setEmp(empRes.data as Emp);
    setDepts((deptRes.data as Emp[]) ?? []);
    setDesigs((desigRes.data as Emp[]) ?? []);
    setLocs((locRes.data as Emp[]) ?? []);
    setLoading(false);
  }, [id]);

  useEffect(() => { void load(); }, [load]);

  async function handleSave(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSaving(true);
    setMsg(null);
    const fd = new FormData(e.currentTarget);
    const { error } = await supabase.from("employees").update({
      first_name: fd.get("first_name"),
      last_name: fd.get("last_name"),
      official_email: fd.get("official_email") || null,
      official_mobile: fd.get("official_mobile") || null,
      personal_email: fd.get("personal_email") || null,
      personal_mobile: fd.get("personal_mobile") || null,
      gender: fd.get("gender") || null,
      date_of_birth: fd.get("date_of_birth") || null,
      blood_group: fd.get("blood_group") || null,
      nationality: fd.get("nationality") || "Indian",
      marital_status: fd.get("marital_status") || null,
      department_id: fd.get("department_id") || null,
      designation_id: fd.get("designation_id") || null,
      location_id: fd.get("location_id") || null,
      employment_status: fd.get("employment_status"),
      joining_date: fd.get("joining_date"),
    }).eq("id", id);
    if (error) { setMsg(`Error: ${error.message}`); setSaving(false); return; }
    setMsg("Profile updated.");
    setEditing(false);
    void load();
    setSaving(false);
  }

  if (loading) return <div className="loading-spinner" style={{ minHeight: "60vh" }}><div className="spinner" /> Loading…</div>;
  if (!emp) return <div className="page-body"><div className="alert alert-error">{error ?? "Employee not found."}</div></div>;

  const name = String(emp.display_name ?? `${emp.first_name} ${emp.last_name}`);

  return (
    <>
      <PageHeader
        title={name}
        subtitle={String(emp.employee_code ?? "")}
        actions={
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <button className="btn btn-secondary btn-sm" onClick={() => router.push("/people")}>← Back</button>
            <Link href={`/people/${id}/documents`} className="btn btn-secondary btn-sm">Documents</Link>
            <Link href={`/people/${id}/salary`} className="btn btn-secondary btn-sm">Salary</Link>
            <Link href={`/people/${id}/assets`} className="btn btn-secondary btn-sm">Assets</Link>
            <Link href={`/people/${id}/exit`} className="btn btn-secondary btn-sm">Exit / FnF</Link>
            <Link href={`/people/${id}/id-card`} className="btn btn-primary btn-sm">ID Card</Link>
          </div>
        }
      />

      <div className="page-body">
        {msg && <div className="alert alert-success">{msg}</div>}

        <div className="card">
          <div className="card-header">
            <div><h2>Profile</h2><p>Personal and employment details</p></div>
            {!editing && <button className="btn btn-secondary btn-sm" onClick={() => setEditing(true)}>Edit</button>}
          </div>

          {editing ? (
            <form onSubmit={handleSave}>
              <div className="modal-body">
                <div className="form-row">
                  <div className="form-group">
                    <label>First name *</label>
                    <input name="first_name" required defaultValue={String(emp.first_name ?? "")} />
                  </div>
                  <div className="form-group">
                    <label>Last name *</label>
                    <input name="last_name" required defaultValue={String(emp.last_name ?? "")} />
                  </div>
                </div>
                <div className="form-row">
                  <div className="form-group">
                    <label>Work email</label>
                    <input name="official_email" type="email" defaultValue={String(emp.official_email ?? "")} />
                  </div>
                  <div className="form-group">
                    <label>Work mobile</label>
                    <input name="official_mobile" defaultValue={String(emp.official_mobile ?? "")} />
                  </div>
                </div>
                <div className="form-row">
                  <div className="form-group">
                    <label>Personal email</label>
                    <input name="personal_email" type="email" defaultValue={String(emp.personal_email ?? "")} />
                  </div>
                  <div className="form-group">
                    <label>Personal mobile</label>
                    <input name="personal_mobile" defaultValue={String(emp.personal_mobile ?? "")} />
                  </div>
                </div>
                <div className="form-row">
                  <div className="form-group">
                    <label>Gender</label>
                    <select name="gender" defaultValue={String(emp.gender ?? "")}>
                      <option value="">Select</option>
                      <option value="Male">Male</option>
                      <option value="Female">Female</option>
                      <option value="Other">Other</option>
                    </select>
                  </div>
                  <div className="form-group">
                    <label>Date of birth</label>
                    <input name="date_of_birth" type="date" defaultValue={String(emp.date_of_birth ?? "")} />
                  </div>
                </div>
                <div className="form-row">
                  <div className="form-group">
                    <label>Blood group</label>
                    <select name="blood_group" defaultValue={String(emp.blood_group ?? "")}>
                      <option value="">Select</option>
                      {["A+","A-","B+","B-","O+","O-","AB+","AB-"].map(g => <option key={g} value={g}>{g}</option>)}
                    </select>
                  </div>
                  <div className="form-group">
                    <label>Marital status</label>
                    <select name="marital_status" defaultValue={String(emp.marital_status ?? "")}>
                      <option value="">Select</option>
                      <option value="Single">Single</option>
                      <option value="Married">Married</option>
                    </select>
                  </div>
                </div>
                <div className="form-row">
                  <div className="form-group">
                    <label>Department</label>
                    <select name="department_id" defaultValue={String(emp.department_id ?? "")}>
                      <option value="">None</option>
                      {depts.map(d => <option key={String(d.id)} value={String(d.id)}>{String(d.name)}</option>)}
                    </select>
                  </div>
                  <div className="form-group">
                    <label>Designation</label>
                    <select name="designation_id" defaultValue={String(emp.designation_id ?? "")}>
                      <option value="">None</option>
                      {desigs.map(d => <option key={String(d.id)} value={String(d.id)}>{String(d.name)}</option>)}
                    </select>
                  </div>
                </div>
                <div className="form-row">
                  <div className="form-group">
                    <label>Location</label>
                    <select name="location_id" defaultValue={String(emp.location_id ?? "")}>
                      <option value="">None</option>
                      {locs.map(l => <option key={String(l.id)} value={String(l.id)}>{String(l.name)}</option>)}
                    </select>
                  </div>
                  <div className="form-group">
                    <label>Status</label>
                    <select name="employment_status" defaultValue={String(emp.employment_status ?? "ACTIVE")}>
                      <option value="ACTIVE">Active</option>
                      <option value="INACTIVE">Inactive</option>
                      <option value="ON_NOTICE">On Notice</option>
                      <option value="TERMINATED">Terminated</option>
                    </select>
                  </div>
                </div>
                <div className="form-row">
                  <div className="form-group">
                    <label>Joining date *</label>
                    <input name="joining_date" type="date" required defaultValue={String(emp.joining_date ?? "")} />
                  </div>
                  <div className="form-group">
                    <label>Nationality</label>
                    <input name="nationality" defaultValue={String(emp.nationality ?? "Indian")} />
                  </div>
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setEditing(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary" disabled={saving}>{saving ? "Saving…" : "Save changes"}</button>
              </div>
            </form>
          ) : (
            <div style={{ padding: 20, display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px 32px" }}>
              {[
                ["Employee code", emp.employee_code],
                ["Status", emp.employment_status],
                ["Work email", emp.official_email],
                ["Work mobile", emp.official_mobile],
                ["Personal email", emp.personal_email],
                ["Personal mobile", emp.personal_mobile],
                ["Department", emp.department_id],
                ["Designation", emp.designation_id],
                ["Location", emp.location_id],
                ["Joining date", emp.joining_date],
                ["Date of birth", emp.date_of_birth],
                ["Gender", emp.gender],
                ["Blood group", emp.blood_group],
                ["Marital status", emp.marital_status],
                ["Nationality", emp.nationality],
              ].map(([label, val]) => (
                <div key={String(label)}>
                  <div style={{ fontSize: 11, fontWeight: 600, color: "var(--text-3)", textTransform: "uppercase", letterSpacing: ".5px" }}>{label}</div>
                  <div style={{ fontSize: 13, color: "var(--text)", marginTop: 3 }}>{val ? String(val) : <span style={{ color: "var(--text-4)" }}>—</span>}</div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </>
  );
}
