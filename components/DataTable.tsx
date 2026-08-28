"use client";

import React, { useMemo, useState } from "react";

const DATE_KEYS = ["_at", "_date", "_on", "date", "joined", "created", "updated"];
const STATUS_COLORS: Record<string, string> = {
  active: "pill-green", present: "pill-green", approved: "pill-green", available: "pill-green",
  assigned: "pill-blue", pending: "pill-amber", late: "pill-amber", half_day: "pill-amber",
  absent: "pill-red", rejected: "pill-red", terminated: "pill-red", lost: "pill-red",
  on_leave: "pill-purple", inactive: "pill-gray", draft: "pill-gray", retired: "pill-gray",
};

function formatValue(key: string, value: unknown): React.ReactNode {
  if (value === null || value === undefined || value === "") return <span style={{ color: "var(--text-4)" }}>—</span>;

  const str = String(value);

  if (key === "status" || key.endsWith("_status")) {
    const color = STATUS_COLORS[str.toLowerCase()] ?? "pill-gray";
    return <span className={`pill ${color}`}>{str.replace(/_/g, " ")}</span>;
  }

  if (DATE_KEYS.some((k) => key.endsWith(k))) {
    try {
      return new Intl.DateTimeFormat("en-IN", { dateStyle: "medium" }).format(new Date(str));
    } catch {
      return str;
    }
  }

  if (key === "worked_minutes" || key.endsWith("_minutes")) {
    const minutes = Number(value);
    if (!isNaN(minutes)) {
      const h = Math.floor(minutes / 60);
      const m = minutes % 60;
      return `${h}h ${String(m).padStart(2, "0")}m`;
    }
  }

  return str.replace(/_/g, " ");
}

