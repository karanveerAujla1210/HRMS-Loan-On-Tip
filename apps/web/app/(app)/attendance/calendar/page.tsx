"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useProfile } from "@/lib/useProfile";
import PageHeader from "@/components/PageHeader";
import SubNav from "@/components/SubNav";

const ATTENDANCE_NAV = [
  { href: "/attendance", label: "Daily Attendance" },
  { href: "/attendance/calendar", label: "Calendar", exact: true },
  { href: "/attendance/corrections", label: "Corrections" },
  { href: "/attendance/exceptions", label: "Exceptions & Geofence" },
];

type AttendanceRow = { attendance_date: string; status: string; display_name: string; employee_id: string };

function monthLabel(value: Date) {
  return value.toLocaleDateString("en-IN", { month: "long", year: "numeric" });
}

export default function AttendanceCalendarPage() {
  const { companyId } = useProfile();
  const [month, setMonth] = useState(() => new Date(new Date().getFullYear(), new Date().getMonth(), 1));
  const [rows, setRows] = useState<AttendanceRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!companyId) return;
    setLoading(true);
    setError(null);
    const from = `${month.getFullYear()}-${String(month.getMonth() + 1).padStart(2, "0")}-01`;
    const end = new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate();
    const to = `${month.getFullYear()}-${String(month.getMonth() + 1).padStart(2, "0")}-${String(end).padStart(2, "0")}`;
    const { data, error: queryError } = await supabase
      .from("v_attendance")
      .select("attendance_date,status,display_name,employee_id")
      .eq("company_id", companyId)
      .gte("attendance_date", from)
      .lte("attendance_date", to)
      .order("attendance_date");
    if (queryError) setError(queryError.message);
    setRows((data as AttendanceRow[]) ?? []);
    setLoading(false);
  }, [companyId, month]);

  useEffect(() => { void load(); }, [load]);

  const byDate = useMemo(() => {
    const result = new Map<string, Map<string, number>>();
    for (const row of rows) {
      const statuses = result.get(row.attendance_date) ?? new Map<string, number>();
      statuses.set(row.status, (statuses.get(row.status) ?? 0) + 1);
      result.set(row.attendance_date, statuses);
    }
    return result;
  }, [rows]);

  const firstDay = new Date(month.getFullYear(), month.getMonth(), 1).getDay();
  const daysInMonth = new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate();
  const cells = Array.from({ length: Math.ceil((firstDay + daysInMonth) / 7) * 7 }, (_, index) => {
    const day = index - firstDay + 1;
    if (day < 1 || day > daysInMonth) return null;
    return `${month.getFullYear()}-${String(month.getMonth() + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
  });

  return (
    <>
      <PageHeader title="Attendance Calendar" subtitle="Daily attendance by date" breadcrumbs={[{ label: "Dashboard", href: "/dashboard" }, { label: "Attendance Calendar" }]} />
      <SubNav items={ATTENDANCE_NAV} />
      <div className="page-body">
        {error && <div className="alert alert-error">{error}</div>}
        <div className="card">
          <div className="card-header">
            <button className="btn btn-secondary btn-sm" onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth() - 1, 1))}>← Previous</button>
            <h2 style={{ margin: 0 }}>{monthLabel(month)}</h2>
            <button className="btn btn-secondary btn-sm" onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth() + 1, 1))}>Next →</button>
          </div>
          {loading ? <div className="loading-spinner"><div className="spinner" /> Loading…</div> : (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 1, background: "var(--border)" }}>
              {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((day) => <div key={day} style={{ background: "var(--surface)", padding: 10, fontWeight: 600, fontSize: 12 }}>{day}</div>)}
              {cells.map((date, index) => {
                const statuses = date ? byDate.get(date) : undefined;
                return <div key={date ?? `empty-${index}`} style={{ minHeight: 100, padding: 10, background: date ? "var(--surface)" : "var(--bg)" }}>
                  {date && <><strong>{Number(date.slice(-2))}</strong>{statuses && Array.from(statuses.entries()).map(([status, count]) => <div key={status} style={{ fontSize: 11, marginTop: 6, color: status === "PRESENT" ? "var(--green)" : status === "ABSENT" ? "var(--red)" : "var(--amber)" }}>{status.replace(/_/g, " ")}: {count}</div>)}</>}
                </div>;
              })}
            </div>
          )}
        </div>
      </div>
    </>
  );
}