"use client";

import { useCallback, useEffect, useState } from "react";
import DataTable from "@/components/DataTable";
import RegularizationModal from "@/features/attendance/components/RegularizationModal";
import { fetchMyAttendanceHistory } from "@/features/attendance/queries";

type Row = Record<string, unknown>;

/** Employee-facing "my attendance this month" table with regularization. */
export default function MyAttendancePanel({ employeeId, refreshKey }: { employeeId: string; refreshKey: number }) {
  const [rows, setRows] = useState<Row[]>([]);
  const [correctionRow, setCorrectionRow] = useState<Row | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const load = useCallback(async () => {
    setRows(await fetchMyAttendanceHistory(employeeId));
  }, [employeeId]);

  useEffect(() => { void load(); }, [load, refreshKey]);

  return (
    <>
      {message && <div className={`alert ${message.startsWith("Error") ? "alert-error" : "alert-success"}`}>{message}</div>}

      <div className="card">
        <div className="card-header"><div><h2>This Month&apos;s Attendance</h2><p>{rows.length} records</p></div></div>
        <DataTable
          rows={rows}
          columns={["attendance_date", "status", "check_in_at", "check_out_at", "worked_minutes"]}
          action={(row) => (
            <button className="btn btn-sm btn-secondary" onClick={() => setCorrectionRow(row)}>
              📝 Regularize
            </button>
          )}
        />
      </div>

      {correctionRow && (
        <RegularizationModal
          row={correctionRow}
          onClose={() => setCorrectionRow(null)}
          onSubmitted={(msg) => { setMessage(msg); setCorrectionRow(null); if (!msg.startsWith("Error")) void load(); }}
        />
      )}
    </>
  );
}
