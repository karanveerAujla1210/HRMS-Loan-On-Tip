"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export default function EmployeeSubNav({ employeeId }: { employeeId: string }) {
  const pathname = usePathname();

  const tabs = [
    { href: `/people/${employeeId}`, label: "Profile", exact: true },
    { href: `/people/${employeeId}/documents`, label: "Documents" },
    { href: `/people/${employeeId}/salary`, label: "Salary & CTC" },
    { href: `/people/${employeeId}/assets`, label: "Assets" },
    { href: `/people/${employeeId}/exit`, label: "Exit & FnF" },
    { href: `/people/${employeeId}/id-card`, label: "ID Card" },
  ];

  return (
    <div className="employee-subnav-container">
      <nav className="subnav-tabs" aria-label="Employee profile sections">
        {tabs.map((tab) => {
          const isActive = tab.exact
            ? pathname === tab.href
            : pathname === tab.href || pathname.startsWith(tab.href + "/");

          return (
            <Link
              key={tab.href}
              href={tab.href}
              className={`subnav-tab${isActive ? " active" : ""}`}
            >
              {tab.label}
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