function toLabel(key: string) {
  return key.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

type Row = Record<string, unknown>;

interface DataTableProps {
  rows: Row[];
  columns: string[];
  action?: (row: Row) => React.ReactNode;
  selectable?: boolean;
  onSelectionChange?: (selectedRows: Row[]) => void;
  emptyMessage?: string;
  rowKey?: string;
  striped?: boolean;
  hoverable?: boolean;
  dense?: boolean;
}

export default function DataTable({
  rows,
  columns,
  action,
  selectable,
  onSelectionChange,
  emptyMessage = "No records found.",
  rowKey = "id",
  striped = true,
  hoverable = true,
  dense = false,
}: DataTableProps) {
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [sortConfig, setSortConfig] = useState<{ key: string; direction: "asc" | "desc" } | null>(null);

  if (!rows.length) {
    return (
      <div className="empty-state">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5}>
          <path d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          <line x1="7" y1="7" x2="7.01" y2="7.01" />
        </svg>
        <h3>No data available</h3>
        <p>{emptyMessage}</p>
      </div>
    );
  }

  const sortedRows = useMemo(() => {
    if (!sortConfig) return rows;
    return [...rows].sort((a, b) => {
      const aVal = a[sortConfig.key];
      const bVal = b[sortConfig.key];
      if (aVal === null || aVal === undefined) return 1;
      if (bVal === null || bVal === undefined) return -1;
      const comparison = String(aVal).localeCompare(String(bVal), undefined, { numeric: true });
      return sortConfig.direction === "asc" ? comparison : -comparison;
    });
  }, [rows, sortConfig]);

  const allSelected = selectedIds.size > 0 && selectedIds.size === sortedRows.length;

  const handleSelectAll = () => {
    let newSet = new Set<string>();
    if (!allSelected) {
      newSet = new Set(sortedRows.map(r => String(r[rowKey] ?? r.id)));
    }
    setSelectedIds(newSet);
    if (onSelectionChange) {
      onSelectionChange(sortedRows.filter(r => newSet.has(String(r[rowKey] ?? r.id))));
    }
  };

  const handleSelectRow = (id: string, checked: boolean) => {
    const newSet = new Set(selectedIds);
    if (checked) {
      newSet.add(id);
    } else {
      newSet.delete(id);
    }
    setSelectedIds(newSet);
    if (onSelectionChange) {
      onSelectionChange(sortedRows.filter(r => newSet.has(String(r[rowKey] ?? r.id))));
    }
  };

  const handleSort = (key: string) => {
    setSortConfig(prev => ({
      key,
      direction: prev?.key === key && prev.direction === "asc" ? "desc" : "asc"
    }));
  };

  const cellPadding = dense ? "8px 12px" : "12px 16px";
  const headerPadding = dense ? "8px 12px" : "10px 16px";

  return (
    <div className="table-wrap">
      <table style={{ width: "100%", borderCollapse: "collapse" }}>
        <thead>
          <tr style={{ background: "var(--surface)" }}>
            {selectable && (
              <th style={{ width: 44, textAlign: "center", padding: headerPadding }}>
                <input 
                  type="checkbox" 
                  checked={allSelected} 
                  onChange={handleSelectAll} 
                  style={{ width: 16, height: 16, cursor: "pointer" }}
                />
              </th>
            )}
            {columns.map((col) => (
              <th
                key={col}
                style={{
                  padding: headerPadding,
                  textAlign: "left",
                  fontSize: "10.5px",
                  fontWeight: 600,
                  color: "var(--text-3)",
                  textTransform: "uppercase",
                  letterSpacing: "0.5px",
                  borderBottom: "1px solid var(--border)",
                  whiteSpace: "nowrap",
                  cursor: "pointer",
                  userSelect: "none",
                }}
                onClick={() => handleSort(col)}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  {toLabel(col)}
                  {sortConfig?.key === col && (
                    <span style={{ fontSize: 10 }}>
                      {sortConfig.direction === "asc" ? "↑" : "↓"}
                    </span>
                  )}
                </div>
              </th>
            ))}
            {action && <th style={{ padding: headerPadding }} />}
          </tr>
        </thead>
        <tbody>
          {sortedRows.map((row, i) => {
            const id = String(row[rowKey] ?? row.id ?? i);
            const isSelected = selectedIds.has(id);
            return (
              <tr
                key={id}
                style={{
                  background: isSelected ? "var(--brand-light)" : striped && i % 2 === 1 ? "var(--border-light)" : "transparent",
                  transition: "background 0.15s",
                }}
                onMouseEnter={hoverable ? () => {} : undefined}
                onMouseLeave={hoverable ? () => {} : undefined}
              >
                {selectable && (
                  <td style={{ textAlign: "center", padding: cellPadding }}>
                    <input 
                      type="checkbox" 
                      checked={isSelected} 
                      onChange={(e) => handleSelectRow(id, e.target.checked)} 
                      style={{ width: 16, height: 16, cursor: "pointer" }}
                    />
                  </td>
                )}
                {columns.map((col) => (
                  <td key={col} style={{ padding: cellPadding, borderBottom: "1px solid var(--border-light)", fontSize: 13, color: "var(--text-2)", verticalAlign: "middle" }}>
                    {formatValue(col, row[col])}
                  </td>
                ))}
                {action && (
                  <td style={{ width: 1, whiteSpace: "nowrap", padding: cellPadding }}>
                    {action(row)}
                  </td>
                )}
              </tr>
            );
          })}
        </tbody>
      </table>
      
      {selectedIds.size > 0 && (
        <div style={{ 
          padding: "10px 15px", 
          background: "var(--brand-light)", 
          border: "1px solid var(--brand)",
          borderTop: "none",
          borderRadius: "0 0 var(--radius) var(--radius)",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 10,
          fontSize: 13,
          fontWeight: 500,
          color: "var(--brand-dark)",
        }}>
          <span>{selectedIds.size} record{selectedIds.size > 1 ? "s" : ""} selected</span>
          <button 
            className="btn btn-secondary btn-sm"
            onClick={() => setSelectedIds(new Set())}
          >
            Clear selection
          </button>
        </div>
      )}
    </div>
  );
}