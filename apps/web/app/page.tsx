"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

type Metric = {
  label: string;
  value: string;
  sub?: string;
  trend?: string;
};

type AttendanceRow = {
  display_name: string;
  employee_code: string;
  department: string;
  location: string;
  status: string;
  check_in_at: string | null;
};

export default function Home() {
  const [active, setActive] = useState("Overview");
  const [checkedIn, setCheckedIn] = useState(false);
  const [metrics, setMetrics] = useState<Metric[]>([]);
  const [attendance, setAttendance] = useState<AttendanceRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      const [{ data: metricsData }, { data: attendanceData }] = await Promise.all([
        supabase.from("v_dashboard_metrics").select("*").single(),
        supabase.from("v_today_attendance").select("*").order("display_name").limit(20),
      ]);

      const m = metricsData as {
        active_employees: number;
        present_today: number;
        absent_today: number;
        late_today: number;
        half_day_today: number;
        on_leave_today: number;
        pending_leaves: number;
        pending_corrections: number;
        assigned_assets: number;
        available_assets: number;
        new_joiners_30d: number;
        on_notice: number;
        draft_payroll_runs: number;
        pending_payroll_approvals: number;
      } | null;

      if (m) {
        const total = m.active_employees || 0;
        const present = (m.present_today || 0) + (m.late_today || 0);
        const pct = total > 0 ? Math.round((present / total) * 100) : 0;
        setMetrics([
          { label: "Active employees", value: String(total), sub: `${m.new_joiners_30d || 0} new this month` },
          { label: "Today's attendance", value: `${pct}%`, trend: "Live", sub: `${present} of ${total} employees` },
          { label: "Absent today", value: String(m.absent_today || 0) },
          { label: "Late today", value: String(m.late_today || 0) },
          { label: "On leave today", value: String(m.on_leave_today || 0) },
          { label: "Half day today", value: String(m.half_day_today || 0) },
          { label: "Pending leaves", value: String(m.pending_leaves || 0), sub: "Requires review" },
          { label: "Pending corrections", value: String(m.pending_corrections || 0) },
          { label: "Assets assigned", value: String(m.assigned_assets || 0) },
          { label: "Assets available", value: String(m.available_assets || 0) },
          { label: "On notice", value: String(m.on_notice || 0) },
          { label: "Draft payroll", value: String(m.draft_payroll_runs || 0) },
        ]);
      }

      setAttendance((attendanceData as AttendanceRow[] | null) ?? []);
      setLoading(false);
    };

    load();
  }, []);

  const nav = ["Overview", "People", "Attendance", "Payroll", "Assets", "Reports"];

  const attendancePct = metrics.find(m => m.label === "Today's attendance")?.value || "0%";
  const absentCount = metrics.find(m => m.label === "Absent today")?.value || "0";
  const lateCount = metrics.find(m => m.label === "Late today")?.value || "0";
  const halfCount = metrics.find(m => m.label === "Half day today")?.value || "0";

  return <main className="shell">
    <aside>
      <div className="brand"><div className="mark">L</div><div><b>Loan On Tip</b><small>ACG Leasing Limited</small></div></div>
      <p className="workspace">WORKSPACE</p>
      <nav>{nav.map((item) => <button key={item} className={active === item ? "active" : ""} onClick={() => setActive(item)}><span>{item === "Overview" ? "▦" : item === "People" ? "♙" : item === "Attendance" ? "◷" : item === "Payroll" ? "₹" : item === "Assets" ? "▣" : "⌁"}</span>{item}</button>)}</nav>
      <div className="admin"><div className="avatar navy">AS</div><div><b>Arjun Singh</b><small>Super Admin</small></div><span>⌄</span></div>
    </aside>
    <section className="content">
      <header><div><p className="eyebrow">{new Date().toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long", year: "numeric" }).toUpperCase()}</p><h1>{active === "Overview" ? "Good morning, Arjun." : active}</h1><p className="sub">Here's how Loan On Tip is moving today.</p></div><div className="header-actions"><button className="icon">⌕</button><button className="icon bell">♧<i/></button><button className="primary">+ Add employee</button></div></header>
      {active === "Overview" ? <>
        <div className="stats">
          {loading ? (
            <article className="stat-card"><strong>Loading...</strong></article>
          ) : metrics.map((m) => (
            <article key={m.label} className="stat-card">
              <div className="stat-top">
                <span>{m.label}</span>
                {m.trend && <em className={m.trend === "Live" ? "blue" : "mint"}>{m.trend}</em>}
              </div>
              <strong>{m.value}</strong>
              {m.sub && <small>{m.sub}</small>}
            </article>
          ))}
        </div>
        <div className="grid">
          <article className="panel attendance"><div className="panel-title"><div><h2>Today's attendance</h2><p>Real-time check-in status</p></div><button className="link">View report →</button></div><div className="location-row"><button className="filter">All locations⌄</button><div className="legend"><i className="dot present"/> Present <i className="dot late"/> Late <i className="dot absent"/> Absent</div></div><div className="chart"><div className="donut"><div><b>{loading ? "..." : attendancePct}</b><small>Present</small></div></div><div className="counts"><p><i className="dot present"/><b>{absentCount}</b> Present</p><p><i className="dot late"/><b>{lateCount}</b> Late check-in</p><p><i className="dot absent"/><b>{absentCount}</b> Absent</p><p><i className="dot half"/><b>{halfCount}</b> Half day</p></div></div></article>
          <article className="panel quick"><div className="panel-title"><div><h2>Quick actions</h2><p>Common admin tasks</p></div></div><button>⊕ <span>Add a new employee</span><b>→</b></button><button>◷ <span>Review attendance exceptions</span><b>→</b></button><button>₹ <span>Prepare August payroll</span><b>→</b></button><button>▣ <span>Assign a company asset</span><b>→</b></button></article>
        </div>
        <article className="panel table-panel"><div className="panel-title"><div><h2>Team activity</h2><p>Latest employee attendance</p></div><button className="link">View all →</button></div><div className="table-wrap"><table><thead><tr><th>EMPLOYEE</th><th>LOCATION</th><th>STATUS</th><th>CHECK-IN</th><th/></tr></thead><tbody>{attendance.length === 0 ? <tr><td colSpan={5} className="empty">No attendance records yet.</td></tr> : attendance.map((r) => <tr key={r.employee_code + r.display_name}><td><div className="person"><span className="avatar">{r.employee_code.slice(-2)}</span><div><b>{r.display_name}</b><small>{r.employee_code}</small></div></div></td><td>{r.location}</td><td><span className={"pill " + (r.status || "absent").toLowerCase()}>{r.status}</span></td><td>{r.check_in_at ? new Date(r.check_in_at).toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" }) : "—"}</td><td>•••</td></tr>)}</tbody></table></div></article>
      </> : <article className="panel module"><span className="module-icon">{active === "Payroll" ? "₹" : active === "Assets" ? "▣" : "◷"}</span><h2>{active} workspace</h2><p>This module is ready to connect to the Supabase schema included with this starter.</p><button className="primary">Open {active}</button></article>}
      <button className={'mobile-checkin ' + (checkedIn ? "done" : "")} onClick={() => setCheckedIn(!checkedIn)}>{checkedIn ? "✓ Checked in · 09:06 AM" : "◉ Employee demo: Check in"}</button>
    </section>
  </main>;
}
