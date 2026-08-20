# Loan On Tip HRMS

Responsive MVP for the ACG Leasing Limited brand: employee master, attendance, payroll, company assets and employee self-service. The dashboard is intentionally seeded with demo data so stakeholders can review the experience immediately.

## Run locally

1. Copy `.env.example` to `.env.local` and set the Supabase project URL and anon key.
2. In Supabase, run `supabase/migrations/001_hrms.sql`.
3. Run `npm install`, then `npm run dev`.
4. Deploy the repository to Vercel; set the same environment variables in Vercel.

## Architecture

```
Employee mobile PWA / Admin web (Next.js)
                  │ authenticated API routes
                  ▼
       Supabase Auth + Postgres + Storage + Realtime
                  │
       Edge Functions / scheduled jobs
       ├─ attendance daily close and absent creation
       ├─ payroll calculation and payslip PDF generation
       ├─ asset return/warranty reminders
       └─ notification provider (WhatsApp/SMS/email)
```

Use a single Next.js codebase first: its responsive employee area doubles as an installable PWA. Move only location capture/background attendance to React Native (Expo) if reliable native background tracking becomes a business requirement. Vercel hosts the web/API layer; Supabase is the data, authentication, file and realtime layer. Privileged logic uses server-side routes or Edge Functions with the service-role key only.

## Roles and access

| Role | Access |
|---|---|
| Super Admin | All companies, configuration, reports, audit history and approvals |
| HR Admin | Employees, leaves, attendance corrections, documents and onboarding |
| Manager | Direct-report attendance, leave approval and team roster |
| Finance | Salary structures, payroll runs, payslips and exports |
| Asset Admin | Inventory, assignments, repairs and return clearance |
| Employee | Own attendance, leave, profile, payslip and assigned assets |

## MVP modules

- **People:** employee directory, hierarchy, employment status, joining/offboarding checklist, documents.
- **Attendance:** mobile check-in/out, location validation, calendar, exceptions, manager approvals and daily closure.
- **Payroll:** salary structure, payable days, deductions, pay-run approval, bank export and protected payslip.
- **Assets:** laptop serial/IMEI, company SIM/mobile number, handover condition, repair and return history.
- **Operations dashboard:** location-wise present/late/absent, open approvals, asset risks, attendance export and audit trail.
- **Employee self-service:** check-in/out, attendance calendar, leave request, asset card, payslips and profile update request.

## Attendance rules (sensible MVP defaults)

1. Check-in is allowed within 150 metres of the employee's assigned office location; save coordinates, accuracy and timestamp. A location outside the radius creates an **exception**, not an automatic rejection, so field teams can be approved by a manager.
2. Standard working day is 9:30 AM–6:30 PM, configurable by location/shift. Check-in after the grace period records `late`; under 4 worked hours records `half_day`; no approved check-in by daily close records `absent`.
3. Require foreground location consent at check-in and capture device time. Flag mock-location detection, poor GPS accuracy (>100m), duplicate devices and impossible travel for review. Do not collect continuous background location for the MVP.
4. Lock the prior workday at 11:00 AM; corrections require a reason and approver, both retained in audit logs.

## Payroll model

Monthly gross = Basic + HRA + Conveyance + Special Allowance + approved variable pay. Net pay = Gross − PF/ESI (where applicable) − professional tax − TDS − unpaid leave/loan recovery. Store each approved payslip's immutable JSON breakdown, rather than recalculating history after salary edits. Have Indian payroll/legal rules and statutory eligibility verified by the company accountant before go-live.

## Key APIs

| Method | Route | Purpose |
|---|---|---|
| POST | `/api/attendance/check-in` | Validate auth, geo/shift and create check-in |
| POST | `/api/attendance/check-out` | Record check-out and worked duration |
| GET | `/api/attendance?from&to` | Own or authorized team calendar |
| POST | `/api/leaves` | Submit leave request |
| PATCH | `/api/leaves/:id` | Manager approve/reject |
| GET/POST | `/api/employees` | Directory and onboarding |
| GET/POST | `/api/assets` | Inventory and asset detail |
| POST | `/api/assets/:id/assign` | Assign/recover asset |
| POST | `/api/payroll/runs` | Create calculated draft payroll |
| POST | `/api/payroll/runs/:id/approve` | Finance approval with audit entry |

Every write should validate the signed-in role, use schema validation (Zod), produce an `audit_logs` row and return only data authorized by RLS.

## Delivery plan

1. **Weeks 1–2:** Supabase setup, SSO/OTP, employee master, roles, locations and audit events.
2. **Weeks 3–4:** attendance PWA, leaves, exception workflow and dashboard.
3. **Weeks 5–6:** asset inventory/assignment and employee self-service.
4. **Weeks 7–8:** payroll import/calculation, approval, payslips, reports and security/UAT.

Before launch, obtain HR policy decisions for shift timings, leave types/accrual, payroll statutory setup, field-force attendance and data-retention periods. Add consent language for collecting precise location and restrict it to attendance use.
