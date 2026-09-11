"use client";

export const dynamic = "force-dynamic";

import { useState } from "react";
import PageHeader from "@/components/PageHeader";
import CheckInOutCard from "@/features/attendance/components/CheckInOutCard";
import MyAttendancePanel from "@/features/self-service/components/MyAttendancePanel";
import MyAssetsPanel from "@/features/self-service/components/MyAssetsPanel";
import MyExpensesPanel from "@/features/self-service/components/MyExpensesPanel";
import MyHelpdeskPanel from "@/features/self-service/components/MyHelpdeskPanel";
import MyLeavePanel from "@/features/self-service/components/MyLeavePanel";
import MyPayslipsPanel from "@/features/self-service/components/MyPayslipsPanel";
import { useProfile } from "@/hooks/useProfile";

type Tab = "attendance" | "leave" | "payslips" | "assets" | "expenses" | "helpdesk";

const TABS: { key: Tab; label: string }[] = [
  { key: "attendance", label: "Attendance" },
  { key: "leave",      label: "Leave" },
  { key: "payslips",   label: "Payslips" },
  { key: "assets",     label: "My Assets" },
  { key: "expenses",   label: "Expenses" },
  { key: "helpdesk",   label: "Helpdesk" },
];

export default function SelfServicePage() {
  const { employeeId, companyId } = useProfile();
  const [tab, setTab] = useState<Tab>("attendance");
  // Bumped after a check-in/out so the attendance panel re-reads the day's record.
  const [attendanceRefreshKey, setAttendanceRefreshKey] = useState(0);

  return (
    <>
      <PageHeader
        title="Self Service"
        subtitle="Your attendance, leave, payslips, assets, expense claims and support"
        breadcrumbs={[
          { label: "Dashboard", href: "/dashboard" },
          { label: "My Self-Service" },
        ]}
      />

      <div className="page-body">
        {employeeId && (
          <CheckInOutCard employeeId={employeeId} onChanged={() => setAttendanceRefreshKey((k) => k + 1)} />
        )}

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

        {employeeId && companyId && (
          <>
            {tab === "attendance" && <MyAttendancePanel employeeId={employeeId} refreshKey={attendanceRefreshKey} />}
            {tab === "leave" && <MyLeavePanel employeeId={employeeId} companyId={companyId} />}
            {tab === "payslips" && <MyPayslipsPanel employeeId={employeeId} />}
            {tab === "assets" && <MyAssetsPanel employeeId={employeeId} />}
            {tab === "expenses" && <MyExpensesPanel employeeId={employeeId} />}
            {tab === "helpdesk" && <MyHelpdeskPanel employeeId={employeeId} />}
          </>
        )}
      </div>
    </>
  );
}
