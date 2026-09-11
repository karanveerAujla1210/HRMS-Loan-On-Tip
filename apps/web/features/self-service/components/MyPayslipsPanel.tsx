"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import DataTable from "@/components/DataTable";
import { fetchMyPayslips } from "@/features/payroll/queries";

/** Employee-facing payslip history with links to the printable payslip. */
export default function MyPayslipsPanel({ employeeId }: { employeeId: string }) {
  const [payslips, setPayslips] = useState<Record<string, unknown>[]>([]);

  const load = useCallback(async () => {
    setPayslips(await fetchMyPayslips(employeeId));
  }, [employeeId]);

  useEffect(() => { void load(); }, [load]);

  return (
    <div className="card">
      <div className="card-header"><div><h2>Monthly Payslips</h2><p>{payslips.length} records</p></div></div>
      <DataTable
        rows={payslips}
        columns={["period", "gross_salary", "deductions", "net_salary", "generated_at"]}
        action={(row) => (
          <Link
            href={`/payroll/payslip/${String(row.id)}`}
            className="btn btn-sm btn-primary"
          >
            📄 View & Print
          </Link>
        )}
      />
    </div>
  );
}
