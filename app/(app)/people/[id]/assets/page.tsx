"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import PageHeader from "@/components/PageHeader";
import DataTable from "@/components/DataTable";
import EmployeeSubNav from "@/components/EmployeeSubNav";

type Row = Record<string, unknown>;

export default function EmployeeAssetsPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [empName, setEmpName] = useState("");
  const [assets, setAssets] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    const [empRes, assetsRes] = await Promise.all([
      supabase.from("employees").select("display_name").eq("id", id).single(),
      supabase.from("asset_assignments")
        .select("id,status,assigned_at,returned_at,assets(asset_code,model,serial_number,mobile_number,condition,asset_categories(name))")
        .eq("employee_id", id)
        .order("assigned_at", { ascending: false }),
    ]);
    setEmpName(String(empRes.data?.display_name ?? "Employee"));
    const mapped = ((assetsRes.data ?? []) as Record<string, unknown>[]).map((r) => {
      const a = r.assets as Record<string, unknown> | null;
      const cat = a?.asset_categories as Record<string, unknown> | null;
      return {
        category:      cat?.name ?? "—",
        asset_code:    a?.asset_code ?? "—",
        model:         a?.model ?? "—",
        serial_number: a?.serial_number ?? "—",
        mobile_number: a?.mobile_number ?? "—",
        condition:     a?.condition ?? "—",
        status:        r.status,
        assigned_at:   r.assigned_at,
        returned_at:   r.returned_at,
      };
    });
    setAssets(mapped as Row[]);
    setLoading(false);
  }, [id]);

  useEffect(() => { void load(); }, [load]);

  return (
    <>
      <PageHeader
        title={`${empName} — Assets`}
        subtitle="Assigned and returned company assets"
        breadcrumbs={[
          { label: "Dashboard", href: "/dashboard" },
          { label: "People", href: "/people" },
          { label: empName, href: `/people/${id}` },
          { label: "Assets" },
        ]}
        actions={
          <button className="btn btn-secondary btn-sm" onClick={() => router.push(`/people/${id}`)}>
            ← Employee Profile
          </button>
        }
      />

      <EmployeeSubNav employeeId={id} />

      <div className="page-body">
        <div className="card">
          {loading ? (
            <div className="loading-spinner"><div className="spinner" /> Loading…</div>
          ) : (
            <DataTable
              rows={assets}
              columns={["category","asset_code","model","serial_number","mobile_number","condition","status","assigned_at","returned_at"]}
            />
          )}
        </div>
      </div>
    </>
  );
}
