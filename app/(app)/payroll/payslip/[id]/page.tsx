"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import PageHeader from "@/components/PageHeader";

type Row = Record<string, unknown>;

function numberToIndianWords(num: number): string {
  if (!num || num === 0) return "Zero Rupees Only";
  const a = [
    "", "One", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight", "Nine", "Ten",
    "Eleven", "Twelve", "Thirteen", "Fourteen", "Fifteen", "Sixteen", "Seventeen", "Eighteen", "Nineteen",
  ];
  const b = ["", "", "Twenty", "Thirty", "Forty", "Fifty", "Sixty", "Seventy", "Eighty", "Ninety"];

  function inWords(n: number): string {
    if (n < 20) return a[n];
    if (n < 100) return b[Math.floor(n / 10)] + (n % 10 !== 0 ? " " + a[n % 10] : "");
    if (n < 1000) return a[Math.floor(n / 100)] + " Hundred" + (n % 100 !== 0 ? " and " + inWords(n % 100) : "");
    if (n < 100000) return inWords(Math.floor(n / 1000)) + " Thousand" + (n % 1000 !== 0 ? " " + inWords(n % 1000) : "");
    if (n < 10000000) return inWords(Math.floor(n / 100000)) + " Lakh" + (n % 100000 !== 0 ? " " + inWords(n % 100000) : "");
    return inWords(Math.floor(n / 10000000)) + " Crore" + (n % 10000000 !== 0 ? " " + inWords(n % 10000000) : "");
  }

  const rounded = Math.round(num);
  return `Rupees ${inWords(rounded)} Only`;
}

