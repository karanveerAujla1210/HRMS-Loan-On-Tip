# Loan On Tip HRMS — Technical Architecture (Actual)

## 1. Repository Layout

```
Loan On Tip HRMS/
├── app/
│   ├── (app)/                  # Protected admin/employee web routes
│   │   ├── dashboard/
│   │   ├── people/
│   │   ├── attendance/
│   │   ├── leave/
│   │   ├── payroll/
│   │   ├── assets/
│   │   ├── organisation/
│   │   ├── reports/
│   │   └── self-service/
│   ├── (auth)/
│   │   └── login/
│   ├── api/
│   │   ├── attendance/
│   │   │   ├── check-in/
│   │   │   ├── check-out/
│   │   │   └── correction/
│   │   └── payroll/
│   │       └── calculate/
│   ├── globals.css
│   ├── layout.tsx
│   └── page.tsx
├── components/
│   ├── PageHeader.tsx
│   └── DataTable.tsx
├── lib/
│   ├── api.ts
│   ├── audit.ts
│   ├── auth.ts
│   ├── csv.ts
│   ├── supabase.ts
│   └── useProfile.ts
├── packages/
│   ├── api-contract/           # Shared types (AttendanceStatus, UserRole, etc.)
│   ├── config/                 # Shift times, geo radius, leave types
│   ├── domain/                 # Status labels, permissions, pure calc functions
│   └── ui-tokens/              # Design tokens
├── supabase/
│   ├── config.toml
│   ├── functions/
│   │   └── daily-close/
│   ├── migrations/             # 31 numbered migrations + 2 full-schema files
│   └── seed/
│       └── demo.sql
├── docs/
│   ├── api/routes.md
│   ├── architecture/overview.md
│   └── policies/attendance.md
├── ARCHITECTURE.md
├── README.md
├── package.json
├── tsconfig.json
├── next.config.ts
└── vercel.json
```

## 2. Actual Architecture Findings

### 2.1 Source of Truth
- **Database**: Supabase PostgreSQL with 31 numbered migrations plus 2 full-schema reference files (`full_schema.sql`, `master_consolidated_schema.sql`).
- **Auth**: Supabase Auth (`auth.users` → `profiles` → `employees`).
- **Business Logic**: Split between Next.js API routes, database triggers/functions, and client-side code.

### 2.2 API Layer (Actual)
Only **2 API route groups** exist:
- `POST /api/attendance/check-in`
- `POST /api/attendance/check-out`
- `POST /api/attendance/correction`
- `POST /api/payroll/calculate`

**Critical gap**: Most sensitive operations (employee CRUD, asset assignment, leave approval, payroll approval, document upload) happen **directly from the client** via Supabase JS client, NOT through Next.js API routes. This violates the documented architecture.

### 2.3 Frontend (Actual)
- All pages are `"use client"` components.
- Pages query Supabase directly using the anon key.
- Sensitive writes (employee creation, asset assignment, payroll approval, leave approval) happen client-side.
- No server-side authorization for most operations.
- Rely entirely on RLS for data protection.

### 2.4 Mobile Application
- **No mobile application code exists in the repository.**
- `.gitignore` references `apps/mobile/` but the directory does not exist.
- Mobile is documented in `ARCHITECTURE.md` and `docs/` but not implemented.

### 2.5 Database Schema (Actual)
- **31 numbered migrations** plus `full_schema.sql` and `master_consolidated_schema.sql`.
- Migrations use extensive `CREATE TABLE IF NOT EXISTS`, `DROP POLICY IF EXISTS`, `ALTER TABLE ADD COLUMN IF NOT EXISTS` patterns.
- Multiple migrations rewrite the same objects (views, triggers, RLS policies).
- **Enum conflicts**: `attendance_status_enum` has `LEAVE` in `full_schema.sql` but `ON_LEAVE` in numbered migrations. Both values may exist.
- **Trigger conflict**: `employees.employee_code` is a `GENERATED ALWAYS` column (migration 05) AND a trigger sets it (migration 31). The trigger fires `before insert` but the column is `generated always as` — this will cause errors.
- **Trigger conflict**: `leave_balances.closing_balance` is a `GENERATED ALWAYS` column (migration 07) AND a trigger sets it (migration 31).
- **Missing column**: `notifications` table does not have `is_read` column but migration 31 trigger `update_notification_read` references `new.is_read`.
- **RLS policy proliferation**: Migrations 15, 21, 22, 26, 31 each create/drop policies. Migration 31 drops all permissive policies and recreates proper ones, but earlier migrations may have already applied conflicting policies.
- **Storage RLS**: Migration 28 creates permissive policies allowing all authenticated users full access to private buckets.

### 2.6 Typescript/Build (Actual)
- `tsconfig.json` strict mode is enabled.
- Heavy use of `Record<string, unknown>`, `any`, and type assertions.
- No generated Supabase types (`database.types.ts`) are present.
- **Cannot verify build** — Node.js/npm are not installed in this environment.

## 3. Critical Issues Requiring Immediate Attention

### 3.1 SECURITY — Client-Side Privileged Writes
Many pages write directly to sensitive tables:
- `people/page.tsx` → inserts `employees` directly
- `assets/page.tsx` → inserts `asset_assignments`, `asset_returns`, `asset_maintenance` directly
- `leave/page.tsx` → updates `leave_requests` directly
- `self-service/page.tsx` → inserts `expenses`, `helpdesk_tickets` directly
- `people/[id]/salary/page.tsx` → inserts `employee_salary_assignments` directly
- `people/[id]/exit/page.tsx` → inserts `resignations` directly

These bypass server-side authorization, validation, and audit logging.

### 3.2 SECURITY — Storage RLS Policies
Migration 28 creates policies that allow **all authenticated users** to upload, update, and delete files in private buckets. This means any logged-in user can access any employee's documents.

### 3.3 DATABASE — Schema Conflicts
- `employees.employee_code`: Generated column + trigger = runtime error.
- `leave_balances.closing_balance`: Generated column + trigger = runtime error.
- `notifications.is_read`: Missing column but trigger references it.
- Enum values differ between `full_schema.sql` (`LEAVE`) and numbered migrations (`ON_LEAVE`).

### 3.4 API — Missing Routes
Critical operations lack API routes:
- Employee CRUD
- Leave apply/approve
- Asset assignment/return
- Payroll creation/approval
- Document upload
- Resignation/exit
- Expense approval

### 3.5 PAYROLL — Calculation Issues
- Uses floating-point arithmetic (`Number(...).toFixed(2)`) for monetary values.
- Does not populate `employee_contribution`, `employer_contribution`, `income_tax`, `taxable_income`.
- Does not create `payroll_item_components`.
- Calculation is duplicated in the API route with no shared domain function.
- No Zod validation on request body.

### 3.6 FRONTEND — Type Safety
- Extensive use of `Record<string, unknown>`.
- Incorrect Supabase relationship casting (`as { roles: { code: string } | null }`).
- No generated database types.

### 3.7 MOBILE — Not Implemented
The mobile app is referenced in documentation but has no implementation in the repository.
