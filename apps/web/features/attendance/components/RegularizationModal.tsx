"use client";

import { useState } from "react";

type CorrectionResult = { error?: string };

/** Modal to request an attendance regularization for a specific day. */
export default function RegularizationModal({
  row,
  onClose,
  onSubmitted,
}: {
  row: Record<string, unknown>;
  onClose: () => void;
  onSubmitted: (message: string) => void;
}) {
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSubmitting(true);
    const fd = new FormData(e.currentTarget);
    const date = String(row.attendance_date);

    // Construct ISO datetime from time inputs (or keep undefined if empty)
    const ciTime = fd.get("new_check_in") ? String(fd.get("new_check_in")) : null;
    const coTime = fd.get("new_check_out") ? String(fd.get("new_check_out")) : null;
    const ciIso = ciTime ? new Date(`${date}T${ciTime}:00`).toISOString() : undefined;
    const coIso = coTime ? new Date(`${date}T${coTime}:00`).toISOString() : undefined;

    const res = await fetch("/api/attendance/correction", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        attendance_id: row.id,
        new_check_in: ciIso,
        new_check_out: coIso,
        reason: fd.get("reason"),
      }),
    });
    const json = (await res.json()) as CorrectionResult;
    if (json.error) {
      onSubmitted(`Error: ${json.error}`);
    } else {
      onSubmitted("Regularization request submitted for approval.");
    }
    setSubmitting(false);
  }

  return (
    <div className="modal-backdrop">
      <div className="modal">
        <div className="modal-header">
          <h2>Request Regularization</h2>
          <button className="btn btn-ghost btn-sm" onClick={onClose}>✕</button>
        </div>
        <form onSubmit={handleSubmit}>
          <div className="modal-body">
            <p style={{ marginBottom: 15, fontSize: 14 }}>
              Date: <strong>{String(row.attendance_date)}</strong>
            </p>
            <div className="form-row">
              <div className="form-group">
                <label>Correct Check-In Time</label>
                <input name="new_check_in" type="time" />
              </div>
              <div className="form-group">
                <label>Correct Check-Out Time</label>
                <input name="new_check_out" type="time" />
              </div>
            </div>
            <div className="form-group">
              <label>Reason / Remarks *</label>
              <textarea name="reason" rows={3} required placeholder="Why are you requesting this correction?" />
            </div>
          </div>
          <div className="modal-footer">
            <button type="button" className="btn btn-secondary" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn btn-primary" disabled={submitting}>
              {submitting ? "Submitting…" : "Submit Request"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