export default function PayslipViewPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [data, setData] = useState<Row | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);

    // Try finding by payslip id first, then by payroll_item_id
    let { data: slip } = await supabase
      .from("payslips")
      .select(`
        id, payslip_number, gross_salary, deductions, net_salary, payslip_json, generated_at,
        payroll_run:payroll_run_id(payroll_month, payroll_year, period_start, period_end, company:company_id(name, registration_number)),
        employee:employee_id(
          id, display_name, employee_code, official_email, joining_date,
          department:department_id(name),
          designation:designation_id(name),
          location:location_id(name)
        ),
        payroll_item:payroll_item_id(working_days, paid_days, lop_days, absent_days, leave_days)
      `)
      .eq("id", id)
      .maybeSingle();

    if (!slip) {
      const { data: byItem } = await supabase
        .from("payslips")
        .select(`
          id, payslip_number, gross_salary, deductions, net_salary, payslip_json, generated_at,
          payroll_run:payroll_run_id(payroll_month, payroll_year, period_start, period_end, company:company_id(name, registration_number)),
          employee:employee_id(
            id, display_name, employee_code, official_email, joining_date,
            department:department_id(name),
            designation:designation_id(name),
            location:location_id(name)
          ),
          payroll_item:payroll_item_id(working_days, paid_days, lop_days, absent_days, leave_days)
        `)
        .eq("payroll_item_id", id)
        .maybeSingle();
      slip = byItem;
    }

    if (!slip) {
      setError("Payslip not found.");
      setLoading(false);
      return;
    }

    // Fetch employee statutory & bank details
    const empRelation = (slip.employee as unknown) as { id: string }[] | { id: string } | null;
    const empId = (Array.isArray(empRelation) ? empRelation[0] : empRelation)?.id ?? null;
    let bankInfo = null;
    let statInfo = null;
    if (empId) {
      const [bRes, sRes] = await Promise.all([
        supabase.from("employee_bank_accounts").select("bank_name,account_number_last4,ifsc_code").eq("employee_id", empId).eq("is_primary", true).maybeSingle(),
        supabase.from("employee_statutory_details").select("pan_last4,uan,pf_number,tax_regime").eq("employee_id", empId).maybeSingle(),
      ]);
      bankInfo = bRes.data;
      statInfo = sRes.data;
    }

    setData({
      ...slip,
      bank: bankInfo,
      statutory: statInfo,
    });
    setLoading(false);
  }, [id]);

  useEffect(() => { void load(); }, [load]);

  if (loading) {
    return (
      <div className="loading-spinner" style={{ minHeight: "80vh" }}>
        <div className="spinner" /> Loading payslip…
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="page-body">
        <div className="alert alert-error">{error ?? "Payslip not available."}</div>
        <button className="btn btn-secondary btn-sm" onClick={() => router.back()} style={{ marginTop: 12 }}>← Back</button>
      </div>
    );
  }

  const MONTH_NAMES = ["January","February","March","April","May","June","July","August","September","October","November","December"];
  const run = (data.payroll_run as unknown) as Record<string, unknown> | null;
  const company = (run?.company as unknown) as Record<string, unknown> | null;
  const emp = (data.employee as unknown) as Record<string, unknown> | null;
  const item = (data.payroll_item as unknown) as Record<string, unknown> | null;
  const bank = (data.bank as unknown) as Record<string, unknown> | null;
  const statutory = (data.statutory as unknown) as Record<string, unknown> | null;
  const dept = (emp?.department as unknown) as Record<string, unknown> | null;
  const desig = (emp?.designation as unknown) as Record<string, unknown> | null;
  const loc = (emp?.location as unknown) as Record<string, unknown> | null;

  const monthNum = Number(run?.payroll_month ?? 1);
  const periodTitle = `${MONTH_NAMES[monthNum - 1]} ${run?.payroll_year}`;
  const gross = Number(data.gross_salary ?? 0);
  const deductions = Number(data.deductions ?? 0);
  const net = Number(data.net_salary ?? 0);

  // Breakdown estimation or JSON breakdown
  const pj = (data.payslip_json as Record<string, unknown>) ?? {};
  const basic = Number(pj.basic ?? (gross * 0.4).toFixed(2));
  const hra = Number(pj.hra ?? (gross * 0.2).toFixed(2));
  const conveyance = Number(pj.conveyance ?? (gross * 0.1).toFixed(2));
  const special = Number(pj.special ?? (gross - basic - hra - conveyance).toFixed(2));

  const pf = Number(pj.pf ?? Math.min(deductions > 200 ? deductions - 200 : 0, 1800));
  const pt = Number(pj.pt ?? (deductions >= 200 ? 200 : 0));
  const otherDed = Number(pj.other_deductions ?? (deductions - pf - pt > 0 ? deductions - pf - pt : 0));

  return (
    <>
      <PageHeader
        title={`Payslip — ${periodTitle}`}
        subtitle={String(emp?.display_name ?? "")}
        actions={
          <div style={{ display: "flex", gap: 8 }}>
            <button className="btn btn-secondary btn-sm" onClick={() => router.back()}>← Back</button>
            <button className="btn btn-primary btn-sm" onClick={() => window.print()}>
              🖨 Print / Download PDF
            </button>
          </div>
        }
      />

      <div className="page-body" style={{ display: "flex", justifyContent: "center" }}>
        {/* Printable Payslip Card */}
        <div
          id="printable-payslip"
          style={{
            width: "100%",
            maxWidth: 780,
            background: "#ffffff",
            borderRadius: 12,
            border: "1px solid var(--border)",
            boxShadow: "0 4px 24px rgba(0,0,0,0.06)",
            padding: "36px 40px",
            color: "#1e293b",
            fontFamily: "Inter, sans-serif",
          }}
        >
          {/* Header */}
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", borderBottom: "2px solid #0f172a", paddingBottom: 18 }}>
            <div>
              <div style={{ fontSize: 24, fontWeight: 800, color: "#0f172a", letterSpacing: "-0.5px" }}>
                {String(company?.name ?? "ACG LEASING LIMITED")}
              </div>
              <div style={{ fontSize: 13, color: "#64748b", marginTop: 3 }}>
                Brand: <strong>Loan On Tip</strong> · Reg: {String(company?.registration_number ?? "U65923DL2018PLC338821")}
              </div>
              <div style={{ fontSize: 12, color: "#64748b" }}>
                Head Office: 2nd Floor, Commercial Complex, Delhi - 110001
              </div>
            </div>
            <div style={{ textAlign: "right" }}>
              <span style={{
                background: "#0f172a", color: "#fff",
                fontSize: 11, fontWeight: 700, padding: "4px 10px",
                borderRadius: 4, letterSpacing: "1px", textTransform: "uppercase"
              }}>
                PAYSLIP
              </span>
              <div style={{ fontSize: 13, fontWeight: 700, marginTop: 8, color: "#0f172a" }}>
                {periodTitle}
              </div>
              <div style={{ fontSize: 11, color: "#64748b" }}>
                Ref: {String(data.payslip_number ?? `PAY-${run?.payroll_year}-${String(monthNum).padStart(2, "0")}`)}
              </div>
            </div>
          </div>

          {/* Employee & Pay Period Details Grid */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px 24px", padding: "18px 0", borderBottom: "1px solid #e2e8f0", fontSize: 13 }}>
            <div><span style={{ color: "#64748b" }}>Employee Name:</span> <strong>{String(emp?.display_name ?? "—")}</strong></div>
            <div><span style={{ color: "#64748b" }}>Employee Code:</span> <strong>{String(emp?.employee_code ?? "—")}</strong></div>
            <div><span style={{ color: "#64748b" }}>Department:</span> {String(dept?.name ?? "—")}</div>
            <div><span style={{ color: "#64748b" }}>Designation:</span> {String(desig?.name ?? "—")}</div>
            <div><span style={{ color: "#64748b" }}>Location:</span> {String(loc?.name ?? "Delhi")}</div>
            <div><span style={{ color: "#64748b" }}>Date of Joining:</span> {String(emp?.joining_date ?? "—")}</div>
            <div><span style={{ color: "#64748b" }}>Bank Name:</span> {String(bank?.bank_name ?? "HDFC Bank")}</div>
            <div><span style={{ color: "#64748b" }}>Bank A/C (Last 4):</span> •••• {String(bank?.account_number_last4 ?? "XXXX")}</div>
            <div><span style={{ color: "#64748b" }}>PAN:</span> •••• {String(statutory?.pan_last4 ?? "XXXX")}</div>
            <div><span style={{ color: "#64748b" }}>UAN:</span> {String(statutory?.uan ?? "—")}</div>
          </div>

          {/* Attendance Metrics */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 12, padding: "12px 0", borderBottom: "1px solid #e2e8f0", textAlign: "center", background: "#f8fafc", borderRadius: 6, margin: "14px 0" }}>
            <div>
              <div style={{ fontSize: 10, fontWeight: 700, color: "#64748b", textTransform: "uppercase" }}>Total Days</div>
              <div style={{ fontSize: 15, fontWeight: 700, color: "#0f172a" }}>{Number(item?.working_days ?? 30)}</div>
            </div>
            <div>
              <div style={{ fontSize: 10, fontWeight: 700, color: "#64748b", textTransform: "uppercase" }}>Paid Days</div>
              <div style={{ fontSize: 15, fontWeight: 700, color: "#16a34a" }}>{Number(item?.paid_days ?? 30)}</div>
            </div>
            <div>
              <div style={{ fontSize: 10, fontWeight: 700, color: "#64748b", textTransform: "uppercase" }}>Loss of Pay (LOP)</div>
              <div style={{ fontSize: 15, fontWeight: 700, color: "#dc2626" }}>{Number(item?.lop_days ?? 0)}</div>
            </div>
            <div>
              <div style={{ fontSize: 10, fontWeight: 700, color: "#64748b", textTransform: "uppercase" }}>Leaves Taken</div>
              <div style={{ fontSize: 15, fontWeight: 700, color: "#6366f1" }}>{Number(item?.leave_days ?? 0)}</div>
            </div>
          </div>

          {/* Earnings & Deductions Table */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 24, margin: "16px 0" }}>
            {/* Earnings */}
            <div>
              <div style={{ background: "#f1f5f9", padding: "8px 12px", fontWeight: 700, fontSize: 13, borderBottom: "2px solid #cbd5e1" }}>
                EARNINGS
              </div>
              <table style={{ width: "100%", fontSize: 13, borderCollapse: "collapse", marginTop: 6 }}>
                <tbody>
                  <tr style={{ borderBottom: "1px solid #f1f5f9" }}>
                    <td style={{ padding: "8px 4px", color: "#475569" }}>Basic Salary</td>
                    <td style={{ padding: "8px 4px", textAlign: "right", fontWeight: 600 }}>₹{basic.toLocaleString("en-IN")}</td>
                  </tr>
                  <tr style={{ borderBottom: "1px solid #f1f5f9" }}>
                    <td style={{ padding: "8px 4px", color: "#475569" }}>House Rent Allowance (HRA)</td>
                    <td style={{ padding: "8px 4px", textAlign: "right", fontWeight: 600 }}>₹{hra.toLocaleString("en-IN")}</td>
                  </tr>
                  <tr style={{ borderBottom: "1px solid #f1f5f9" }}>
                    <td style={{ padding: "8px 4px", color: "#475569" }}>Conveyance Allowance</td>
                    <td style={{ padding: "8px 4px", textAlign: "right", fontWeight: 600 }}>₹{conveyance.toLocaleString("en-IN")}</td>
                  </tr>
                  <tr style={{ borderBottom: "1px solid #f1f5f9" }}>
                    <td style={{ padding: "8px 4px", color: "#475569" }}>Special / Other Allowance</td>
                    <td style={{ padding: "8px 4px", textAlign: "right", fontWeight: 600 }}>₹{special.toLocaleString("en-IN")}</td>
                  </tr>
                </tbody>
              </table>
            </div>

            {/* Deductions */}
            <div>
              <div style={{ background: "#f1f5f9", padding: "8px 12px", fontWeight: 700, fontSize: 13, borderBottom: "2px solid #cbd5e1" }}>
                DEDUCTIONS
              </div>
              <table style={{ width: "100%", fontSize: 13, borderCollapse: "collapse", marginTop: 6 }}>
                <tbody>
                  <tr style={{ borderBottom: "1px solid #f1f5f9" }}>
                    <td style={{ padding: "8px 4px", color: "#475569" }}>Provident Fund (Employee PF)</td>
                    <td style={{ padding: "8px 4px", textAlign: "right", fontWeight: 600 }}>₹{pf.toLocaleString("en-IN")}</td>
                  </tr>
                  <tr style={{ borderBottom: "1px solid #f1f5f9" }}>
                    <td style={{ padding: "8px 4px", color: "#475569" }}>Professional Tax (PT)</td>
                    <td style={{ padding: "8px 4px", textAlign: "right", fontWeight: 600 }}>₹{pt.toLocaleString("en-IN")}</td>
                  </tr>
                  <tr style={{ borderBottom: "1px solid #f1f5f9" }}>
                    <td style={{ padding: "8px 4px", color: "#475569" }}>TDS / Income Tax</td>
                    <td style={{ padding: "8px 4px", textAlign: "right", fontWeight: 600 }}>₹0.00</td>
                  </tr>
                  {otherDed > 0 && (
                    <tr style={{ borderBottom: "1px solid #f1f5f9" }}>
                      <td style={{ padding: "8px 4px", color: "#475569" }}>Other Deductions / Loan</td>
                      <td style={{ padding: "8px 4px", textAlign: "right", fontWeight: 600 }}>₹{otherDed.toLocaleString("en-IN")}</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Subtotals */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 24, padding: "10px 0", borderTop: "1px solid #cbd5e1", borderBottom: "2px solid #0f172a", fontSize: 13, fontWeight: 700 }}>
            <div style={{ display: "flex", justifyContent: "space-between" }}>
              <span>TOTAL GROSS EARNINGS</span>
              <span>₹{gross.toLocaleString("en-IN")}</span>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between" }}>
              <span>TOTAL DEDUCTIONS</span>
              <span style={{ color: "#dc2626" }}>₹{deductions.toLocaleString("en-IN")}</span>
            </div>
          </div>

          {/* Net Salary Highlight Box */}
          <div style={{ background: "#f8fafc", border: "1px solid #cbd5e1", borderRadius: 8, padding: "16px 20px", marginTop: 18, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div>
              <div style={{ fontSize: 11, fontWeight: 700, color: "#64748b", textTransform: "uppercase", letterSpacing: "0.5px" }}>
                NET TAKE-HOME SALARY
              </div>
              <div style={{ fontSize: 13, color: "#475569", marginTop: 4, fontStyle: "italic" }}>
                {numberToIndianWords(net)}
              </div>
            </div>
            <div style={{ fontSize: 26, fontWeight: 800, color: "#0f172a", letterSpacing: "-0.5px" }}>
              ₹{net.toLocaleString("en-IN")}
            </div>
          </div>

          {/* Footer & Signatures */}
          <div style={{ marginTop: 36, paddingTop: 18, borderTop: "1px solid #e2e8f0", display: "flex", justifyContent: "space-between", alignItems: "flex-end", fontSize: 11, color: "#94a3b8" }}>
            <div>
              <p>This is a computer-generated document and does not require a physical signature.</p>
              <p style={{ marginTop: 2 }}>Generated on {new Date().toLocaleDateString("en-IN", { year: "numeric", month: "short", day: "numeric" })} · Confidential</p>
            </div>
            <div style={{ textAlign: "center" }}>
              <div style={{ height: 32 }} />
              <div style={{ borderTop: "1px solid #94a3b8", width: 160, paddingTop: 4, color: "#64748b", fontWeight: 600 }}>
                Authorized Signatory
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
