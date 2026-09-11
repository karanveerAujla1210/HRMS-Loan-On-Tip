"use client";

import { useCallback, useEffect, useState } from "react";
import DataTable from "@/components/DataTable";
import { fetchMyHelpdeskTickets } from "@/features/self-service/queries";

/** Employee-facing HR & IT support tickets with raise-ticket modal. */
export default function MyHelpdeskPanel({ employeeId }: { employeeId: string }) {
  const [tickets, setTickets] = useState<Record<string, unknown>[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const load = useCallback(async () => {
    setTickets(await fetchMyHelpdeskTickets(employeeId));
  }, [employeeId]);

  useEffect(() => { void load(); }, [load]);

  async function submitTicket(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSubmitting(true);
    setMessage(null);
    const fd = new FormData(e.currentTarget);

    const res = await fetch("/api/helpdesk", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        category: fd.get("category"),
        subject: fd.get("subject"),
        description: fd.get("description"),
        priority: fd.get("priority") || "NORMAL",
      }),
    });
    const json = (await res.json()) as { error?: string };
    if (json.error) { setMessage(`Error: ${json.error}`); }
    else { setMessage("Support ticket created. HR/IT team will review shortly."); setShowForm(false); void load(); }
    setSubmitting(false);
  }

  return (
    <>
      {message && <div className={`alert ${message.startsWith("Error") ? "alert-error" : "alert-success"}`}>{message}</div>}
      <div className="card">
        <div className="card-header">
          <div>
            <h2>HR & IT Support Tickets</h2>
            <p>{tickets.length} tickets raised</p>
          </div>
          <button className="btn btn-primary btn-sm" onClick={() => setShowForm(true)}>+ Raise Support Ticket</button>
        </div>
        <DataTable
          rows={tickets}
          columns={["category", "subject", "priority", "status", "created_at"]}
        />
      </div>

      {showForm && (
        <div className="modal-backdrop">
          <div className="modal" style={{ maxWidth: 500 }}>
            <div className="modal-header">
              <h2>Raise Support Ticket</h2>
              <button className="btn btn-ghost btn-sm" onClick={() => setShowForm(false)}>✕</button>
            </div>
            <form onSubmit={submitTicket}>
              <div className="modal-body">
                <div className="form-row">
                  <div className="form-group">
                    <label>Department / Category *</label>
                    <select name="category" required defaultValue="HR">
                      <option value="HR">Human Resources (HR)</option>
                      <option value="PAYROLL">Payroll & Salary Issue</option>
                      <option value="IT">IT & Hardware / Software</option>
                      <option value="LEAVE">Leave & Attendance</option>
                      <option value="ADMIN">Admin & Facilities</option>
                    </select>
                  </div>
                  <div className="form-group">
                    <label>Priority</label>
                    <select name="priority" defaultValue="NORMAL">
                      <option value="LOW">Low</option>
                      <option value="NORMAL">Normal</option>
                      <option value="HIGH">High</option>
                      <option value="URGENT">Urgent</option>
                    </select>
                  </div>
                </div>
                <div className="form-group">
                  <label>Subject *</label>
                  <input name="subject" required placeholder="Brief summary of request..." />
                </div>
                <div className="form-group">
                  <label>Detailed Description *</label>
                  <textarea name="description" rows={3} required placeholder="Explain your request in detail..." />
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setShowForm(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary" disabled={submitting}>
                  {submitting ? "Submitting…" : "Raise Ticket"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
