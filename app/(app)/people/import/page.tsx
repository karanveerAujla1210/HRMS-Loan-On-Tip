"use client";

export const dynamic = "force-dynamic";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { useProfile } from "@/lib/useProfile";
import PageHeader from "@/components/PageHeader";
type CsvRow = Record<string, string>;
type LookupMap = Record<string, string>;

const REQUIRED = ["first_name", "last_name", "joining_date"];

const HEADERS = [
  "first_name", "last_name", "middle_name",
  "official_email", "personal_email", "official_mobile", "personal_mobile",
  "gender", "date_of_birth", "blood_group",
  "joining_date", "confirmation_date", "last_working_date",
  "employment_type", "department", "designation", "location",
  "manager_email", "hr_manager_email",
  "employment_status", "nationality", "marital_status",
  "probation_end_date", "notice_period_days",
  "annual_ctc",
  "bank_name", "account_number", "ifsc_code",
  "pan_number", "aadhaar_last4", "uan",
];

  const HEADER_HINTS: Record<string, string> = {
    first_name: "Rahul",
    last_name: "Sharma",
    middle_name: "(optional)",
    official_email: "rahul@company.com",
    personal_email: "(optional)",
    official_mobile: "9876543210",
    personal_mobile: "(optional)",
    gender: "Male / Female",
    date_of_birth: "YYYY-MM-DD",
    blood_group: "A+ / B+ / O+ / AB+",
    joining_date: "YYYY-MM-DD",
    confirmation_date: "YYYY-MM-DD",
    last_working_date: "(if resigned)",
    employment_type: "Full Time / Contract / Intern",
    department: "Sales / HR / Finance / Operations / Technology / Credit",
    designation: "Executive / Assistant Manager / Manager / VP",
    location: "Head Office / Branch 1 / Branch 2",
    manager_email: "manager@company.com",
    hr_manager_email: "hr@company.com",
    employment_status: "ACTIVE / INACTIVE / TERMINATED",
    nationality: "Indian",
    marital_status: "Single / Married",
    probation_end_date: "YYYY-MM-DD",
    notice_period_days: "30 / 60 / 90",
    annual_ctc: "480000",
    bank_name: "HDFC Bank",
    account_number: "50100123456789",
    ifsc_code: "HDFC0001234",
    pan_number: "ABCDE1234F",
    aadhaar_last4: "1234",
    uan: "101234567890",
  };

import { parseCsv } from "@/lib/csv";

const VALID_STATUSES = ["ACTIVE", "ON_NOTICE", "SUSPENDED", "RESIGNED", "TERMINATED", "RETIRED", "INACTIVE"];

