"use client";

import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useProfile } from "@/lib/useProfile";
import PageHeader from "@/components/PageHeader";
import DataTable from "@/components/DataTable";

type Row = Record<string, unknown>;
type Tab = "attendance" | "leave" | "payslips" | "assets" | "expenses" | "helpdesk";

function today() { return new Date().toISOString().slice(0, 10); }
function monthStart() { const d = new Date(); d.setDate(1); return d.toISOString().slice(0, 10); }

export default function SelfServicePage() {
  const { employeeId, companyId } = useProfile();
  const [tab, setTab] = useState<Tab>("attendance");

  // Attendance
  const [todayAtt, setTodayAtt] = useState<Row | null>(null);
  const [attRows, setAttRows] = useState<Row[]>([]);
  const [checkingIn, setCheckingIn] = useState(false);
  const [checkingOut, setCheckingOut] = useState(false);
  const [attMsg, setAttMsg] = useState<string | null>(null);

  // Leave
  const [leaveTypes, setLeaveTypes] = useState<Row[]>([]);
  const [myLeaves, setMyLeaves] = useState<Row[]>([]);
  const [leaveBalances, setLeaveBalances] = useState<Row[]>([]);
  const [showLeaveForm, setShowLeaveForm] = useState(false);
  const [submittingLeave, setSubmittingLeave] = useState(false);
  const [leaveMsg, setLeaveMsg] = useState<string | null>(null);

  // Payslips
  const [payslips, setPayslips] = useState<Row[]>([]);

  // Assets
  const [myAssets, setMyAssets] = useState<Row[]>([]);

  // Expenses
  const [expenses, setExpenses] = useState<Row[]>([]);
  const [showExpenseForm, setShowExpenseForm] = useState(false);
  const [submittingExpense, setSubmittingExpense] = useState(false);
  const [expenseMsg, setExpenseMsg] = useState<string | null>(null);

  // Helpdesk
  const [tickets, setTickets] = useState<Row[]>([]);
  const [showTicketForm, setShowTicketForm] = useState(false);
  const [submittingTicket, setSubmittingTicket] = useState(false);
  const [ticketMsg, setTicketMsg] = useState<string | null>(null);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!employeeId || !companyId) { setLoading(false); return; }
    setLoading(true);
    setError(null);

    const [
      attTodayRes, attHistRes, leaveTypesRes, myLeavesRes, balancesRes,
      payslipsRes, assetsRes, expensesRes, ticketsRes
    ] = await Promise.all([
      supabase.from("attendance").select("*").eq("employee_id", employeeId).eq("attendance_date", today()).maybeSingle(),
      supabase.from("attendance").select("attendance_date,status,check_in_at,check_out_at,worked_minutes").eq("employee_id", employeeId).gte("attendance_date", monthStart()).order("attendance_date", { ascending: false }),
      supabase.from("leave_types").select("id,name,code").eq("company_id", companyId).eq("is_active", true),
      supabase.from("leave_requests").select("id,from_date,to_date,total_days,status,submitted_at,leave_types(name)").eq("employee_id", employeeId).order("submitted_at", { ascending: false }).limit(50),
      supabase.from("leave_balances").select("closing_balance,leave_types(name)").eq("employee_id", employeeId).eq("year", new Date().getFullYear()),
      supabase.from("payslips").select("id,payslip_number,gross_salary,deductions,net_salary,generated_at,payroll_runs(payroll_month,payroll_year)").eq("employee_id", employeeId).order("generated_at", { ascending: false }).limit(24),
      supabase.from("asset_assignments").select("id,status,assigned_at,assets(asset_code,brand,model,serial_number,asset_categories(name))").eq("employee_id", employeeId).eq("status", "ACTIVE"),
      supabase.from("expenses").select("*").eq("employee_id", employeeId).order("submitted_at", { ascending: false }).limit(50),
      supabase.from("helpdesk_tickets").select("*").eq("employee_id", employeeId).order("created_at", { ascending: false }).limit(50),
    ]);

    if (attTodayRes.error) setError(attTodayRes.error.message);
    setTodayAtt(attTodayRes.data as Row | null);
    setAttRows((attHistRes.data as Row[]) ?? []);
    setLeaveTypes((leaveTypesRes.data as Row[]) ?? []);

    const leaves = ((myLeavesRes.data ?? []) as Record<string, unknown>[]).map((r) => ({
      ...r,
      leave_type: (r.leave_types as Record<string, unknown> | null)?.name ?? "—",
    }));
    setMyLeaves(leaves as Row[]);

    const balances = ((balancesRes.data ?? []) as Record<string, unknown>[]).map((r) => ({
      leave_type: (r.leave_types as Record<string, unknown> | null)?.name ?? "—",
      balance: r.closing_balance,
    }));
    setLeaveBalances(balances as Row[]);

    const slips = ((payslipsRes.data ?? []) as Record<string, unknown>[]).map((r) => {
      const run = r.payroll_runs as Record<string, unknown> | null;
      return { ...r, period: run ? `${run.payroll_year}/${String(run.payroll_month).padStart(2, "0")}` : "—" };
    });
    setPayslips(slips as Row[]);

    const assets = ((assetsRes.data ?? []) as Record<string, unknown>[]).map((r) => {
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
    });
    setMyAssets(assets as Row[]);

    setExpenses((expensesRes.data as Row[]) ?? []);
    setTickets((ticketsRes.data as Row[]) ?? []);
    setLoading(false);
  }, [employeeId, companyId]);

  useEffect(() => { void load(); }, [load]);

  // Attendance Check-in
  async function handleCheckIn() {
    setCheckingIn(true);
    setAttMsg(null);
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const res = await fetch("/api/attendance/check-in", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            latitude: pos.coords.latitude,
            longitude: pos.coords.longitude,
            accuracy_m: pos.coords.accuracy,
            device_time: new Date().toISOString(),
            idempotency_key: `checkin-${employeeId}-${today()}`,
          }),
        });
        const json = await res.json() as { error?: string; data?: { status: string; is_exception: boolean } };
        if (json.error) { setAttMsg(`Error: ${json.error}`); }
        else {
          setAttMsg(`Checked in — ${json.data?.status}${json.data?.is_exception ? " (exception raised for review)" : ""}`);
          void load();
        }
        setCheckingIn(false);
      },
      (err) => { setAttMsg(`Location error: ${err.message}`); setCheckingIn(false); },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  }

  // Attendance Check-out
  async function handleCheckOut() {
    setCheckingOut(true);
    setAttMsg(null);
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const res = await fetch("/api/attendance/check-out", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            latitude: pos.coords.latitude,
            longitude: pos.coords.longitude,
            accuracy_m: pos.coords.accuracy,
            device_time: new Date().toISOString(),
          }),
        });
        const json = await res.json() as { error?: string; data?: { worked_minutes: number; status: string } };
        if (json.error) { setAttMsg(`Error: ${json.error}`); }
        else {
          const hrs = Math.floor((json.data?.worked_minutes ?? 0) / 60);
          const mins = (json.data?.worked_minutes ?? 0) % 60;
          setAttMsg(`Checked out — ${hrs}h ${mins}m worked (${json.data?.status})`);
          void load();
        }
        setCheckingOut(false);
      },
      (err) => { setAttMsg(`Location error: ${err.message}`); setCheckingOut(false); },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  }

  // Submit Leave
  async function submitLeave(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!employeeId) return;
    setSubmittingLeave(true);
    setLeaveMsg(null);
    const fd = new FormData(e.currentTarget);
    const from = fd.get("from_date") as string;
    const to = fd.get("to_date") as string;
    const days = Math.max(1, Math.round((new Date(to).getTime() - new Date(from).getTime()) / 86400000) + 1);

    const { error } = await supabase.from("leave_requests").insert({
      employee_id: employeeId,
      leave_type_id: fd.get("leave_type_id"),
      from_date: from,
      to_date: to,
      total_days: days,
      reason: fd.get("reason") || null,
      status: "PENDING",
    });

    if (error) { setLeaveMsg(`Error: ${error.message}`); }
    else { setLeaveMsg("Leave request submitted."); setShowLeaveForm(false); void load(); }
    setSubmittingLeave(false);
  }

  // Submit Expense Claim
  async function submitExpense(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!employeeId || !companyId) return;
    setSubmittingExpense(true);
    setExpenseMsg(null);
    const fd = new FormData(e.currentTarget);

    const { error } = await supabase.from("expenses").insert({
      company_id: companyId,
      employee_id: employeeId,
      expense_date: fd.get("expense_date"),
      category: fd.get("category"),
      amount: Number(fd.get("amount")),
      description: fd.get("description"),
      receipt_path: fd.get("receipt_path") || null,
      status: "PENDING",
    });

    if (error) { setExpenseMsg(`Error: ${error.message}`); }
    else { setExpenseMsg("Expense claim submitted for approval."); setShowExpenseForm(false); void load(); }
    setSubmittingExpense(false);
  }

  // Submit Helpdesk Ticket
  async function submitTicket(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!employeeId || !companyId) return;
    setSubmittingTicket(true);
    setTicketMsg(null);
    const fd = new FormData(e.currentTarget);

    const { error } = await supabase.from("helpdesk_tickets").insert({
      company_id: companyId,
      employee_id: employeeId,
      category: fd.get("category"),
      subject: fd.get("subject"),
      description: fd.get("description"),
      priority: fd.get("priority") || "NORMAL",
      status: "OPEN",
    });

    if (error) { setTicketMsg(`Error: ${error.message}`); }
    else { setTicketMsg("Support ticket created. HR/IT team will review shortly."); setShowTicketForm(false); void load(); }
    setSubmittingTicket(false);
  }

  const hasCheckedIn = !!todayAtt?.check_in_at;
  const hasCheckedOut = !!todayAtt?.check_out_at;

  const TABS: { key: Tab; label: string }[] = [
    { key: "attendance", label: "Attendance" },
    { key: "leave",      label: "Leave" },
    { key: "payslips",   label: "Payslips" },
    { key: "assets",     label: "My Assets" },
    { key: "expenses",   label: "Expenses" },
    { key: "helpdesk",   label: "Helpdesk" },
  ];

  return (
    <>
      <PageHeader title="Self Service" subtitle="Your attendance, leave, payslips, assets, expense claims and support" />

      <div className="page-body">
        {error && <div className="alert alert-error">{error}</div>}

        {/* Check-in/out card */}
        <div className="card" style={{ marginBottom: 20, padding: 20 }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 12 }}>
            <div>
              <div style={{ fontWeight: 700, fontSize: 15 }}>Today — {today()}</div>
              <div style={{ fontSize: 13, color: "var(--text-3)", marginTop: 4 }}>
                {hasCheckedIn
                  ? `Checked in at ${new Date(String(todayAtt?.check_in_at)).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })}${hasCheckedOut ? ` · Checked out at ${new Date(String(todayAtt?.check_out_at)).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })}` : ""}`
                  : "Not checked in yet"}
              </div>
              {attMsg && <div style={{ marginTop: 8, fontSize: 13, color: attMsg.startsWith("Error") ? "var(--red)" : "var(--green)" }}>{attMsg}</div>}
            </div>
            <div style={{ display: "flex", gap: 10 }}>
              {!hasCheckedIn && (
                <button className="btn btn-primary" onClick={handleCheckIn} disabled={checkingIn}>
                  {checkingIn ? "Getting location…" : "✓ Check In"}
                </button>
              )}
              {hasCheckedIn && !hasCheckedOut && (
                <button className="btn btn-secondary" onClick={handleCheckOut} disabled={checkingOut}>
                  {checkingOut ? "Getting location…" : "✗ Check Out"}
                </button>
              )}
              {hasCheckedOut && <span className="pill pill-green">Day complete</span>}
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div style={{ display: "flex", gap: 8, marginBottom: 20, flexWrap: "wrap" }}>
          {TABS.map(({ key, label }) => (
            <button
              key={key}
              className={`btn btn-sm ${tab === key ? "btn-primary" : "btn-secondary"}`}
              onClick={() => setTab(key)}
            >
              {label}
            </button>
          ))}
        </div>

        {loading ? (
          <div className="loading-spinner"><div className="spinner" /> Loading…</div>
        ) : (
          <>
            {/* Attendance Tab */}
            {tab === "attendance" && (
              <div className="card">
                <div className="card-header"><div><h2>This Month's Attendance</h2><p>{attRows.length} records</p></div></div>
                <DataTable rows={attRows} columns={["attendance_date", "status", "check_in_at", "check_out_at", "worked_minutes"]} />
              </div>
            )}

            {/* Leave Tab */}
            {tab === "leave" && (
              <>
                {leaveMsg && <div className="alert alert-success">{leaveMsg}</div>}

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
                    <button className="btn btn-primary btn-sm" onClick={() => setShowLeaveForm(true)}>+ Request Leave</button>
                  </div>
                  <DataTable rows={myLeaves} columns={["leave_type", "from_date", "to_date", "total_days", "status", "submitted_at"]} />
                </div>

                {showLeaveForm && (
                  <div className="modal-backdrop">
                    <div className="modal">
                      <div className="modal-header">
                        <h2>Request Leave</h2>
                        <button className="btn btn-ghost btn-sm" onClick={() => setShowLeaveForm(false)}>✕</button>
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
                          <button type="button" className="btn btn-secondary" onClick={() => setShowLeaveForm(false)}>Cancel</button>
                          <button type="submit" className="btn btn-primary" disabled={submittingLeave}>
                            {submittingLeave ? "Submitting…" : "Submit Request"}
                          </button>
                        </div>
                      </form>
                    </div>
                  </div>
                )}
              </>
            )}

            {/* Payslips Tab */}
            {tab === "payslips" && (
              <div className="card">
                <div className="card-header"><div><h2>Monthly Payslips</h2><p>{payslips.length} records</p></div></div>
                <DataTable
                  rows={payslips}
                  columns={["period", "gross_salary", "deductions", "net_salary", "generated_at"]}
                  action={(row) => (
                    <a
                      href={`/payroll/payslip/${String(row.id)}`}
                      className="btn btn-sm btn-primary"
                    >
                      📄 View & Print
                    </a>
                  )}
                />
              </div>
            )}

            {/* Assets Tab */}
            {tab === "assets" && (
              <div className="card">
                <div className="card-header"><div><h2>Assigned Company Assets</h2><p>{myAssets.length} items in possession</p></div></div>
                <DataTable rows={myAssets} columns={["category", "asset_code", "brand", "model", "serial_number", "assigned_at"]} />
              </div>
            )}

            {/* Expenses Tab */}
            {tab === "expenses" && (
              <>
                {expenseMsg && <div className="alert alert-success">{expenseMsg}</div>}
                <div className="card">
                  <div className="card-header">
                    <div>
                      <h2>Reimbursements & Claims</h2>
                      <p>{expenses.length} claims submitted</p>
                    </div>
                    <button className="btn btn-primary btn-sm" onClick={() => setShowExpenseForm(true)}>+ Claim Expense</button>
                  </div>
                  <DataTable
                    rows={expenses}
                    columns={["expense_date", "category", "amount", "description", "status", "submitted_at"]}
                  />
                </div>

                {showExpenseForm && (
                  <div className="modal-backdrop">
                    <div className="modal" style={{ maxWidth: 480 }}>
                      <div className="modal-header">
                        <h2>Submit Expense Claim</h2>
                        <button className="btn btn-ghost btn-sm" onClick={() => setShowExpenseForm(false)}>✕</button>
                      </div>
                      <form onSubmit={submitExpense}>
                        <div className="modal-body">
                          <div className="form-row">
                            <div className="form-group">
                              <label>Expense Date *</label>
                              <input name="expense_date" type="date" required defaultValue={today()} />
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
                          <button type="button" className="btn btn-secondary" onClick={() => setShowExpenseForm(false)}>Cancel</button>
                          <button type="submit" className="btn btn-primary" disabled={submittingExpense}>
                            {submittingExpense ? "Submitting…" : "Submit Claim"}
                          </button>
                        </div>
                      </form>
                    </div>
                  </div>
                )}
              </>
            )}

            {/* Helpdesk Tab */}
            {tab === "helpdesk" && (
              <>
                {ticketMsg && <div className="alert alert-success">{ticketMsg}</div>}
                <div className="card">
                  <div className="card-header">
                    <div>
                      <h2>HR & IT Support Tickets</h2>
                      <p>{tickets.length} tickets raised</p>
                    </div>
                    <button className="btn btn-primary btn-sm" onClick={() => setShowTicketForm(true)}>+ Raise Support Ticket</button>
                  </div>
                  <DataTable
                    rows={tickets}
                    columns={["category", "subject", "priority", "status", "created_at"]}
                  />
                </div>

                {showTicketForm && (
                  <div className="modal-backdrop">
                    <div className="modal" style={{ maxWidth: 500 }}>
                      <div className="modal-header">
                        <h2>Raise Support Ticket</h2>
                        <button className="btn btn-ghost btn-sm" onClick={() => setShowTicketForm(false)}>✕</button>
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
                          <button type="button" className="btn btn-secondary" onClick={() => setShowTicketForm(false)}>Cancel</button>
                          <button type="submit" className="btn btn-primary" disabled={submittingTicket}>
                            {submittingTicket ? "Submitting…" : "Raise Ticket"}
                          </button>
                        </div>
                      </form>
                    </div>
                  </div>
                )}
              </>
            )}
          </>
        )}
      </div>
    </>
  );
}
