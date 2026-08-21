"use client";

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

  return str.replace(/_/g, " ");
}

function toLabel(key: string) {
  return key.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

type Row = Record<string, unknown>;

export default function DataTable({
  rows,
  columns,
  action,
}: {
  rows: Row[];
  columns: string[];
  action?: (row: Row) => React.ReactNode;
}) {
  if (!rows.length) {
    return (
      <div className="empty-state">
        <p>No records found.</p>
      </div>
    );
  }

  return (
    <div className="table-wrap">
      <table>
        <thead>
          <tr>
            {columns.map((col) => (
              <th key={col}>{toLabel(col)}</th>
            ))}
            {action && <th />}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={String(row.id ?? i)}>
              {columns.map((col) => (
                <td key={col}>{formatValue(col, row[col])}</td>
              ))}
              {action && <td style={{ width: 1, whiteSpace: "nowrap" }}>{action(row)}</td>}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
