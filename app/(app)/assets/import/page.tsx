"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { useProfile } from "@/lib/useProfile";
import PageHeader from "@/components/PageHeader";

type CsvRow = Record<string, string>;
type LookupMap = Record<string, string>;

const REQUIRED = ["category", "model"];

const HEADERS = [
  "category", "brand", "model", "serial_number",
  "asset_tag", "imei_1", "imei_2", "mobile_number", "sim_number",
  "purchase_date", "purchase_cost", "warranty_end",
  "location", "condition", "vendor_name", "invoice_number", "notes"
];

const HEADER_HINTS: Record<string, string> = {
  category: "Laptop / Mobile / SIM Card / Monitor / Furniture",
  brand: "Lenovo / Dell / Apple / HP / Airtel / Jio",
  model: "ThinkPad E14 / MacBook Air / iPhone 15",
  serial_number: "PF2X9ABC (Unique Serial)",
  asset_tag: "ACG-LAP-001 (Optional Tag)",
  imei_1: "15-digit IMEI (for Mobile)",
  imei_2: "Optional second IMEI",
  mobile_number: "+91 98765 43210 (for SIM)",
  sim_number: "8991000000000000000F",
  purchase_date: "YYYY-MM-DD (e.g. 2024-01-15)",
  purchase_cost: "55000",
  warranty_end: "YYYY-MM-DD (e.g. 2027-01-15)",
  location: "Delhi Head Office / Mumbai Branch",
  condition: "GOOD / FAIR / POOR / NEW",
  vendor_name: "Comnet Solutions / Reliance Digital",
  invoice_number: "INV-2024-0012",
  notes: "Assigned for credit operations",
};

function parseCsv(text: string): CsvRow[] {
  const lines = text.trim().split(/\r?\n/);
  if (lines.length < 2) return [];

  function splitLine(line: string): string[] {
    const result: string[] = [];
    let cur = "";
    let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (ch === '"') {
        if (inQuotes && line[i + 1] === '"') { cur += '"'; i++; }
        else inQuotes = !inQuotes;
      } else if (ch === "," && !inQuotes) {
        result.push(cur.trim()); cur = "";
      } else {
        cur += ch;
      }
    }
    result.push(cur.trim());
    return result;
  }

  const headers = splitLine(lines[0]).map((h) => h.toLowerCase().replace(/ /g, "_"));
  return lines.slice(1)
    .map((line) => {
      const values = splitLine(line);
      return headers.reduce<CsvRow>((acc, h, i) => {
        acc[h] = (values[i] ?? "").trim();
        return acc;
      }, {});
    })
    .filter((row) => Object.values(row).some((v) => v));
}

