"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { useProfile } from "@/lib/useProfile";
import PageHeader from "@/components/PageHeader";
import { parseCSV } from "@/lib/csv";
import SubNav from "@/components/SubNav";

const ASSETS_NAV = [
  { href: "/assets", label: "Asset Inventory", exact: true },
  { href: "/assets/maintenance", label: "Maintenance & Repairs" },
  { href: "/assets/import", label: "Bulk CSV Import" },
];

type CsvRow = Record<string, string>;
type LookupMap = Record<string, string>;

const HEADERS = [
  "category", "model", "serial_number", "asset_tag",
  "imei_1", "imei_2", "mobile_number", "sim_number",
  "brand", "purchase_date", "purchase_cost", "warranty_end",
  "vendor_name", "invoice_number", "location", "condition", "notes",
];

const HINTS: Record<string, string> = {
  category: "Laptop / Mobile / SIM / Monitor",
  model: "ThinkPad E14 Gen 4",
  serial_number: "PF3XXXXX",
  asset_tag: "(optional)",
  imei_1: "(mobile only)",
  imei_2: "(optional)",
  mobile_number: "(SIM/mobile only)",
  sim_number: "(SIM only)",
  brand: "Lenovo / Apple / Samsung",
  purchase_date: "YYYY-MM-DD",
  purchase_cost: "58000",
  warranty_end: "YYYY-MM-DD",
  vendor_name: "Vendor name",
  invoice_number: "INV-001",
  location: "Delhi Head Office",
  condition: "NEW / GOOD / EXCELLENT",
  notes: "(optional)",
};

const REQUIRED = ["category", "model"];

