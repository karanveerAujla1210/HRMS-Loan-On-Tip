"use client";

import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useProfile } from "@/lib/useProfile";
import PageHeader from "@/components/PageHeader";
import DataTable from "@/components/DataTable";

type Row = Record<string, unknown>;
type Tab = "attendance" | "leave" | "payslips" | "assets";

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

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!employeeId || !companyId) return;
    setLoading(true);
    setError(null);

    const [attTodayRes, attHistRes, leaveTypesRes, myLeavesRes, balancesRes, payslipsRes, assetsRes] = await Promise.all([
      supabase.from("attendance").select("*").eq("employee_id", employeeId).eq("attendance_date", today()).maybeSingle(),
      supabase.from("attendance").select("attendance_date,status,check_in_at,check_out_at,worked_minutes").eq("employee_id", employeeId).gte("attendance_date", monthStart()).order("attendance_date", { ascending: false }),
      supabase.from("leave_types").select("id,name,code").eq("company_id", companyId).eq("is_active", true),
      supabase.from("leave_requests").select("id,from_date,to_date,total_days,status,submitted_at,leave_types(name)").eq("employee_id", employeeId).order("submitted_at", { ascending: false }).limit(50),
      supabase.from("leave_balances").select("closing_balance,leave_types(name)").eq("employee_id", employeeId).eq("year", new Date().getFullYear()),
      supabase.from("payslips").select("payslip_number,gross_salary,deductions,net_salary,generated_at,payroll_runs(payroll_month,payroll_year)").eq("employee_id", employeeId).order("generated_at", { ascending: false }).limit(24),
      supabase.from("asset_assignments").select("id,status,assigned_at,assets(asset_code,brand,model,serial_number,asset_categories(name))").eq("employee_id", employeeId).eq("status", "ACTIVE"),
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
    setLoading(false);
  }, [employeeId, companyId]);

  useEffect(() => { void load(); }, [load]);

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

  const hasCheckedIn = !!todayAtt?.check_in_at;
  const hasCheckedOut = !!todayAtt?.check_out_at;

  const TABS: { key: Tab; label: string }[] = [
    { key: "attendance", label: "Attendance" },
    { key: "leave", label: "Leave" },
    { key: "payslips", label: "Payslips" },
    { key: "assets", label: "My Assets" },
  ];

  return (
    <>
      <PageHeader title="Self Service" subtitle="Your attendance, leave, payslips and assets" />

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
        <div style={{ display: "flex", gap: 8, marginBottom: 20 }}>
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
            {tab === "attendance" && (
              <div className="card">
                <div className="card-header"><div><h2>This month</h2><p>{attRows.length} records</p></div></div>
                <DataTable rows={attRows} columns={["attendance_date", "status", "check_in_at", "check_out_at", "worked_minutes"]} />
              </div>
            )}

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
                    <div><h2>My leave requests</h2></div>
                    <button className="btn btn-primary btn-sm" onClick={() => setShowLeaveForm(true)}>+ Request leave</button>
                  </div>
                  <DataTable rows={myLeaves} columns={["leave_type", "from_date", "to_date", "total_days", "status", "submitted_at"]} />
                </div>

                {showLeaveForm && (
                  <div className="modal-backdrop">
                    <div className="modal">
                      <div className="modal-header">
                        <h2>Request leave</h2>
                        <button className="btn btn-ghost btn-sm" onClick={() => setShowLeaveForm(false)}>✕</button>
                      </div>
                      <form onSubmit={submitLeave}>
                        <div className="modal-body">
                          <div className="form-group">
                            <label>Leave type *</label>
                            <select name="leave_type_id" required defaultValue="">
                              <option value="" disabled>Select type</option>
                              {leaveTypes.map((lt) => (
                                <option key={String(lt.id)} value={String(lt.id)}>{String(lt.name)}</option>
                              ))}
                            </select>
                          </div>
                          <div className="form-row">
                            <div className="form-group">
                              <label>From *</label>
                              <input name="from_date" type="date" required />
                            </div>
                            <div className="form-group">
                              <label>To *</label>
                              <input name="to_date" type="date" required />
                            </div>
                          </div>
                          <div className="form-group">
                            <label>Reason</label>
                            <textarea name="reason" rows={3} placeholder="Optional reason…" />
                          </div>
                        </div>
                        <div className="modal-footer">
                          <button type="button" className="btn btn-secondary" onClick={() => setShowLeaveForm(false)}>Cancel</button>
                          <button type="submit" className="btn btn-primary" disabled={submittingLeave}>
                            {submittingLeave ? "Submitting…" : "Submit request"}
                          </button>
                        </div>
                      </form>
                    </div>
                  </div>
                )}
              </>
            )}

            {tab === "payslips" && (
              <div className="card">
                <div className="card-header"><div><h2>Payslips</h2><p>{payslips.length} records</p></div></div>
                <DataTable rows={payslips} columns={["period", "gross_salary", "deductions", "net_salary", "generated_at"]} />
              </div>
            )}

            {tab === "assets" && (
              <div className="card">
                <div className="card-header"><div><h2>Assigned assets</h2><p>{myAssets.length} items</p></div></div>
                <DataTable rows={myAssets} columns={["category", "asset_code", "brand", "model", "serial_number", "assigned_at"]} />
              </div>
            )}
          </>
        )}
      </div>
    </>
  );
}