export default function AssetImportPage() {
  const router = useRouter();
  const { companyId } = useProfile();
  const [rows, setRows] = useState<CsvRow[]>([]);
  const [errors, setErrors] = useState<string[]>([]);
  const [importing, setImporting] = useState(false);
  const [result, setResult] = useState<{ success: number; failed: number; failedRows: string[] } | null>(null);

  const [categories, setCategories] = useState<LookupMap>({});
  const [categoryPrefixes, setCategoryPrefixes] = useState<LookupMap>({});
  const [brands, setBrands] = useState<LookupMap>({});
  const [locations, setLocations] = useState<LookupMap>({});
  const [lookupReady, setLookupReady] = useState(false);

  useEffect(() => {
    async function loadLookups() {
      if (!companyId) return;
      const [catRes, brandRes, locRes] = await Promise.all([
        supabase.from("asset_categories").select("id,name,prefix").eq("company_id", companyId),
        supabase.from("asset_brands").select("id,name").eq("company_id", companyId),
        supabase.from("locations").select("id,name").eq("company_id", companyId),
      ]);

      const catMap: LookupMap = {};
      const prefixMap: LookupMap = {};
      (catRes.data ?? []).forEach((c: { id: string; name: string; prefix: string }) => {
        catMap[c.name.toLowerCase().trim()] = c.id;
        prefixMap[c.id] = c.prefix || "AST";
      });

      const brandMap: LookupMap = {};
      (brandRes.data ?? []).forEach((b: { id: string; name: string }) => {
        brandMap[b.name.toLowerCase().trim()] = b.id;
      });

      const locMap: LookupMap = {};
      (locRes.data ?? []).forEach((l: { id: string; name: string }) => {
        locMap[l.name.toLowerCase().trim()] = l.id;
      });

      setCategories(catMap);
      setCategoryPrefixes(prefixMap);
      setBrands(brandMap);
      setLocations(locMap);
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

      if (row.category && !categories[row.category.toLowerCase().trim()]) {
        errs.push(`Row ${rowNum}: Category "${row.category}" not found. Create it under Organisation first or check spelling.`);
      }

      if (row.serial_number) {
        const s = row.serial_number.toLowerCase().trim();
        if (serials.has(s)) {
          errs.push(`Row ${rowNum}: Duplicate serial number "${row.serial_number}" in file.`);
        }
        serials.add(s);
      }

      if (row.purchase_date && !/^\d{4}-\d{2}-\d{2}$/.test(row.purchase_date)) {
        errs.push(`Row ${rowNum}: purchase_date must be YYYY-MM-DD`);
      }
      if (row.warranty_end && !/^\d{4}-\d{2}-\d{2}$/.test(row.warranty_end)) {
        errs.push(`Row ${rowNum}: warranty_end must be YYYY-MM-DD`);
      }
      if (row.purchase_cost && isNaN(Number(row.purchase_cost))) {
        errs.push(`Row ${rowNum}: purchase_cost must be a numeric value`);
      }
    });

    return errs;
  }

  function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const parsed = parseCsv(ev.target?.result as string);
      setErrors(validate(parsed));
      setRows(parsed);
      setResult(null);
    };
    reader.readAsText(file);
  }

  const handleImport = useCallback(async () => {
    if (!rows.length || errors.length || !companyId) return;
    setImporting(true);
    let success = 0;
    let failed = 0;
    const failedRows: string[] = [];

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      const catId = categories[row.category.toLowerCase().trim()];
      const prefix = categoryPrefixes[catId] || "AST";
      const brandId = row.brand ? (brands[row.brand.toLowerCase().trim()] ?? null) : null;
      const locId = row.location ? (locations[row.location.toLowerCase().trim()] ?? null) : null;

      // Generate unique asset code
      const uniqueSuffix = `${Date.now().toString().slice(-6)}${String(i + 1).padStart(2, "0")}`;
      const assetCode = `${prefix.toUpperCase()}-${uniqueSuffix}`;

      const payload = {
        company_id: companyId,
        asset_category_id: catId,
        brand_id: brandId,
        location_id: locId,
        asset_code: assetCode,
        asset_tag: row.asset_tag || null,
        model: row.model,
        serial_number: row.serial_number || null,
        imei_1: row.imei_1 || null,
        imei_2: row.imei_2 || null,
        mobile_number: row.mobile_number || null,
        sim_number: row.sim_number || null,
        purchase_date: row.purchase_date || null,
        purchase_cost: row.purchase_cost ? Number(row.purchase_cost) : null,
        warranty_end: row.warranty_end || null,
        condition: (row.condition || "GOOD").toUpperCase(),
        status: "AVAILABLE",
        vendor_name: row.vendor_name || null,
        invoice_number: row.invoice_number || null,
        notes: row.notes || null,
      };

      const { error: insertErr } = await supabase.from("assets").insert(payload);

      if (insertErr) {
        failedRows.push(`Row ${i + 2} (${row.model}): ${insertErr.message}`);
        failed++;
      } else {
        success++;
      }
    }

    setResult({ success, failed, failedRows });
    setImporting(false);
    if (failed === 0) {
      setTimeout(() => router.push("/assets"), 2000);
    }
  }, [rows, errors, companyId, categories, categoryPrefixes, brands, locations, router]);

  function downloadSample() {
    const header = HEADERS.join(",");
    const sampleRows = [
      "Laptop,Lenovo,ThinkPad E14 Gen 4,PF2X9A01,ACG-LAP-001,,,,2024-01-10,58000,2027-01-10,Delhi Head Office,GOOD,Comnet Solutions,INV-8821,Credit team allocation",
      "Laptop,Dell,Latitude 3420,DL8821B2,ACG-LAP-002,,,,2024-02-15,62000,2027-02-15,Mumbai Branch,GOOD,Dell Direct,INV-9901,Operations laptop",
      "Mobile,Apple,iPhone 13 128GB,APL9921X3,,354890123456789,,9876543210,,2024-03-01,52000,2025-03-01,Delhi Head Office,GOOD,Imagine Store,INV-4412,Executive phone",
      "SIM Card,Airtel,Corporate 5G Plan,,,,,9876543210,8991000000000000001F,2024-01-01,,2025-12-31,Delhi Head Office,NEW,Airtel Business,,Calling SIM",
    ].join("\n");

    const blob = new Blob([header + "\n" + sampleRows], { type: "text/csv" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "asset_import_sample.csv";
    a.click();
  }

  const PREVIEW_COLS = ["category", "brand", "model", "serial_number", "mobile_number", "purchase_cost", "location", "condition", "vendor_name"];

  return (
    <>
      <PageHeader
        title="Import Assets"
        subtitle="Bulk upload IT equipment, SIM cards and office hardware"
        actions={
          <button className="btn btn-secondary btn-sm" onClick={() => router.push("/assets")}>← Back to Assets</button>
        }
      />

      <div className="page-body">
        {/* Step 1 */}
        <div className="card" style={{ marginBottom: 20 }}>
          <div className="card-header">
            <div>
              <h2>Step 1 — Download Asset Template CSV</h2>
              <p>Fill in asset inventory details and save as standard .csv</p>
            </div>
            <button className="btn btn-primary btn-sm" onClick={downloadSample}>⬇ Download asset_template.csv</button>
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
                      {HEADER_HINTS[h] ?? ""}
                    </td>
                  ))}
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        {/* Step 2 */}
        <div className="card" style={{ marginBottom: 20 }}>
          <div className="card-header">
            <div>
              <h2>Step 2 — Upload Completed CSV</h2>
              <p>Upload .csv file with UTF-8 encoding</p>
            </div>
            {!lookupReady && <span style={{ fontSize: 12, color: "var(--text-3)" }}>Loading system categories…</span>}
          </div>
          <div className="card-body">
            <input type="file" accept=".csv" onChange={handleFile} disabled={!lookupReady} />
            {rows.length > 0 && !errors.length && (
              <p style={{ marginTop: 10, fontSize: 13, color: "var(--green)" }}>
                ✅ {rows.length} assets parsed — ready to import
              </p>
            )}
          </div>
        </div>

        {/* Validation Errors */}
        {errors.length > 0 && (
          <div className="alert alert-error" style={{ marginBottom: 20 }}>
            <div>
              <strong>Please correct {errors.length} validation issue{errors.length > 1 ? "s" : ""} before importing:</strong>
              <ul style={{ margin: "8px 0 0 16px" }}>
                {errors.map((e, i) => <li key={i}>{e}</li>)}
              </ul>
            </div>
          </div>
        )}

        {/* Step 3: Preview */}
        {rows.length > 0 && (
          <div className="card" style={{ marginBottom: 20 }}>
            <div className="card-header">
              <div>
                <h2>Step 3 — Preview ({rows.length} records)</h2>
                <p>Review items before uploading into inventory</p>
              </div>
              <button
                className="btn btn-primary"
                onClick={handleImport}
                disabled={importing || errors.length > 0}
              >
                {importing ? "Importing…" : `Import ${rows.length} Assets`}
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

        {/* Result summary */}
        {result && (
          <div className={`alert ${result.failed === 0 ? "alert-success" : "alert-error"}`}>
            <div>
              <strong>✅ {result.success} assets imported successfully{result.failed > 0 ? `, ❌ ${result.failed} failed` : ""}.</strong>
              {result.failed === 0 && <p style={{ marginTop: 4, fontSize: 12 }}>Redirecting to inventory…</p>}
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
