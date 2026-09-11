"use client";

import { useCallback, useEffect, useState } from "react";
import DataTable from "@/components/DataTable";
import { fetchActiveAssetAssignments } from "@/features/assets/queries";

type Row = Record<string, unknown>;

/** Employee-facing list of company assets currently assigned to them. */
export default function MyAssetsPanel({ employeeId }: { employeeId: string }) {
  const [rows, setRows] = useState<Row[]>([]);

  const load = useCallback(async () => {
    const assignments = await fetchActiveAssetAssignments(employeeId);
    setRows(
      assignments.map((r) => {
        const a = r.assets as Record<string, unknown> | null;
        const cat = a?.asset_categories as Record<string, unknown> | null;
        return {
          category: cat?.name ?? "—",
          asset_code: a?.asset_code ?? "—",
          brand: a?.brand ?? "—",
          model: a?.model ?? "—",
          serial_number: a?.serial_number ?? "—",
          assigned_at: r.assigned_at,
        };
      })
    );
  }, [employeeId]);

  useEffect(() => { void load(); }, [load]);

  return (
    <div className="card">
      <div className="card-header"><div><h2>Assigned Company Assets</h2><p>{rows.length} items in possession</p></div></div>
      <DataTable rows={rows} columns={["category", "asset_code", "brand", "model", "serial_number", "assigned_at"]} />
    </div>
  );
}