export default function ImportPage() {
  const router = useRouter();
  const { companyId } = useProfile();
  const [rows, setRows] = useState<CsvRow[]>([]);
  const [errors, setErrors] = useState<string[]>([]);
  const [importing, setImporting] = useState(false);
  const [result, setResult] = useState<{ success: number; failed: number; failedRows: string[] } | null>(null);
  const [, setDepts] = useState<LookupMap>({});
  const [, setDesigs] = useState<LookupMap>({});
  const [, setLocs] = useState<LookupMap>({});
  const [, setEmpTypes] = useState<LookupMap>({});
  const [, setEmpEmails] = useState<LookupMap>({});
  const [lookupReady, setLookupReady] = useState(false);

  useEffect(() => {
    async function loadLookups() {
      if (!companyId) { setLookupReady(true); return; }
      const [d, dg, l, et, emps] = await Promise.all([
        supabase.from("departments").select("id,name").eq("company_id", companyId),
        supabase.from("designations").select("id,name").eq("company_id", companyId),
        supabase.from("locations").select("id,name").eq("company_id", companyId),
        supabase.from("employment_types").select("id,name").eq("company_id", companyId),
        supabase.from("employees").select("id,official_email").eq("company_id", companyId),
      ]);
      const toMap = (data: { id: string; name: string }[] | null) =>
        Object.fromEntries((data ?? []).map((r) => [r.name.toLowerCase().trim(), r.id]));
      setDepts(toMap(d.data as { id: string; name: string }[]));
      setDesigs(toMap(dg.data as { id: string; name: string }[]));
      setLocs(toMap(l.data as { id: string; name: string }[]));
      setEmpTypes(toMap(et.data as { id: string; name: string }[]));
      setEmpEmails(
        Object.fromEntries(
          ((emps.data ?? []) as { id: string; official_email: string }[])
            .filter((e) => e.official_email)
            .map((e) => [e.official_email.toLowerCase().trim(), e.id])
        )
      );
      setLookupReady(true);
    }
    void loadLookups();
  }, [companyId]);

  function validate(parsed: CsvRow[]): string[] {
    const errs: string[] = [];
    const emails = new Set<string>();
    parsed.forEach((row, i) => {
      const rowNum = i + 2;
      REQUIRED.forEach((f) => {
        if (!row[f]) errs.push(`Row ${rowNum}: "${f}" is required`);
      });
      if (row.official_email) {
        if (emails.has(row.official_email.toLowerCase()))
          errs.push(`Row ${rowNum}: duplicate email "${row.official_email}"`);
        emails.add(row.official_email.toLowerCase());
      }
      if (row.employment_status && !VALID_STATUSES.includes(row.employment_status.toUpperCase()))
        errs.push(`Row ${rowNum}: invalid employment_status "${row.employment_status}"`);
      if (row.joining_date && !/^\d{4}-\d{2}-\d{2}$/.test(row.joining_date))
        errs.push(`Row ${rowNum}: joining_date must be YYYY-MM-DD`);
      if (row.date_of_birth && !/^\d{4}-\d{2}-\d{2}$/.test(row.date_of_birth))
        errs.push(`Row ${rowNum}: date_of_birth must be YYYY-MM-DD`);
      if (row.annual_ctc && isNaN(Number(row.annual_ctc)))
        errs.push(`Row ${rowNum}: annual_ctc must be a number`);
      if (row.notice_period_days && isNaN(Number(row.notice_period_days)))
        errs.push(`Row ${rowNum}: notice_period_days must be a number`);
    });
    return errs;
  }

  function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const parsed = parseCsv(ev.target?.result as string) as CsvRow[];
      setErrors(validate(parsed));
      setRows(parsed);
      setResult(null);
    };
    reader.readAsText(file);
  }

  const handleImport = useCallback(async () => {
    if (!rows.length || errors.length || !companyId) return;
    setImporting(true);

    const res = await fetch("/api/people/import", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ employees: rows }),
    });
    const json = await res.json();
    setResult({ success: json.success, failed: json.failed, failedRows: json.failedRows });
    setImporting(false);
    if (json.failed === 0) setTimeout(() => router.push("/people"), 2000);
  }, [rows, errors, companyId, router]);

  function downloadSample() {
    const header = HEADERS.join(",");
    const rows = [
      "John,Doe,,john.doe@company.com,,9876543210,,Male,1990-01-01,A+,2023-01-10,2023-04-10,,Full Time,Sales,Executive,Head Office,,hr@company.com,ACTIVE,Indian,Single,2023-04-10,30,480000,Example Bank,50100123456789,EXPL0001234,ABCDE1234F,1234,101234567890",
      "Jane,Smith,,jane.smith@company.com,,9876543211,,Female,1992-02-02,B+,2023-02-01,2023-05-01,,Full Time,HR,Manager,Head Office,,hr@company.com,ACTIVE,Indian,Married,,60,720000,Example Bank,123456789012,EXIC0001234,FGHIJ5678K,5678,101234567891",
    ].join("\n");
    const blob = new Blob([header + "\n" + rows], { type: "text/csv" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "employee_import_sample.csv";
    a.click();
  }

  const PREVIEW_COLS = ["first_name", "last_name", "official_email", "department", "designation", "location", "employment_type", "joining_date", "annual_ctc", "employment_status"];

  return (
    <>
      <PageHeader
        title="Import Employees"
        subtitle="Bulk employee onboarding via CSV spreadsheet"
        breadcrumbs={[
          { label: "Dashboard", href: "/dashboard" },
          { label: "People", href: "/people" },
          { label: "Bulk CSV Import" },
        ]}
        actions={
          <button className="btn btn-secondary btn-sm" onClick={() => router.push("/people")}>← People Directory</button>
        }
      />

      <div className="page-body">

        {/* Step 1 */}
        <div className="card" style={{ marginBottom: 20 }}>
          <div className="card-header">
            <div><h2>Step 1 — Download sample CSV</h2><p>Fill all employee data in this template and save as .csv</p></div>
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

        {/* Errors */}
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

        {/* Preview */}
        {rows.length > 0 && (
          <div className="card" style={{ marginBottom: 20 }}>
            <div className="card-header">
              <div><h2>Step 3 — Preview ({rows.length} rows)</h2><p>Verify before importing</p></div>
              <button
                className="btn btn-primary"
                onClick={handleImport}
                disabled={importing || errors.length > 0}
              >
                {importing ? "Importing…" : `Import ${rows.length} employees`}
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

        {/* Result */}
        {result && (
          <div className={`alert ${result.failed === 0 ? "alert-success" : "alert-error"}`}>
            <div>
              <strong>✅ {result.success} imported successfully{result.failed > 0 ? `, ❌ ${result.failed} failed` : ""}.</strong>
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
