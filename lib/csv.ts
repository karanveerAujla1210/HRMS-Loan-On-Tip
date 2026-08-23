/**
 * CSV helpers shared by import and export paths.
 *
 * `toCsv` neutralises spreadsheet formula injection (a cell beginning with
 * `= + - @` is prefixed with a single quote) because exports are opened in
 * Excel by finance and HR users.
 */

export function parseCsv(csvText: string): Record<string, string>[] {
  const rows = parseCsvRows(csvText);
  if (rows.length < 2) return [];

  const headers = (rows[0] ?? []).map((h) => h.trim());
  const out: Record<string, string>[] = [];

  for (let i = 1; i < rows.length; i += 1) {
    const values = rows[i] ?? [];
    if (values.every((v) => v.trim() === "")) continue;
    const row: Record<string, string> = {};
    headers.forEach((header, index) => {
      row[header] = (values[index] ?? "").trim();
    });
    out.push(row);
  }

  return out;
}

/** Full RFC 4180 style tokenizer: handles quoted newlines and escaped quotes. */
export function parseCsvRows(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let inQuotes = false;

  for (let i = 0; i < text.length; i += 1) {
    const char = text[i];

    if (inQuotes) {
      if (char === '"') {
        if (text[i + 1] === '"') {
          cell += '"';
          i += 1;
        } else {
          inQuotes = false;
        }
      } else {
        cell += char;
      }
      continue;
    }

    if (char === '"') {
      inQuotes = true;
    } else if (char === ",") {
      row.push(cell);
      cell = "";
    } else if (char === "\n") {
      row.push(cell);
      rows.push(row);
      row = [];
      cell = "";
    } else if (char !== "\r") {
      cell += char;
    }
  }

  row.push(cell);
  rows.push(row);
  return rows.filter((r) => r.length > 1 || (r[0] ?? "").trim() !== "");
}

const FORMULA_PREFIXES = ["=", "+", "-", "@", "\t", "\r"];

function escapeCell(value: unknown): string {
  const raw =
    value === null || value === undefined
      ? ""
      : value instanceof Date
        ? value.toISOString()
        : String(value);
  const guarded = FORMULA_PREFIXES.some((p) => raw.startsWith(p)) ? `'${raw}` : raw;
  return /[",\n\r]/.test(guarded) ? `"${guarded.replace(/"/g, '""')}"` : guarded;
}

export function toCsv(
  headers: readonly string[],
  rows: readonly Record<string, unknown>[]
): string {
  const lines = [headers.map(escapeCell).join(",")];
  for (const row of rows) {
    lines.push(headers.map((header) => escapeCell(row[header])).join(","));
  }
  return lines.join("\r\n");
}

/** Builds a CSV from explicit column definitions with display labels. */
export function toCsvWithColumns<T extends Record<string, unknown>>(
  columns: readonly { key: keyof T & string; label: string }[],
  rows: readonly T[]
): string {
  const lines = [columns.map((c) => escapeCell(c.label)).join(",")];
  for (const row of rows) {
    lines.push(columns.map((c) => escapeCell(row[c.key])).join(","));
  }
  return lines.join("\r\n");
}
