"use client";

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
  location: "Delhi Head Office / Mumbai Branch / Noida Branch / Gurugram Branch",
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

// Proper CSV parser — handles quoted fields with commas inside
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

const VALID_STATUSES = ["ACTIVE", "ON_NOTICE", "SUSPENDED", "RESIGNED", "TERMINATED", "RETIRED", "INACTIVE"];

export default function ImportPage() {
  const router = useRouter();
  const { companyId } = useProfile();
  const [rows, setRows] = useState<CsvRow[]>([]);
  const [errors, setErrors] = useState<string[]>([]);
  const [importing, setImporting] = useState(false);
  const [result, setResult] = useState<{ success: number; failed: number; failedRows: string[] } | null>(null);
  const [depts, setDepts] = useState<LookupMap>({});
  const [desigs, setDesigs] = useState<LookupMap>({});
  const [locs, setLocs] = useState<LookupMap>({});
  const [empTypes, setEmpTypes] = useState<LookupMap>({});
  const [empEmails, setEmpEmails] = useState<LookupMap>({});
  const [lookupReady, setLookupReady] = useState(false);

  useEffect(() => {
    async function loadLookups() {
      if (!companyId) return;
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
      const parsed = parseCsv(ev.target?.result as string);
      setErrors(validate(parsed));
      setRows(parsed);
      setResult(null);
    };
    reader.readAsText(file);
  }

  const handleImport = useCallback(async () => {
    if (!rows.length || errors.length) return;
    setImporting(true);
    let success = 0, failed = 0;
    const failedRows: string[] = [];

    for (const row of rows) {
      // Insert employee
      const empPayload: Record<string, unknown> = {
        company_id: companyId,
        first_name: row.first_name,
        last_name: row.last_name,
        middle_name: row.middle_name || null,
        official_email: row.official_email || null,
        personal_email: row.personal_email || null,
        official_mobile: row.official_mobile || null,
        personal_mobile: row.personal_mobile || null,
        gender: row.gender || null,
        date_of_birth: row.date_of_birth || null,
        blood_group: row.blood_group || null,
        joining_date: row.joining_date,
        confirmation_date: row.confirmation_date || null,
        last_working_date: row.last_working_date || null,
        probation_end_date: row.probation_end_date || null,
        notice_period_days: row.notice_period_days ? Number(row.notice_period_days) : null,
        nationality: row.nationality || "Indian",
        marital_status: row.marital_status || null,
        employment_status: (row.employment_status || "ACTIVE").toUpperCase() as never,
        department_id: row.department ? (depts[row.department.toLowerCase().trim()] ?? null) : null,
        designation_id: row.designation ? (desigs[row.designation.toLowerCase().trim()] ?? null) : null,
        location_id: row.location ? (locs[row.location.toLowerCase().trim()] ?? null) : null,
        employment_type_id: row.employment_type ? (empTypes[row.employment_type.toLowerCase().trim()] ?? null) : null,
        manager_id: row.manager_email ? (empEmails[row.manager_email.toLowerCase().trim()] ?? null) : null,
        hr_manager_id: row.hr_manager_email ? (empEmails[row.hr_manager_email.toLowerCase().trim()] ?? null) : null,
      };

      const { data: empData, error: empError } = await supabase
        .from("employees")
        .insert(empPayload)
        .select("id")
        .single();

      if (empError) {
        console.error(`Row failed (${row.official_email}):`, empError.message);
        failedRows.push(`${row.first_name} ${row.last_name} — ${empError.message}`);
        failed++;
        continue;
      }

      const empId = empData.id;

      // Insert bank account if provided
      if (row.account_number && row.bank_name && row.ifsc_code) {
        await supabase.from("employee_bank_accounts").insert({
          employee_id: empId,
          account_holder_name: `${row.first_name} ${row.last_name}`,
          bank_name: row.bank_name,
          account_number_encrypted: row.account_number,
          account_number_last4: row.account_number.slice(-4),
          ifsc_code: row.ifsc_code,
          account_type: "SAVINGS",
          is_primary: true,
        });
      }

      // Insert statutory details if provided
      if (row.pan_number || row.aadhaar_last4 || row.uan) {
        await supabase.from("employee_statutory_details").insert({
          employee_id: empId,
          pan_last4: row.pan_number ? row.pan_number.slice(-4) : null,
          uan: row.uan || null,
          aadhaar_last4: row.aadhaar_last4 || null,
        });
      }

      success++;
    }

    setResult({ success, failed, failedRows });
    setImporting(false);
    if (failed === 0) setTimeout(() => router.push("/people"), 2000);
  }, [rows, errors, depts, desigs, locs, empTypes, empEmails, router]);

  function downloadSample() {
    const header = HEADERS.join(",");
    const rows = [
      "Rahul,Sharma,,rahul.sharma@acgleasing.com,rahul.personal@gmail.com,9876543210,,Male,1995-06-15,B+,2023-01-10,2023-04-10,,Full Time,Sales,Executive,Delhi Head Office,,admin@loanontip.com,ACTIVE,Indian,Single,2023-04-10,30,480000,HDFC Bank,50100123456789,HDFC0001234,ABCDE1234F,1234,101234567890",
      "Priya,Verma,,priya.verma@acgleasing.com,,9876543211,,Female,1997-03-22,O+,2023-02-01,2023-05-01,,Full Time,Human Resources,Assistant Manager,Delhi Head Office,rahul.sharma@acgleasing.com,admin@loanontip.com,ACTIVE,Indian,Married,,60,720000,ICICI Bank,123456789012,ICIC0001234,FGHIJ5678K,5678,101234567891",
      "Amit,Kumar,Singh,amit.kumar@acgleasing.com,,9876543212,,Male,1990-11-05,A+,2022-06-15,2022-09-15,,Full Time,Finance,Manager,Mumbai Branch,,admin@loanontip.com,ACTIVE,Indian,Married,2022-09-15,90,1200000,SBI,32123456789,SBIN0001234,KLMNO9012L,9012,101234567892",
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
        subtitle="Bulk upload via CSV"
        actions={
          <button className="btn btn-secondary btn-sm" onClick={() => router.push("/people")}>← Back</button>
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
