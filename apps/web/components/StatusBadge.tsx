"use client";

import React from "react";

export type StatusCategory =
  | "attendance"
  | "employment"
  | "leave"
  | "payroll"
  | "asset"
  | "general";

interface StatusConfig {
  label: string;
  className: string;
  dotColor?: string;
}

const STATUS_MAP: Record<string, StatusConfig> = {
  // Attendance
  PRESENT: { label: "Present", className: "badge-green", dotColor: "#10b981" },
  LATE: { label: "Late", className: "badge-amber", dotColor: "#f59e0b" },
  ABSENT: { label: "Absent", className: "badge-red", dotColor: "#ef4444" },
  HALF_DAY: { label: "Half Day", className: "badge-blue", dotColor: "#3b82f6" },
  ON_LEAVE: { label: "On Leave", className: "badge-purple", dotColor: "#8b5cf6" },
  LEAVE: { label: "On Leave", className: "badge-purple", dotColor: "#8b5cf6" },
  HOLIDAY: { label: "Holiday", className: "badge-blue", dotColor: "#3b82f6" },
  WEEKLY_OFF: { label: "Weekly Off", className: "badge-gray", dotColor: "#6b7280" },
  WORK_FROM_HOME: { label: "WFH", className: "badge-blue", dotColor: "#3b82f6" },
  ON_DUTY: { label: "On Duty", className: "badge-blue", dotColor: "#3b82f6" },
  MISSING_PUNCH: { label: "Missing Punch", className: "badge-amber", dotColor: "#f59e0b" },

  // Employment
  ACTIVE: { label: "Active", className: "badge-green", dotColor: "#10b981" },
  PROBATION: { label: "Probation", className: "badge-amber", dotColor: "#f59e0b" },
  NOTICE_PERIOD: { label: "Notice Period", className: "badge-purple", dotColor: "#8b5cf6" },
  TERMINATED: { label: "Terminated", className: "badge-red", dotColor: "#ef4444" },
  RESIGNED: { label: "Resigned", className: "badge-gray", dotColor: "#6b7280" },
  RETIRED: { label: "Retired", className: "badge-gray", dotColor: "#6b7280" },
  INACTIVE: { label: "Inactive", className: "badge-gray", dotColor: "#6b7280" },

  // Leave & Approvals
  PENDING: { label: "Pending", className: "badge-amber", dotColor: "#f59e0b" },
  APPROVED: { label: "Approved", className: "badge-green", dotColor: "#10b981" },
  REJECTED: { label: "Rejected", className: "badge-red", dotColor: "#ef4444" },
  CANCELLED: { label: "Cancelled", className: "badge-gray", dotColor: "#6b7280" },

  // Payroll
  DRAFT: { label: "Draft", className: "badge-gray", dotColor: "#6b7280" },
  PROCESSING: { label: "Processing", className: "badge-blue", dotColor: "#3b82f6" },
  PAID: { label: "Paid", className: "badge-green", dotColor: "#10b981" },
  COMPLETED: { label: "Completed", className: "badge-green", dotColor: "#10b981" },
  LOCKED: { label: "Locked", className: "badge-gray", dotColor: "#6b7280" },

  // Assets
  AVAILABLE: { label: "Available", className: "badge-green", dotColor: "#10b981" },
  ASSIGNED: { label: "Assigned", className: "badge-blue", dotColor: "#3b82f6" },
  RETURNED: { label: "Returned", className: "badge-gray", dotColor: "#6b7280" },
  MAINTENANCE: { label: "In Maintenance", className: "badge-amber", dotColor: "#f59e0b" },
  LOST: { label: "Lost", className: "badge-red", dotColor: "#ef4444" },
  DAMAGED: { label: "Damaged", className: "badge-red", dotColor: "#ef4444" },
};

interface StatusBadgeProps {
  status: string | null | undefined;
  size?: "sm" | "md";
  showDot?: boolean;
  className?: string;
  customLabel?: string;
}

export function StatusBadge({
  status,
  size = "md",
  showDot = true,
  className = "",
  customLabel,
}: StatusBadgeProps) {
  if (!status) {
    return <span className="status-badge-empty">—</span>;
  }

  const key = String(status).trim().toUpperCase();
  const config = STATUS_MAP[key] ?? {
    label: customLabel || key.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()),
    className: "badge-gray",
    dotColor: "#6b7280",
  };

  const displayText = customLabel || config.label;
  const sizeClass = size === "sm" ? "status-badge-sm" : "status-badge-md";

  return (
    <span
      className={`status-badge ${config.className} ${sizeClass} ${className}`}
      title={displayText}
    >
      {showDot && (
        <span
          className="status-badge-dot"
          style={{ backgroundColor: config.dotColor }}
          aria-hidden="true"
        />
      )}
      <span className="status-badge-text">{displayText}</span>
    </span>
  );
}

export default StatusBadge;
