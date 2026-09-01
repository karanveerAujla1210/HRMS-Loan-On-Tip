"use client";

export const dynamic = "force-dynamic";

import { useCallback, useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import PageHeader from "@/components/PageHeader";
import EmployeeSubNav from "@/components/EmployeeSubNav";

type Emp = Record<string, unknown>;

export default function IdCardPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [emp, setEmp] = useState<Emp | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase
      .from("v_employee_profile")
      .select("*")
      .eq("id", id)
      .single();
    setEmp(data as Emp);
    setLoading(false);
  }, [id]);

  useEffect(() => { void load(); }, [load]);

  if (loading) return <div className="loading-spinner" style={{ minHeight: "60vh" }}><div className="spinner" /> Loading…</div>;
  if (!emp) return <div className="page-body"><div className="alert alert-error">Employee not found.</div></div>;

  const empName = String(emp.display_name ?? "Employee");

  return (
    <>
      <PageHeader
        title={`${empName} — ID Card`}
        subtitle={String(emp.employee_code ?? "")}
        breadcrumbs={[
          { label: "Dashboard", href: "/dashboard" },
          { label: "People", href: "/people" },
          { label: empName, href: `/people/${id}` },
          { label: "ID Card" },
        ]}
        actions={
          <div style={{ display: "flex", gap: 8 }}>
            <button className="btn btn-secondary btn-sm" onClick={() => router.push(`/people/${id}`)}>← Employee Profile</button>
            <button className="btn btn-primary btn-sm" onClick={() => window.print()}>🖨 Print ID Card</button>
          </div>
        }
      />

      <EmployeeSubNav employeeId={id} />

      <div className="page-body" style={{ display: "flex", justifyContent: "center" }}>
        <div style={{
          width: 340, background: "#fff", borderRadius: 16,
          boxShadow: "0 8px 32px rgba(0,0,0,.15)", overflow: "hidden",
          border: "1px solid var(--border)",
        }}>
          {/* Header band */}
          <div style={{ background: "var(--brand)", padding: "20px 24px 16px", color: "#fff" }}>
            <div style={{ fontFamily: "Manrope, sans-serif", fontSize: 18, fontWeight: 800 }}>Loan On Tip</div>
            <div style={{ fontSize: 11, opacity: .8, marginTop: 2 }}>ACG Leasing Limited</div>
          </div>

          {/* Avatar + name */}
          <div style={{ padding: "20px 24px 0", display: "flex", alignItems: "center", gap: 16 }}>
            <div style={{
              width: 64, height: 64, borderRadius: "50%",
              background: "var(--brand-light)", color: "var(--brand)",
              display: "grid", placeItems: "center",
              fontSize: 22, fontWeight: 800, fontFamily: "Manrope, sans-serif",
              flexShrink: 0,
            }}>
              {String(emp.display_name ?? "?").slice(0, 2).toUpperCase()}
            </div>
            <div>
              <div style={{ fontFamily: "Manrope, sans-serif", fontSize: 16, fontWeight: 700, color: "var(--text)" }}>
                {String(emp.display_name ?? "")}
              </div>
              <div style={{ fontSize: 12, color: "var(--text-3)", marginTop: 2 }}>{String(emp.designation ?? "")}</div>
              <div style={{ fontSize: 11, color: "var(--text-4)", marginTop: 1 }}>{String(emp.department ?? "")}</div>
            </div>
          </div>

          {/* Details */}
          <div style={{ padding: "16px 24px 20px", display: "grid", gap: 10 }}>
            {[
              ["Employee ID",  emp.employee_code],
              ["Location",     emp.location],
              ["Work email",   emp.official_email],
              ["Mobile",       emp.official_mobile],
              ["Joining date", emp.joining_date],
              ["Blood group",  emp.blood_group],
            ].map(([label, val]) => val ? (
              <div key={String(label)} style={{ display: "flex", justifyContent: "space-between", fontSize: 12 }}>
                <span style={{ color: "var(--text-3)", fontWeight: 600 }}>{String(label)}</span>
                <span style={{ color: "var(--text)", fontWeight: 500 }}>{String(val)}</span>
              </div>
            ) : null)}
          </div>

          {/* Footer */}
          <div style={{ background: "var(--bg)", padding: "10px 24px", borderTop: "1px solid var(--border)", fontSize: 10, color: "var(--text-4)", textAlign: "center" }}>
            This card is the property of ACG Leasing Limited. If found, please return.
          </div>
        </div>
      </div>
    </>
  );
}
