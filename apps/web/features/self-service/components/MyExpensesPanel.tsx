"use client";

import { useCallback, useEffect, useState } from "react";
import DataTable from "@/components/DataTable";
import { fetchMyExpenses } from "@/features/self-service/queries";
import { todayISO } from "@/utils/date";

/** Employee-facing expense claims with submit modal. */
export default function MyExpensesPanel({ employeeId }: { employeeId: string }) {
  const [expenses, setExpenses] = useState<Record<string, unknown>[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const load = useCallback(async () => {
    setExpenses(await fetchMyExpenses(employeeId));
  }, [employeeId]);

  useEffect(() => { void load(); }, [load]);

  async function submitExpense(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSubmitting(true);
    setMessage(null);
    const fd = new FormData(e.currentTarget);

    const res = await fetch("/api/expenses", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        expense_date: fd.get("expense_date"),
        category: fd.get("category"),
        amount: Number(fd.get("amount")),
        description: fd.get("description"),
        receipt_path: fd.get("receipt_path") || null,
      }),
    });
    const json = (await res.json()) as { error?: string };
    if (json.error) { setMessage(`Error: ${json.error}`); }
    else { setMessage("Expense claim submitted for approval."); setShowForm(false); void load(); }
    setSubmitting(false);
  }

  return (
    <>
      {message && <div className={`alert ${message.startsWith("Error") ? "alert-error" : "alert-success"}`}>{message}</div>}
      <div className="card">
        <div className="card-header">
          <div>
            <h2>Reimbursements & Claims</h2>
            <p>{expenses.length} claims submitted</p>
          </div>
          <button className="btn btn-primary btn-sm" onClick={() => setShowForm(true)}>+ Claim Expense</button>
        </div>
        <DataTable
          rows={expenses}
          columns={["expense_date", "category", "amount", "description", "status", "submitted_at"]}
        />
      </div>

      {showForm && (
        <div className="modal-backdrop">
          <div className="modal" style={{ maxWidth: 480 }}>
            <div className="modal-header">
              <h2>Submit Expense Claim</h2>
              <button className="btn btn-ghost btn-sm" onClick={() => setShowForm(false)}>✕</button>
            </div>
            <form onSubmit={submitExpense}>
              <div className="modal-body">
                <div className="form-row">
                  <div className="form-group">
                    <label>Expense Date *</label>
                    <input name="expense_date" type="date" required defaultValue={todayISO()} />
                  </div>
                  <div className="form-group">
                    <label>Category *</label>
                    <select name="category" required defaultValue="TRAVEL">
                      <option value="TRAVEL">Travel / Cab / Train</option>
                      <option value="FOOD">Food & Meals</option>
                      <option value="FUEL">Fuel / Conveyance</option>
                      <option value="OFFICE_SUPPLIES">Office Supplies / Stationary</option>
                      <option value="CLIENT_MEETING">Client Meeting Expense</option>
                      <option value="OTHER">Other Expense</option>
                    </select>
                  </div>
                </div>
                <div className="form-group">
                  <label>Claim Amount (₹) *</label>
                  <input name="amount" type="number" min={1} step="any" required placeholder="e.g. 1250" />
                </div>
                <div className="form-group">
                  <label>Bill Description & Business Purpose *</label>
                  <textarea name="description" rows={2} required placeholder="State purpose of expenditure..." />
                </div>
                <div className="form-group">
                  <label>Receipt URL / Document Link</label>
                  <input name="receipt_path" placeholder="Cloud URL or file reference" />
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setShowForm(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary" disabled={submitting}>
                  {submitting ? "Submitting…" : "Submit Claim"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
