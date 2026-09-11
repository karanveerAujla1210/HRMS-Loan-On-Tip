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
import { Tabs } from "@/components/Tabs";
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
        icon={
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><circle cx="12" cy="8" r="4"/><path d="M4 20c0-4 3.6-7 8-7s8 3 8 7"/></svg>
        }
        breadcrumbs={[
          { label: "Dashboard", href: "/dashboard" },
          { label: "My Self-Service" },
        ]}
      />

      <div className="page-body">
        {employeeId && (
          <CheckInOutCard employeeId={employeeId} onChanged={() => setAttendanceRefreshKey((k) => k + 1)} />
        )}

        <Tabs items={TABS} active={tab} onChange={(key) => setTab(key)} ariaLabel="Self-service sections" />

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