export default function AssetImportPage() {
  const router = useRouter();
  const { companyId } = useProfile();
  const [rows, setRows] = useState<CsvRow[]>([]);
  const [errors, setErrors] = useState<string[]>([]);
  const [importing, setImporting] = useState(false);
  const [result, setResult] = useState<{ success: number; failed: number; failedRows: string[] } | null>(null);
  const [categories, setCategories] = useState<LookupMap>({});
  const [locations, setLocations] = useState<LookupMap>({});
  const [lookupReady, setLookupReady] = useState(false);

  useEffect(() => {
    async function loadLookups() {
      if (!companyId) { setLookupReady(true); return; }
      const [catRes, locRes] = await Promise.all([
        supabase.from("asset_categories").select("id,name,prefix").eq("company_id", companyId).eq("is_active", true),
        supabase.from("locations").select("id,name").eq("company_id", companyId).eq("is_active", true),
      ]);
      const toMap = (data: { id: string; name: string }[] | null) =>
        Object.fromEntries((data ?? []).map((r) => [r.name.toLowerCase().trim(), r.id]));
      setCategories(toMap(catRes.data as { id: string; name: string }[]));
      setLocations(toMap(locRes.data as { id: string; name: string }[]));
      setLookupReady(true);
    }
    void loadLookups();
  }, [companyId]);

  function validate(parsed: CsvRow[]): string[] {
    const errs: string[] = [];
    const serials = new Set<string>();
    parsed.forEach((row, i) => {
      const rowNum = i + 2;
      REQUIRED.forEach((f) => {
        if (!row[f]) errs.push(`Row ${rowNum}: "${f}" is required`);
      });
      if (row.category && !categories[row.category.toLowerCase().trim()])
        errs.push(`Row ${rowNum}: category "${row.category}" not found — check Organisation > Asset Categories`);
      if (row.serial_number) {
        if (serials.has(row.serial_number.toLowerCase()))
          errs.push(`Row ${rowNum}: duplicate serial_number "${row.serial_number}"`);
        serials.add(row.serial_number.toLowerCase());
      }
      if (row.purchase_date && !/^\d{4}-\d{2}-\d{2}$/.test(row.purchase_date))
        errs.push(`Row ${rowNum}: purchase_date must be YYYY-MM-DD`);
      if (row.warranty_end && !/^\d{4}-\d{2}-\d{2}$/.test(row.warranty_end))
        errs.push(`Row ${rowNum}: warranty_end must be YYYY-MM-DD`);
      if (row.purchase_cost && isNaN(Number(row.purchase_cost)))
        errs.push(`Row ${rowNum}: purchase_cost must be a number`);
    });
    return errs;
  }

  function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const parsed = parseCSV(ev.target?.result as string) as CsvRow[];
      setErrors(validate(parsed));
      setRows(parsed);
      setResult(null);
    };
    reader.readAsText(file);
  }

  const handleImport = useCallback(async () => {
    if (!rows.length || errors.length || !companyId) return;
    setImporting(true);

    const res = await fetch("/api/assets/import", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ assets: rows }),
    });
    const json = await res.json();
    setResult({ success: json.success, failed: json.failed, failedRows: json.failedRows });
    setImporting(false);
    if (json.failed === 0) setTimeout(() => router.push("/assets"), 2000);
  }, [rows, errors, categories, locations, companyId, router]);

  function downloadSample() {
    const header = HEADERS.join(",");
    const sample = [
      "Laptop,ThinkPad E14 Gen 4,PF3ABCDE,,,,,,Lenovo,2024-01-15,58000,2027-01-15,Lenovo Authorized,INV-001,Delhi Head Office,NEW,",
      "Mobile,iPhone 14,ABCDE12345,,358123456789012,,9876543210,8901234567890,Apple,2024-02-01,85000,2026-02-01,Apple Store,INV-002,Delhi Head Office,NEW,Company phone",
      "SIM,Airtel SIM,,,,,9876543210,8901234567890,,2024-01-01,500,,Airtel,SIM-001,Delhi Head Office,NEW,Data SIM",
    ].join("\n");
    const blob = new Blob([header + "\n" + sample], { type: "text/csv" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "asset_import_sample.csv";
    a.click();
  }

  const PREVIEW_COLS = ["category", "model", "serial_number", "brand", "purchase_cost", "condition", "location"];

  return (
    <>
      <PageHeader
        title="Import Assets"
        subtitle="Bulk upload hardware and IT assets via CSV spreadsheet"
        breadcrumbs={[
          { label: "Dashboard", href: "/dashboard" },
          { label: "Assets", href: "/assets" },
          { label: "Bulk CSV Import" },
        ]}
        actions={
          <button className="btn btn-secondary btn-sm" onClick={() => router.push("/assets")}>← Asset Inventory</button>
        }
      />

      <SubNav items={ASSETS_NAV} />

      <div className="page-body">
        <div className="card" style={{ marginBottom: 20 }}>
          <div className="card-header">
            <div><h2>Step 1 — Download sample CSV</h2><p>Fill asset data and save as .csv</p></div>
            <button className="btn btn-primary btn-sm" onClick={downloadSample}>⬇ Download sample.csv</button>
          </div>
          <div className="card-body" style={{ overflowX: "auto" }}>
            <table>
              <thead>
                <tr>
                  {HEADERS.map((h) => (
                    <th key={h} style={{ whiteSpace: "nowrap", background: REQUIRED.includes(h) ? "#fff5f3" : undefined }}>
                      {h.replace(/_/g, " ")}{REQUIRED.includes(h) ? " *" : ""}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                <tr>
                  {HEADERS.map((h) => (
                    <td key={h} style={{ color: "var(--text-4)", fontStyle: "italic", fontSize: 11, whiteSpace: "nowrap" }}>
                      {HINTS[h] ?? ""}
                    </td>
                  ))}
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        <div className="card" style={{ marginBottom: 20 }}>
          <div className="card-header">
            <div><h2>Step 2 — Upload filled CSV</h2><p>Only .csv files · UTF-8 encoding</p></div>
            {!lookupReady && <span style={{ fontSize: 12, color: "var(--text-3)" }}>Loading lookups…</span>}
          </div>
          <div className="card-body">
            <input type="file" accept=".csv" onChange={handleFile} disabled={!lookupReady} />
            {rows.length > 0 && !errors.length && (
              <p style={{ marginTop: 10, fontSize: 13, color: "var(--green)" }}>
                ✅ {rows.length} rows parsed — no validation errors
              </p>
            )}
          </div>
        </div>

        {errors.length > 0 && (
          <div className="alert alert-error" style={{ marginBottom: 20 }}>
            <div>
              <strong>Fix these {errors.length} error{errors.length > 1 ? "s" : ""} before importing:</strong>
              <ul style={{ margin: "8px 0 0 16px" }}>
                {errors.map((e, i) => <li key={i}>{e}</li>)}
              </ul>
            </div>
          </div>
        )}

        {rows.length > 0 && (
          <div className="card" style={{ marginBottom: 20 }}>
            <div className="card-header">
              <div><h2>Step 3 — Preview ({rows.length} rows)</h2><p>Verify before importing</p></div>
              <button
                className="btn btn-primary"
                onClick={handleImport}
                disabled={importing || errors.length > 0}
              >
                {importing ? "Importing…" : `Import ${rows.length} assets`}
              </button>
            </div>
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>{PREVIEW_COLS.map((c) => <th key={c}>{c.replace(/_/g, " ")}</th>)}</tr>
                </thead>
                <tbody>
                  {rows.map((row, i) => (
                    <tr key={i}>
                      {PREVIEW_COLS.map((c) => (
                        <td key={c}>{row[c] || <span style={{ color: "var(--text-4)" }}>—</span>}</td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {result && (
          <div className={`alert ${result.failed === 0 ? "alert-success" : "alert-error"}`}>
            <div>
              <strong>✅ {result.success} imported{result.failed > 0 ? `, ❌ ${result.failed} failed` : ""}.</strong>
              {result.failedRows.length > 0 && (
                <ul style={{ margin: "8px 0 0 16px" }}>
                  {result.failedRows.map((r, i) => <li key={i}>{r}</li>)}
                </ul>
              )}
            </div>
          </div>
        )}
      </div>
    </>
  );
}
