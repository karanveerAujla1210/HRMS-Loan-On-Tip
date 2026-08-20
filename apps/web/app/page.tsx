"use client";

import { useState } from "react";

const people = [
  ["AK", "Aman Kumar", "Loan Officer", "Delhi", "Present", "09:06 AM"],
  ["SP", "Sneha Patel", "Credit Analyst", "Mumbai", "Late", "10:18 AM"],
  ["RV", "Rohit Verma", "Collection Executive", "Noida", "Half day", "09:12 AM"],
  ["NK", "Nisha Kapoor", "Operations Manager", "Gurugram", "On leave", "—"],
];

const nav = ["Overview", "People", "Attendance", "Payroll", "Assets", "Reports"];

export default function Home() {
  const [active, setActive] = useState("Overview");
  const [checkedIn, setCheckedIn] = useState(false);
  return <main className="shell">
    <aside>
      <div className="brand"><div className="mark">L</div><div><b>Loan On Tip</b><small>ACG Leasing Limited</small></div></div>
      <p className="workspace">WORKSPACE</p>
      <nav>{nav.map((item) => <button key={item} className={active === item ? "active" : ""} onClick={() => setActive(item)}><span>{item === "Overview" ? "▦" : item === "People" ? "♙" : item === "Attendance" ? "◷" : item === "Payroll" ? "₹" : item === "Assets" ? "▣" : "⌁"}</span>{item}</button>)}</nav>
      <div className="admin"><div className="avatar navy">AS</div><div><b>Arjun Singh</b><small>Super Admin</small></div><span>⌄</span></div>
    </aside>
    <section className="content">
      <header><div><p className="eyebrow">THURSDAY, 20 AUGUST 2026</p><h1>{active === "Overview" ? "Good morning, Arjun." : active}</h1><p className="sub">Here’s how Loan On Tip is moving today.</p></div><div className="header-actions"><button className="icon">⌕</button><button className="icon bell">♧<i/></button><button className="primary">+ Add employee</button></div></header>
      {active === "Overview" ? <>
        <div className="stats">
          <article><div className="stat-top"><span>Active employees</span><em className="mint">+4.2%</em></div><strong>248</strong><small>12 joined this month</small></article>
          <article><div className="stat-top"><span>Today’s attendance</span><em className="blue">Live</em></div><strong>91.5%</strong><small>227 of 248 employees</small><div className="bar"><i style={{width:"91.5%"}}/></div></article>
          <article><div className="stat-top"><span>Open leave requests</span><em className="amber">5 pending</em></div><strong>18</strong><small>Requires manager review</small></article>
          <article><div className="stat-top"><span>Assets requiring action</span><em className="rose">3 due</em></div><strong>7</strong><small>2 unassigned · 5 returns</small></article>
        </div>
        <div className="grid">
          <article className="panel attendance"><div className="panel-title"><div><h2>Today’s attendance</h2><p>Real-time check-in status</p></div><button className="link">View report →</button></div><div className="location-row"><button className="filter">All locations⌄</button><div className="legend"><i className="dot present"/> Present <i className="dot late"/> Late <i className="dot absent"/> Absent</div></div><div className="chart"><div className="donut"><div><b>91.5%</b><small>Present</small></div></div><div className="counts"><p><i className="dot present"/><b>227</b> Present</p><p><i className="dot late"/><b>14</b> Late check-in</p><p><i className="dot absent"/><b>7</b> Absent</p><p><i className="dot half"/><b>3</b> Half day</p></div></div></article>
          <article className="panel quick"><div className="panel-title"><div><h2>Quick actions</h2><p>Common admin tasks</p></div></div><button>⊕ <span>Add a new employee</span><b>→</b></button><button>◷ <span>Review attendance exceptions</span><b>→</b></button><button>₹ <span>Prepare August payroll</span><b>→</b></button><button>▣ <span>Assign a company asset</span><b>→</b></button></article>
        </div>
        <article className="panel table-panel"><div className="panel-title"><div><h2>Team activity</h2><p>Latest employee attendance</p></div><button className="link">View all →</button></div><div className="table-wrap"><table><thead><tr><th>EMPLOYEE</th><th>LOCATION</th><th>STATUS</th><th>CHECK-IN</th><th/></tr></thead><tbody>{people.map(([initials, name, role, location, status, time]) => <tr key={name}><td><div className="person"><span className="avatar">{initials}</span><div><b>{name}</b><small>{role}</small></div></div></td><td>{location}</td><td><span className={'pill ' + status.replace(" ", "").toLowerCase()}>{status}</span></td><td>{time}</td><td>•••</td></tr>)}</tbody></table></div></article>
      </> : <article className="panel module"><span className="module-icon">{active === "Payroll" ? "₹" : active === "Assets" ? "▣" : "◷"}</span><h2>{active} workspace</h2><p>This module is ready to connect to the Supabase schema included with this starter.</p><button className="primary">Open {active}</button></article>}
      <button className={'mobile-checkin ' + (checkedIn ? "done" : "")} onClick={() => setCheckedIn(!checkedIn)}>{checkedIn ? "✓ Checked in · 09:06 AM" : "◉ Employee demo: Check in"}</button>
    </section>
  </main>;
}
