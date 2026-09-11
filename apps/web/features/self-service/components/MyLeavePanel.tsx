"use client";

import { useCallback, useEffect, useState } from "react";
import DataTable from "@/components/DataTable";
import {
  fetchActiveLeaveTypes,
  fetchMyLeaveBalances,
  fetchMyLeaveRequests,
} from "@/features/leave/queries";
import { currentYear } from "@/utils/date";

type Row = Record<string, unknown>;

/** Employee-facing leave tab: balances, request history, and apply form. */
export default function MyLeavePanel({ employeeId, companyId }: { employeeId: string; companyId: string }) {
  const [leaveTypes, setLeaveTypes] = useState<Row[]>([]);
  const [myLeaves, setMyLeaves] = useState<Row[]>([]);
  const [leaveBalances, setLeaveBalances] = useState<Row[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const load = useCallback(async () => {
    const [types, leaves, balances] = await Promise.all([
      fetchActiveLeaveTypes(companyId),
      fetchMyLeaveRequests(employeeId),
      fetchMyLeaveBalances(employeeId, currentYear()),
    ]);
    setLeaveTypes(types);
    setMyLeaves(leaves);
    setLeaveBalances(balances);
  }, [employeeId, companyId]);

  useEffect(() => { void load(); }, [load]);

  async function submitLeave(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSubmitting(true);
    setMessage(null);
    const fd = new FormData(e.currentTarget);

    const res = await fetch("/api/leaves", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        leave_type_id: fd.get("leave_type_id"),
        from_date: String(fd.get("from_date")),
        to_date: String(fd.get("to_date")),
        reason: fd.get("reason") || null,
      }),
    });
    const json = (await res.json()) as { error?: string };
    if (json.error) { setMessage(`Error: ${json.error}`); }
    else { setMessage("Leave request submitted."); setShowForm(false); void load(); }
    setSubmitting(false);
  }

  return (
    <>
      {message && <div className={`alert ${message.startsWith("Error") ? "alert-error" : "alert-success"}`}>{message}</div>}

      {leaveBalances.length > 0 && (
        <div className="stats-grid" style={{ marginBottom: 20 }}>
          {leaveBalances.map((b, i) => (
            <div className="stat-card" key={i}>
              <div className="stat-label">{String(b.leave_type)}</div>
              <div className="stat-value" style={{ fontSize: 24 }}>{Number(b.balance).toFixed(1)}</div>
              <div className="stat-sub">days remaining</div>
            </div>
          ))}
        </div>
      )}

      <div className="card">
        <div className="card-header">
          <div><h2>My Leave Requests</h2></div>
          <button className="btn btn-primary btn-sm" onClick={() => setShowForm(true)}>+ Request Leave</button>
        </div>
        <DataTable rows={myLeaves} columns={["leave_type", "from_date", "to_date", "total_days", "status", "submitted_at"]} />
      </div>

      {showForm && (
        <div className="modal-backdrop">
          <div className="modal">
            <div className="modal-header">
              <h2>Request Leave</h2>
              <button className="btn btn-ghost btn-sm" onClick={() => setShowForm(false)}>✕</button>
            </div>
            <form onSubmit={submitLeave}>
              <div className="modal-body">
                <div className="form-group">
                  <label>Leave Type *</label>
                  <select name="leave_type_id" required defaultValue="">
                    <option value="" disabled>Select type</option>
                    {leaveTypes.map((lt) => (
                      <option key={String(lt.id)} value={String(lt.id)}>{String(lt.name)}</option>
                    ))}
                  </select>
                </div>
                <div className="form-row">
                  <div className="form-group">
                    <label>From Date *</label>
                    <input name="from_date" type="date" required />
                  </div>
                  <div className="form-group">
                    <label>To Date *</label>
                    <input name="to_date" type="date" required />
                  </div>
                </div>
                <div className="form-group">
                  <label>Reason</label>
                  <textarea name="reason" rows={3} placeholder="Reason for leave…" />
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setShowForm(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary" disabled={submitting}>
                  {submitting ? "Submitting…" : "Submit Request"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
