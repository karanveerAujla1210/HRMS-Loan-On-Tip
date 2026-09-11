"use client";

import React, { useMemo, useState } from "react";
import StatusBadge from "./StatusBadge";
import EmptyState from "./EmptyState";

const DATE_KEYS = ["_at", "_date", "_on", "date", "joined", "created", "updated"];
const CURRENCY_KEYS = ["salary", "gross_pay", "net_pay", "amount", "ctc", "basic", "hra", "allowances", "deductions"];
const TIME_KEYS = ["check_in_at", "check_out_at", "in_time", "out_time", "punch_time"];

function formatValue(key: string, value: unknown): React.ReactNode {
  if (value === null || value === undefined || value === "") {
    return <span className="table-empty-cell">—</span>;
  }

  const str = String(value);

  // Status columns
  if (key === "status" || key.endsWith("_status")) {
    return <StatusBadge status={str} size="sm" />;
  }

  // Currency columns
  if (CURRENCY_KEYS.some((k) => key.toLowerCase().includes(k))) {
    const num = Number(value);
    if (!isNaN(num)) {
      return (
        <span className="tabular-num font-mono-num font-semibold">
          ₹{num.toLocaleString("en-IN", { maximumFractionDigits: 2 })}
        </span>
      );
    }
  }

  // Time-specific columns
  if (TIME_KEYS.some((k) => key.toLowerCase().endsWith(k))) {
    try {
      const d = new Date(str);
      if (!isNaN(d.getTime())) {
        return (
          <span className="tabular-num text-xs font-mono-num">
            {d.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", hour12: true })}
          </span>
        );
      }
    } catch {
      return str;
    }
  }

  // Date columns
  if (DATE_KEYS.some((k) => key.endsWith(k))) {
    try {
      const d = new Date(str);
      if (!isNaN(d.getTime())) {
        return (
          <span className="tabular-num text-xs font-mono-num">
            {new Intl.DateTimeFormat("en-IN", { dateStyle: "medium" }).format(d)}
          </span>
        );
      }
    } catch {
      return str;
    }
  }

  // Worked minutes
  if (key === "worked_minutes" || key.endsWith("_minutes")) {
    const minutes = Number(value);
    if (!isNaN(minutes)) {
      const h = Math.floor(minutes / 60);
      const m = minutes % 60;
      return (
        <span className="tabular-num text-xs font-mono-num font-medium">
          {h}h {String(m).padStart(2, "0")}m
        </span>
      );
    }
  }

  // Employee Code / ID badges
  if (key === "employee_code" || key === "asset_tag" || key === "serial_number") {
    return (
      <span className="code-badge font-mono-num">
        {str}
      </span>
    );
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
  onRowClick?: (row: Row) => void;
  emptyMessage?: string;
  emptyTitle?: string;
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
  onRowClick,
  emptyMessage = "No records found.",
  emptyTitle = "No data available",
  rowKey = "id",
  striped = true,
  dense = false,
}: DataTableProps) {
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [sortConfig, setSortConfig] = useState<{ key: string; direction: "asc" | "desc" } | null>(null);

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
      newSet = new Set(sortedRows.map((r) => String(r[rowKey] ?? r.id)));
    }
    setSelectedIds(newSet);
    if (onSelectionChange) {
      onSelectionChange(sortedRows.filter((r) => newSet.has(String(r[rowKey] ?? r.id))));
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
      onSelectionChange(sortedRows.filter((r) => newSet.has(String(r[rowKey] ?? r.id))));
    }
  };

  const handleSort = (key: string) => {
    setSortConfig((prev) => ({
      key,
      direction: prev?.key === key && prev.direction === "asc" ? "desc" : "asc",
    }));
  };

  const cellPadding = dense ? "8px 12px" : "12px 16px";
  const headerPadding = dense ? "8px 12px" : "10px 16px";

  if (!sortedRows.length) {
    return (
      <div className="table-empty-wrap">
        <EmptyState
          title={emptyTitle}
          description={emptyMessage}
          compact={dense}
        />
      </div>
    );
  }

  return (
    <div className="table-responsive-container">
      <div className="table-wrap">
        <table className="enterprise-data-table">
          <thead>
            <tr>
              {selectable && (
                <th className="table-th-checkbox" style={{ width: 44, padding: headerPadding }}>
                  <input
                    type="checkbox"
                    className="checkbox-custom"
                    checked={allSelected}
                    onChange={handleSelectAll}
                    aria-label="Select all rows"
                  />
                </th>
              )}
              {columns.map((col) => {
                const isSorted = sortConfig?.key === col;
                return (
                  <th
                    key={col}
                    className={`table-th ${isSorted ? "th-sorted" : ""}`}
                    style={{ padding: headerPadding }}
                    onClick={() => handleSort(col)}
                    tabIndex={0}
                    role="columnheader"
                    aria-sort={isSorted ? (sortConfig.direction === "asc" ? "ascending" : "descending") : "none"}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        handleSort(col);
                      }
                    }}
                  >
                    <div className="th-content">
                      <span>{toLabel(col)}</span>
                      <span className="th-sort-icon" aria-hidden="true">
                        {isSorted ? (
                          sortConfig.direction === "asc" ? "↑" : "↓"
                        ) : (
                          <span className="sort-hint">↕</span>
                        )}
                      </span>
                    </div>
                  </th>
                );
              })}
              {action && (
                <th className="table-th-action" style={{ padding: headerPadding, width: 1 }}>
                  <span className="sr-only">Actions</span>
                </th>
              )}
            </tr>
          </thead>
          <tbody>
            {sortedRows.map((row, i) => {
              const id = String(row[rowKey] ?? row.id ?? i);
              const isSelected = selectedIds.has(id);
              const isClickable = Boolean(onRowClick);

              return (
                <tr
                  key={id}
                  data-selected={isSelected || undefined}
                  className={`table-row ${striped && i % 2 === 1 ? "row-striped" : ""} ${isSelected ? "row-selected" : ""} ${isClickable ? "row-clickable" : ""}`}
                  onClick={() => {
                    if (isClickable) onRowClick?.(row);
                  }}
                >
                  {selectable && (
                    <td
                      className="table-td-checkbox"
                      style={{ padding: cellPadding }}
                      onClick={(e) => e.stopPropagation()}
                    >
                      <input
                        type="checkbox"
                        className="checkbox-custom"
                        checked={isSelected}
                        onChange={(e) => handleSelectRow(id, e.target.checked)}
                        aria-label={`Select row ${id}`}
                      />
                    </td>
                  )}
                  {columns.map((col) => (
                    <td key={col} className="table-td" style={{ padding: cellPadding }}>
                      {formatValue(col, row[col])}
                    </td>
                  ))}
                  {action && (
                    <td
                      className="table-td-action"
                      style={{ padding: cellPadding }}
                      onClick={(e) => e.stopPropagation()}
                    >
                      {action(row)}
                    </td>
                  )}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {selectedIds.size > 0 && (
        <div className="table-bulk-action-bar">
          <div className="bulk-selection-count">
            <span className="count-pill">{selectedIds.size}</span>
            <span>row{selectedIds.size > 1 ? "s" : ""} selected</span>
          </div>
          <button
            type="button"
            className="btn btn-secondary btn-sm"
            onClick={() => {
              setSelectedIds(new Set());
              onSelectionChange?.([]);
            }}
          >
            Clear selection
          </button>
        </div>
      )}
    </div>
  );
}