"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import PageHeader from "@/components/PageHeader";

const COMPANY_ID = "00000000-0000-0000-0000-000000000001";

type CsvRow = Record<string, string>;
type LookupMap = Record<string, string>;

const REQUIRED = ["first_name", "last_name", "joining_date"];
const EXPECTED_HEADERS = [
  "first_name","last_name","middle_name","official_email","personal_email",
  "official_mobile","personal_mobile","gender","date_of_birth","joining_date",
  "employment_type","department","designation","location","manager_email",
  "employment_status","nationality","marital_status","probation_end_date","notice_period_days",
];

function parseCsv(text: string): CsvRow[] {
  const lines = text.trim().split(/\r?\n/);
  if (lines.length < 2) return [];
  const headers = lines[0].split(",").map((h) => h.trim().toLowerCase().replace(/ /g, "_"));
  return lines.slice(1).map((line) => {
    const values = line.split(",");
    return headers.reduce<CsvRow>((acc, h, i) => {
      acc[h] = (values[i] ?? "").trim();
      return acc;
    }, {});
  }).filter((row) => Object.values(row).some((v) => v));
}

export default function ImportPage() {
  const router = useRouter();
  const [rows, setRows] = useState<CsvRow[]>([]);
  const [errors, setErrors] = useState<string[]>([]);
  const [importing, setImporting] = useState(false);
  const [result, setResult] = useState<{ success: number; failed: number } | null>(null);
  const [depts, setDepts] = useState<LookupMap>({});
  const [desigs, setDesigs] = useState<LookupMap>({});
  const [locs, setLocs] = useState<LookupMap>({});
  const [empTypes, setEmpTypes] = useState<LookupMap>({});
  const [empEmails, setEmpEmails] = useState<LookupMap>({});

  useEffect(() => {
    async function loadLookups() {
      const [d, dg, l, et, emps] = await Promise.all([
        supabase.from("departments").select("id,name").eq("company_id", COMPANY_ID),
        supabase.from("designations").select("id,name").eq("company_id", COMPANY_ID),
        supabase.from("locations").select("id,name").eq("company_id", COMPANY_ID),
        supabase.from("employment_types").select("id,name").eq("company_id", COMPANY_ID),
        supabase.from("employees").select("id,official_email").eq("company_id", COMPANY_ID),
      ]);
      const toMap = (data: { id: string; name: string }[] | null) =>
        Object.fromEntries((data ?? []).map((r) => [r.name.toLowerCase(), r.id]));
      setDepts(toMap(d.data as { id: string; name: string }[]));
      setDesigs(toMap(dg.data as { id: string; name: string }[]));
      setLocs(toMap(l.data as { id: string; name: string }[]));
      setEmpTypes(toMap(et.data as { id: string; name: string }[]));
      setEmpEmails(
        Object.fromEntries(
          ((emps.data ?? []) as { id: string; official_email: string }[])
            .filter((e) => e.official_email)
            .map((e) => [e.official_email.toLowerCase(), e.id])
        )
      );
    }
    void loadLookups();
  }, []);

  function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const parsed = parseCsv(ev.target?.result as string);
      const errs: string[] = [];
      parsed.forEach((row, i) => {
        REQUIRED.forEach((f) => {
          if (!row[f]) errs.push(`Row ${i + 2}: "${f}" is required`);
        });
      });
      setErrors(errs);
      setRows(parsed);
      setResult(null);
    };
    reader.readAsText(file);
  }

  const handleImport = useCallback(async () => {
    if (!rows.length || errors.length) return;
    setImporting(true);
    let success = 0, failed = 0;

    for (const row of rows) {
      const payload: Record<string, unknown> = {
        company_id: COMPANY_ID,
        first_name: row.first_name,
        last_name: row.last_name,
        middle_name: row.middle_name || null,
        official_email: row.official_email || null,
        personal_email: row.personal_email || null,
        official_mobile: row.official_mobile || null,
        personal_mobile: row.personal_mobile || null,
        gender: row.gender || null,
        date_of_birth: row.date_of_birth || null,
        joining_date: row.joining_date,
        probation_end_date: row.probation_end_date || null,
        notice_period_days: row.notice_period_days ? Number(row.notice_period_days) : null,
        nationality: row.nationality || "Indian",
        marital_status: row.marital_status || null,
        employment_status: (row.employment_status || "ACTIVE").toUpperCase(),
        department_id: row.department ? (depts[row.department.toLowerCase()] ?? null) : null,
        designation_id: row.designation ? (desigs[row.designation.toLowerCase()] ?? null) : null,
        location_id: row.location ? (locs[row.location.toLowerCase()] ?? null) : null,
        employment_type_id: row.employment_type ? (empTypes[row.employment_type.toLowerCase()] ?? null) : null,
        manager_id: row.manager_email ? (empEmails[row.manager_email.toLowerCase()] ?? null) : null,
      };

      const { error } = await supabase.from("employees").insert(payload);
      if (error) { console.error(row.official_email, error.message); failed++; }
      else success++;
    }

    setResult({ success, failed });
    setImporting(false);
    if (failed === 0) setTimeout(() => router.push("/people"), 1500);
  }, [rows, errors, depts, desigs, locs, empTypes, empEmails, router]);

  function downloadSample() {
    const headers = EXPECTED_HEADERS.join(",");
    const sample = [
      "Rahul,Sharma,,rahul.sharma@acgleasing.com,rahul.personal@gmail.com,9876543210,,Male,1995-06-15,2023-01-10,Full Time,Sales,Executive,Delhi Head Office,,ACTIVE,Indian,Single,2023-04-10,30",
      "Priya,Verma,,priya.verma@acgleasing.com,,9876543211,,Female,1997-03-22,2023-02-01,Full Time,Human Resources,Assistant Manager,Delhi Head Office,,ACTIVE,Indian,Married,,60",
    ].join("\n");
    const blob = new Blob([headers + "\n" + sample], { type: "text/csv" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "employee_import_sample.csv";
    a.click();
  }

  const PREVIEW_COLS = ["first_name", "last_name", "official_email", "department", "designation", "location", "joining_date", "employment_status"];

  return (
    <>
      <PageHeader
        title="Import Employees"
        subtitle="Bulk upload via CSV"
        actions={
          <button className="btn btn-secondary btn-sm" onClick={() => router.push("/people")}>
            ← Back
          </button>
        }
      />

      <div className="page-body">
        {/* Download sample */}
        <div className="card" style={{ marginBottom: 20 }}>
          <div className="card-header">
            <div>
              <h2>Step 1 — Download sample CSV</h2>
              <p>Fill in your employee data using this template</p>
            </div>
            <button className="btn btn-primary btn-sm" onClick={downloadSample}>
              ⬇ Download sample.csv
            </button>
          </div>
          <div className="card-body">
            <div style={{ overflowX: "auto" }}>
              <table>
                <thead>
                  <tr>
                    {EXPECTED_HEADERS.map((h) => (
                      <th key={h} style={{ whiteSpace: "nowrap" }}>
                        {h}{REQUIRED.includes(h) ? " *" : ""}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    {EXPECTED_HEADERS.map((h) => (
                      <td key={h} style={{ color: "var(--text-4)", fontStyle: "italic", fontSize: 11 }}>
                        {h === "employment_status" ? "ACTIVE / INACTIVE" :
                         h === "gender" ? "Male / Female" :
                         h === "employment_type" ? "Full Time / Contract / Intern" :
                         h === "department" ? "Sales / HR / Finance…" :
                         h === "location" ? "Delhi Head Office…" :
                         h.endsWith("_date") ? "YYYY-MM-DD" :
                         h === "notice_period_days" ? "30 / 60 / 90" : "text"}
                      </td>
                    ))}
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* Upload */}
        <div className="card" style={{ marginBottom: 20 }}>
          <div className="card-header">
            <div>
              <h2>Step 2 — Upload filled CSV</h2>
              <p>Only .csv files accepted</p>
            </div>
          </div>
          <div className="card-body">
            <input type="file" accept=".csv" onChange={handleFile} />
          </div>
        </div>

        {/* Validation errors */}
        {errors.length > 0 && (
          <div className="alert alert-error" style={{ marginBottom: 20 }}>
            <div>
              <strong>Fix these errors before importing:</strong>
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
              <div>
                <h2>Step 3 — Preview ({rows.length} rows)</h2>
                <p>Verify data before importing</p>
              </div>
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
            ✅ {result.success} imported successfully.
            {result.failed > 0 && ` ❌ ${result.failed} failed — check console for details.`}
          </div>
        )}
      </div>
    </>
  );
}
