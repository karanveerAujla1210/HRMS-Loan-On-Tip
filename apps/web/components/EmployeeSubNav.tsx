"use client";

import React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";

interface EmployeeSubNavProps {
  employeeId: string;
}

export default function EmployeeSubNav({ employeeId }: EmployeeSubNavProps) {
  const pathname = usePathname();

  const tabs = [
    {
      href: `/people/${employeeId}`,
      label: "360 Profile",
      exact: true,
      icon: (
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
          <circle cx="12" cy="8" r="4" />
          <path d="M4 20c0-4 3.6-7 8-7s8 3 8 7" />
        </svg>
      ),
    },
    {
      href: `/people/${employeeId}/documents`,
      label: "Documents",
      icon: (
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
          <polyline points="14 2 14 8 20 8" />
          <line x1="16" y1="13" x2="8" y2="13" />
          <line x1="16" y1="17" x2="8" y2="17" />
          <polyline points="10 9 9 9 8 9" />
        </svg>
      ),
    },
    {
      href: `/people/${employeeId}/salary`,
      label: "Salary & CTC",
      icon: (
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
          <rect x="2" y="6" width="20" height="12" rx="2" />
          <circle cx="12" cy="12" r="3" />
          <path d="M6 12h.01M18 12h.01" />
        </svg>
      ),
    },
    {
      href: `/people/${employeeId}/assets`,
      label: "Assigned Assets",
      icon: (
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
          <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" />
          <polyline points="3.27 6.96 12 12.01 20.73 6.96" />
        </svg>
      ),
    },
    {
      href: `/people/${employeeId}/exit`,
      label: "Exit & FnF",
      icon: (
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
          <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
          <polyline points="16 17 21 12 16 7" />
          <line x1="21" y1="12" x2="9" y2="12" />
        </svg>
      ),
    },
    {
      href: `/people/${employeeId}/id-card`,
      label: "ID Card",
      icon: (
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
          <rect x="3" y="4" width="18" height="16" rx="2" />
          <line x1="7" y1="8" x2="17" y2="8" />
          <circle cx="9" cy="14" r="2" />
        </svg>
      ),
    },
  ];

  return (
    <div
      className="employee-subnav-container"
      style={{
        borderBottom: "1px solid var(--border)",
        background: "var(--surface)",
        padding: "0 24px",
        marginBottom: 24,
      }}
    >
      <nav
        className="subnav-tabs"
        aria-label="Employee profile sections"
        style={{
          display: "flex",
          gap: 6,
          overflowX: "auto",
          margin: 0,
          borderBottom: "none",
        }}
      >
        {tabs.map((tab) => {
          const isActive = tab.exact
            ? pathname === tab.href
            : pathname === tab.href || pathname.startsWith(tab.href + "/");

          return (
            <Link
              key={tab.href}
              href={tab.href}
              className={`subnav-tab${isActive ? " active" : ""}`}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 8,
                padding: "12px 14px",
                fontSize: 13,
                fontWeight: isActive ? 600 : 500,
                color: isActive ? "var(--brand)" : "var(--text-muted)",
                borderBottom: isActive ? "2px solid var(--brand)" : "2px solid transparent",
                textDecoration: "none",
                whiteSpace: "nowrap",
                transition: "all var(--transition-fast)",
              }}
            >
              <span style={{ opacity: isActive ? 1 : 0.7 }}>{tab.icon}</span>
              <span>{tab.label}</span>
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
