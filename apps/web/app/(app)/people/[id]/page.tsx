"use client";

export const dynamic = "force-dynamic";

import { useCallback, useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import { apiFetch } from "@/lib/api/client";
import { API } from "@/lib/api/endpoints";
import { PageHeader, StatusBadge } from "@/components";
import EmployeeSubNav from "@/components/EmployeeSubNav";

type Emp = Record<string, unknown>;
type CustomField = {
  id: string;
  name: string;
  field_type: string;
  options?: unknown;
};

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
  const [customFields, setCustomFields] = useState<CustomField[]>([]);
  const [customData, setCustomData] = useState<Record<string, unknown>>({});
  const [loginStatus, setLoginStatus] = useState<{ hasLogin: boolean; checked: boolean }>({ hasLogin: false, checked: false });
  const [generatingLogin, setGeneratingLogin] = useState(false);
  const [loginMsg, setLoginMsg] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const [empRes, deptRes, desigRes, locRes] = await Promise.all([
      supabase.from("employees").select("*").eq("id", id).single(),
      supabase.from("departments").select("id,name"),
      supabase.from("designations").select("id,name"),
      supabase.from("locations").select("id,name"),
    ]);
    if (empRes.error) setError(empRes.error.message);
    const eData = empRes.data as Emp;
    setEmp(eData);
    setDepts((deptRes.data as Emp[]) ?? []);
    setDesigs((desigRes.data as Emp[]) ?? []);
    setLocs((locRes.data as Emp[]) ?? []);

    if (eData?.company_id) {
      const [cfRes, cdRes] = await Promise.all([
        supabase.from("custom_fields").select("*").eq("company_id", eData.company_id).eq("is_active", true),
        supabase.from("employee_custom_data").select("custom_field_id, field_value").eq("employee_id", id),
      ]);
      setCustomFields((cfRes.data as CustomField[]) || []);
      const cdMap: Record<string, unknown> = {};
      ((cdRes.data as Array<Record<string, unknown>>) || []).forEach((cd) => {
        const key = String((cd as Record<string, unknown>).custom_field_id ?? "");
        if (key) cdMap[key] = (cd as Record<string, unknown>).field_value;
      });
      setCustomData(cdMap);
    }

    const { data: profileRow } = await supabase
      .from("profiles")
      .select("id, auth_user_id")
      .eq("employee_id", id)
      .maybeSingle();
    setLoginStatus({ hasLogin: !!(profileRow as Record<string, unknown> | null)?.auth_user_id, checked: true });

    setLoading(false);
  }, [id]);

  useEffect(() => { void load(); }, [load]);

  async function handleSave(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSaving(true);
    setMsg(null);
    const fd = new FormData(e.currentTarget);

    const res = await apiFetch(API.employees.update(id), {
      method: "PATCH",
      body: JSON.stringify({
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
      }),
    });
    if (res.error) { setMsg(`Error: ${res.error.message}`); setSaving(false); return; }

    const customUpserts = customFields.map((cf) => {
      const val = fd.get(`cf_${cf.id}`);
      return {
        employee_id: id,
        custom_field_id: cf.id,
        field_value: val ? String(val) : null,
      };
    }).filter((cu) => cu.field_value !== null);

    if (customUpserts.length > 0) {
      const { error: upsertError } = await supabase
        .from("employee_custom_data")
        .upsert(customUpserts, { onConflict: "employee_id, custom_field_id" });
      if (upsertError) { setMsg(`Error: ${upsertError.message}`); setSaving(false); return; }
    }
    setMsg("Employee profile updated successfully.");
    setEditing(false);
    void load();
    setSaving(false);
  }

  async function handleGenerateLogin() {
    setGeneratingLogin(true);
    setLoginMsg(null);
    const res = await apiFetch<{ message: string; email: string; already_existed: boolean }>(
      API.employees.generateLogin(id),
      { method: "POST" }
    );
    if (res.error) {
      setLoginMsg({ type: "error", text: res.error.message ?? "Failed to generate login credentials" });
    } else {
      const d = res.data!;
      setLoginMsg({
        type: "success",
        text: d.already_existed ? `Account already exists for ${d.email}` : `Portal invitation email sent to ${d.email}`,
      });
      setLoginStatus({ hasLogin: true, checked: true });
    }
    setGeneratingLogin(false);
  }

  if (loading) return <div className="loading-spinner" style={{ minHeight: "60vh" }}><div className="spinner" /> Loading employee profile…</div>;
  if (!emp) return <div className="page-body"><div className="alert alert-error">{error ?? "Employee record not found."}</div></div>;

  const name = String(emp.display_name ?? `${emp.first_name} ${emp.last_name}`);
  const initials = (name.replace(/[^A-Za-z]/g, "").slice(0, 2) || "EM").toUpperCase();

  const deptName = depts.find((d) => String(d.id) === String(emp.department_id))?.name ?? emp.department_id ?? "—";
  const desigName = desigs.find((d) => String(d.id) === String(emp.designation_id))?.name ?? emp.designation_id ?? "—";
  const locName = locs.find((l) => String(l.id) === String(emp.location_id))?.name ?? emp.location_id ?? "—";

  return (
    <>
      <PageHeader
        title={name}
        subtitle={`Employee ID: ${String(emp.employee_code ?? "—")}`}
        badge={<StatusBadge status={String(emp.employment_status ?? "ACTIVE")} size="sm" />}
        breadcrumbs={[
          { label: "Dashboard", href: "/dashboard" },
          { label: "People", href: "/people" },
          { label: name, active: true },
        ]}
        actions={
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              onClick={() => router.push("/people")}
            >
              ← Back to Directory
            </button>
            {loginStatus.checked && !loginStatus.hasLogin && !!emp.official_email && (
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                onClick={() => void handleGenerateLogin()}
                disabled={generatingLogin}
              >
                {generatingLogin ? "Generating…" : "🔑 Send Portal Invite"}
              </button>
            )}
            {loginStatus.checked && loginStatus.hasLogin && (
              <span style={{ fontSize: 12, fontWeight: 600, color: "var(--success)", display: "flex", alignItems: "center", gap: 4, padding: "0 8px" }}>
                ✓ Portal Active
              </span>
            )}
            <Link href={`/people/${id}/id-card`} className="btn btn-secondary btn-sm">
              🖨 ID Card
            </Link>
            {!editing && (
              <button
                type="button"
                className="btn btn-primary btn-sm"
                onClick={() => setEditing(true)}
              >
                Edit Profile
              </button>
            )}
          </div>
        }
      />

      <EmployeeSubNav employeeId={id} />

      <div className="page-body">
        {msg && <div className="alert alert-success">{msg}</div>}
        {loginMsg && (
          <div className={`alert alert-${loginMsg.type === "success" ? "success" : "error"}`}>
            {loginMsg.text}
          </div>
        )}

        {/* 360 Profile Hero Card */}
        <div
          style={{
            background: "var(--surface)",
            border: "1px solid var(--border)",
            borderRadius: "var(--radius-lg)",
            padding: "24px",
            marginBottom: 24,
            display: "flex",
            alignItems: "center",
            gap: 20,
            flexWrap: "wrap",
            boxShadow: "var(--shadow-xs)",
          }}
        >
          <div
            style={{
              width: 68,
              height: 68,
              borderRadius: "var(--radius-xl)",
              background: "linear-gradient(135deg, var(--brand) 0%, var(--brand-dark) 100%)",
              color: "#ffffff",
              display: "grid",
              placeItems: "center",
              fontSize: 22,
              fontWeight: 800,
              fontFamily: "var(--font-display)",
              flexShrink: 0,
              boxShadow: "0 4px 12px rgba(232, 85, 52, 0.25)",
            }}
          >
            {initials}
          </div>

          <div style={{ flex: 1, minWidth: 240 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap", marginBottom: 4 }}>
              <h2 style={{ margin: 0, fontSize: 20, fontWeight: 700 }}>{name}</h2>
              <span className="code-badge">{String(emp.employee_code ?? "EMP")}</span>
              <StatusBadge status={String(emp.employment_status ?? "ACTIVE")} size="sm" />
            </div>

            <div style={{ display: "flex", alignItems: "center", gap: 16, flexWrap: "wrap", fontSize: 13, color: "var(--text-muted)", marginTop: 4 }}>
              <span>{String(desigName)}</span>
              <span>·</span>
              <span>{String(deptName)}</span>
              <span>·</span>
              <span>{String(locName)}</span>
            </div>
          </div>

          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            {Boolean(emp.official_email) && (
              <a
                href={`mailto:${String(emp.official_email)}`}
                className="btn btn-secondary btn-sm"
                title={String(emp.official_email)}
              >
                ✉ Email
              </a>
            )}
            {Boolean(emp.official_mobile) && (
              <a
                href={`tel:${String(emp.official_mobile)}`}
                className="btn btn-secondary btn-sm"
                title={String(emp.official_mobile)}
              >
                📞 Call
              </a>
            )}
          </div>
        </div>

        {/* Profile Details or Edit Form */}
        <div className="card">
          <div className="card-header">
            <div>
              <h2>{editing ? "Edit Employee Details" : "Personal & Employment Profile"}</h2>
              <p>{editing ? "Update official and personal records" : "Comprehensive 360-degree employment overview"}</p>
            </div>
          </div>

          {editing ? (
            <form onSubmit={handleSave}>
              <div style={{ padding: "24px" }}>
                <h3 style={{ fontSize: 14, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em", color: "var(--text-muted)", marginBottom: 16 }}>
                  Personal Information
                </h3>
                <div className="form-row" style={{ marginBottom: 16 }}>
                  <div className="form-group">
                    <label>First name *</label>
                    <input name="first_name" required defaultValue={String(emp.first_name ?? "")} />
                  </div>
                  <div className="form-group">
                    <label>Last name *</label>
                    <input name="last_name" required defaultValue={String(emp.last_name ?? "")} />
                  </div>
                </div>

                <div className="form-row" style={{ marginBottom: 16 }}>
                  <div className="form-group">
                    <label>Date of birth</label>
                    <input name="date_of_birth" type="date" defaultValue={String(emp.date_of_birth ?? "")} />
                  </div>
                  <div className="form-group">
                    <label>Gender</label>
                    <select name="gender" defaultValue={String(emp.gender ?? "")}>
                      <option value="">Select Gender</option>
                      <option value="Male">Male</option>
                      <option value="Female">Female</option>
                      <option value="Other">Other</option>
                    </select>
                  </div>
                </div>

                <div className="form-row" style={{ marginBottom: 24 }}>
                  <div className="form-group">
                    <label>Blood group</label>
                    <select name="blood_group" defaultValue={String(emp.blood_group ?? "")}>
                      <option value="">Select Blood Group</option>
                      {["A+", "A-", "B+", "B-", "O+", "O-", "AB+", "AB-"].map((g) => (
                        <option key={g} value={g}>{g}</option>
                      ))}
                    </select>
                  </div>
                  <div className="form-group">
                    <label>Marital status</label>
                    <select name="marital_status" defaultValue={String(emp.marital_status ?? "")}>
                      <option value="">Select Status</option>
                      <option value="Single">Single</option>
                      <option value="Married">Married</option>
                    </select>
                  </div>
                </div>

                <hr style={{ border: "none", borderTop: "1px solid var(--border)", margin: "24px 0" }} />

                <h3 style={{ fontSize: 14, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em", color: "var(--text-muted)", marginBottom: 16 }}>
                  Employment & Placement
                </h3>

                <div className="form-row" style={{ marginBottom: 16 }}>
                  <div className="form-group">
                    <label>Department</label>
                    <select name="department_id" defaultValue={String(emp.department_id ?? "")}>
                      <option value="">Select Department</option>
                      {depts.map((d) => (
                        <option key={String(d.id)} value={String(d.id)}>{String(d.name)}</option>
                      ))}
                    </select>
                  </div>
                  <div className="form-group">
                    <label>Designation</label>
                    <select name="designation_id" defaultValue={String(emp.designation_id ?? "")}>
                      <option value="">Select Designation</option>
                      {desigs.map((d) => (
                        <option key={String(d.id)} value={String(d.id)}>{String(d.name)}</option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="form-row" style={{ marginBottom: 16 }}>
                  <div className="form-group">
                    <label>Location</label>
                    <select name="location_id" defaultValue={String(emp.location_id ?? "")}>
                      <option value="">Select Location</option>
                      {locs.map((l) => (
                        <option key={String(l.id)} value={String(l.id)}>{String(l.name)}</option>
                      ))}
                    </select>
                  </div>
                  <div className="form-group">
                    <label>Employment Status</label>
                    <select name="employment_status" defaultValue={String(emp.employment_status ?? "ACTIVE")}>
                      <option value="ACTIVE">Active</option>
                      <option value="INACTIVE">Inactive</option>
                      <option value="ON_NOTICE">On Notice</option>
                      <option value="TERMINATED">Terminated</option>
                    </select>
                  </div>
                </div>

                <div className="form-row" style={{ marginBottom: 24 }}>
                  <div className="form-group">
                    <label>Joining date *</label>
                    <input name="joining_date" type="date" required defaultValue={String(emp.joining_date ?? "")} />
                  </div>
                  <div className="form-group">
                    <label>Nationality</label>
                    <input name="nationality" defaultValue={String(emp.nationality ?? "Indian")} />
                  </div>
                </div>

                <hr style={{ border: "none", borderTop: "1px solid var(--border)", margin: "24px 0" }} />

                <h3 style={{ fontSize: 14, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em", color: "var(--text-muted)", marginBottom: 16 }}>
                  Contact Details
                </h3>

                <div className="form-row" style={{ marginBottom: 16 }}>
                  <div className="form-group">
                    <label>Official Work Email</label>
                    <input name="official_email" type="email" defaultValue={String(emp.official_email ?? "")} />
                  </div>
                  <div className="form-group">
                    <label>Official Mobile</label>
                    <input name="official_mobile" defaultValue={String(emp.official_mobile ?? "")} />
                  </div>
                </div>

                <div className="form-row" style={{ marginBottom: 24 }}>
                  <div className="form-group">
                    <label>Personal Email</label>
                    <input name="personal_email" type="email" defaultValue={String(emp.personal_email ?? "")} />
                  </div>
                  <div className="form-group">
                    <label>Personal Mobile</label>
                    <input name="personal_mobile" defaultValue={String(emp.personal_mobile ?? "")} />
                  </div>
                </div>

                {customFields.length > 0 && (
                  <>
                    <hr style={{ border: "none", borderTop: "1px solid var(--border)", margin: "24px 0" }} />
                    <h3 style={{ fontSize: 14, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em", color: "var(--text-muted)", marginBottom: 16 }}>
                      Organization Custom Attributes
                    </h3>
                    <div className="form-row" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
                      {customFields.map((cf) => (
                        <div className="form-group" key={cf.id}>
                          <label>{cf.name}</label>
                          {cf.field_type === "DROPDOWN" || cf.field_type === "MULTI_SELECT" ? (
                            <select name={`cf_${cf.id}`} defaultValue={String(customData[cf.id] ?? "")}>
                              <option value="">Select</option>
                              {Array.isArray(cf.options) && (cf.options as string[]).map((opt) => (
                                <option key={opt} value={opt}>{opt}</option>
                              ))}
                            </select>
                          ) : cf.field_type === "BOOLEAN" ? (
                            <select name={`cf_${cf.id}`} defaultValue={String(customData[cf.id] ?? "")}>
                              <option value="">Select</option>
                              <option value="true">Yes</option>
                              <option value="false">No</option>
                            </select>
                          ) : (
                            <input
                              name={`cf_${cf.id}`}
                              type={cf.field_type === "DATE" ? "date" : cf.field_type === "NUMBER" || cf.field_type === "CURRENCY" ? "number" : cf.field_type === "EMAIL" ? "email" : cf.field_type === "PHONE" ? "tel" : "text"}
                              step={cf.field_type === "NUMBER" || cf.field_type === "CURRENCY" ? "any" : undefined}
                              defaultValue={String(customData[cf.id] ?? "")}
                            />
                          )}
                        </div>
                      ))}
                    </div>
                  </>
                )}
              </div>

              <div
                style={{
                  padding: "16px 24px",
                  background: "var(--bg)",
                  borderTop: "1px solid var(--border)",
                  display: "flex",
                  justifyContent: "flex-end",
                  gap: 10,
                  borderRadius: "0 0 var(--radius-lg) var(--radius-lg)",
                }}
              >
                <button type="button" className="btn btn-secondary" onClick={() => setEditing(false)}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary" disabled={saving}>
                  {saving ? "Saving Changes…" : "Save Changes"}
                </button>
              </div>
            </form>
          ) : (
            <div style={{ padding: 24 }}>
              {/* Profile grid sections */}
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 24 }}>
                {/* Employment placement */}
                <div style={{ background: "var(--bg)", borderRadius: "var(--radius-md)", padding: 18, border: "1px solid var(--border)" }}>
                  <div style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", color: "var(--text-muted)", marginBottom: 14 }}>
                    Employment Details
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                    <div>
                      <div style={{ fontSize: 11, color: "var(--text-muted)" }}>Employee Code</div>
                      <div style={{ fontSize: 13, fontWeight: 600, color: "var(--text-strong)", marginTop: 2 }}>{String(emp.employee_code ?? "—")}</div>
                    </div>
                    <div>
                      <div style={{ fontSize: 11, color: "var(--text-muted)" }}>Department</div>
                      <div style={{ fontSize: 13, fontWeight: 600, color: "var(--text-strong)", marginTop: 2 }}>{String(deptName)}</div>
                    </div>
                    <div>
                      <div style={{ fontSize: 11, color: "var(--text-muted)" }}>Designation</div>
                      <div style={{ fontSize: 13, fontWeight: 600, color: "var(--text-strong)", marginTop: 2 }}>{String(desigName)}</div>
                    </div>
                    <div>
                      <div style={{ fontSize: 11, color: "var(--text-muted)" }}>Branch / Location</div>
                      <div style={{ fontSize: 13, fontWeight: 600, color: "var(--text-strong)", marginTop: 2 }}>{String(locName)}</div>
                    </div>
                    <div>
                      <div style={{ fontSize: 11, color: "var(--text-muted)" }}>Joining Date</div>
                      <div style={{ fontSize: 13, fontWeight: 600, color: "var(--text-strong)", marginTop: 2 }}>
                        {emp.joining_date ? new Intl.DateTimeFormat("en-IN", { dateStyle: "long" }).format(new Date(String(emp.joining_date))) : "—"}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Contact information */}
                <div style={{ background: "var(--bg)", borderRadius: "var(--radius-md)", padding: 18, border: "1px solid var(--border)" }}>
                  <div style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", color: "var(--text-muted)", marginBottom: 14 }}>
                    Contact & Portal
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                    <div>
                      <div style={{ fontSize: 11, color: "var(--text-muted)" }}>Official Work Email</div>
                      <div style={{ fontSize: 13, fontWeight: 600, color: "var(--text-strong)", marginTop: 2 }}>
                        {emp.official_email ? String(emp.official_email) : <span style={{ color: "var(--text-subtle)" }}>Not configured</span>}
                      </div>
                    </div>
                    <div>
                      <div style={{ fontSize: 11, color: "var(--text-muted)" }}>Official Mobile</div>
                      <div style={{ fontSize: 13, fontWeight: 600, color: "var(--text-strong)", marginTop: 2 }}>
                        {emp.official_mobile ? String(emp.official_mobile) : <span style={{ color: "var(--text-subtle)" }}>Not configured</span>}
                      </div>
                    </div>
                    <div>
                      <div style={{ fontSize: 11, color: "var(--text-muted)" }}>Personal Email</div>
                      <div style={{ fontSize: 13, fontWeight: 600, color: "var(--text-strong)", marginTop: 2 }}>
                        {emp.personal_email ? String(emp.personal_email) : <span style={{ color: "var(--text-subtle)" }}>—</span>}
                      </div>
                    </div>
                    <div>
                      <div style={{ fontSize: 11, color: "var(--text-muted)" }}>Personal Mobile</div>
                      <div style={{ fontSize: 13, fontWeight: 600, color: "var(--text-strong)", marginTop: 2 }}>
                        {emp.personal_mobile ? String(emp.personal_mobile) : <span style={{ color: "var(--text-subtle)" }}>—</span>}
                      </div>
                    </div>
                    <div>
                      <div style={{ fontSize: 11, color: "var(--text-muted)" }}>Portal Access Status</div>
                      <div style={{ marginTop: 2 }}>
                        <StatusBadge
                          status={loginStatus.hasLogin ? "ACTIVE" : "INACTIVE"}
                          customLabel={loginStatus.hasLogin ? "Login Active" : "No Login"}
                          size="sm"
                        />
                      </div>
                    </div>
                  </div>
                </div>

                {/* Personal particulars */}
                <div style={{ background: "var(--bg)", borderRadius: "var(--radius-md)", padding: 18, border: "1px solid var(--border)" }}>
                  <div style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", color: "var(--text-muted)", marginBottom: 14 }}>
                    Personal Details
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                    <div>
                      <div style={{ fontSize: 11, color: "var(--text-muted)" }}>Date of Birth</div>
                      <div style={{ fontSize: 13, fontWeight: 600, color: "var(--text-strong)", marginTop: 2 }}>
                        {emp.date_of_birth ? new Intl.DateTimeFormat("en-IN", { dateStyle: "medium" }).format(new Date(String(emp.date_of_birth))) : "—"}
                      </div>
                    </div>
                    <div>
                      <div style={{ fontSize: 11, color: "var(--text-muted)" }}>Gender</div>
                      <div style={{ fontSize: 13, fontWeight: 600, color: "var(--text-strong)", marginTop: 2 }}>{String(emp.gender ?? "—")}</div>
                    </div>
                    <div>
                      <div style={{ fontSize: 11, color: "var(--text-muted)" }}>Blood Group</div>
                      <div style={{ fontSize: 13, fontWeight: 600, color: "var(--text-strong)", marginTop: 2 }}>{String(emp.blood_group ?? "—")}</div>
                    </div>
                    <div>
                      <div style={{ fontSize: 11, color: "var(--text-muted)" }}>Marital Status</div>
                      <div style={{ fontSize: 13, fontWeight: 600, color: "var(--text-strong)", marginTop: 2 }}>{String(emp.marital_status ?? "—")}</div>
                    </div>
                    <div>
                      <div style={{ fontSize: 11, color: "var(--text-muted)" }}>Nationality</div>
                      <div style={{ fontSize: 13, fontWeight: 600, color: "var(--text-strong)", marginTop: 2 }}>{String(emp.nationality ?? "Indian")}</div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Custom fields display if any */}
              {customFields.length > 0 && (
                <div style={{ marginTop: 24, background: "var(--bg)", borderRadius: "var(--radius-md)", padding: 18, border: "1px solid var(--border)" }}>
                  <div style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", color: "var(--text-muted)", marginBottom: 14 }}>
                    Additional Organization Attributes
                  </div>
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 16 }}>
                    {customFields.map((cf) => (
                      <div key={cf.id}>
                        <div style={{ fontSize: 11, color: "var(--text-muted)" }}>{cf.name}</div>
                        <div style={{ fontSize: 13, fontWeight: 600, color: "var(--text-strong)", marginTop: 2 }}>
                          {customData[cf.id] != null && customData[cf.id] !== "" ? String(customData[cf.id]) : <span style={{ color: "var(--text-subtle)" }}>—</span>}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </>
  );
}
