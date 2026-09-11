# Database → Frontend Business Domain Mapping

**Source of truth:** `supabase/migrations/*.sql` (43 numbered migrations) — the actual Supabase database.
**Frontend surface:** `apps/web/app/(app)/**` (client pages), `apps/web/app/api/**` (Next.js API routes), `apps/web/lib/**` (shared clients).
This map reflects what **actually exists** in the database, not the aspirational spec.

---

## 1. Organization

| Database object | Kind | Defined in | Consumed by (frontend) |
|---|---|---|---|
| `companies` | table | 02, altered in 42 (`logo_url`, `trade_name`, `tax_id`, `document_number_encrypted`) | `lib/server/auth.ts` (session/company resolution) |
| `locations` | table | 03 | `assets/page`, `assets/import`, `people/page`, `people/import`, `organisation/page`, API `attendance/check-in` (geofence) |
| `departments` | table | 03 | `people/page`, `people/import`, `people/[id]`, `organisation/page`, API `people/import` |
| `teams` | table | 03 | **No frontend consumer yet** |
| `designations` | table | 03 | `people/page`, `people/import`, `people/[id]`, `organisation/page` |
| `employment_types` | table | 03 | `people/import`, API `people/import` |
| `shifts` | table | 03 | `organisation/page`, API `attendance/check-in` |
| `shift_assignments` | table | 03 | **No direct frontend consumer** (used by attendance close engine) |
| `holidays` | table | 03, rewritten in 27 (`holiday_type`, `is_optional`, `description`) | `organisation/page` |
| `weekly_off_rules` | table | 03 | **No frontend consumer** (applied by attendance engine) |
| `v_department_headcount` | view | 24, recreated 40 | `reports/page` |

## 2. Identity, Auth & RBAC

| Database object | Kind | Defined in | Consumed by (frontend) |
|---|---|---|---|
| `profiles` | table | 04 (1:1 with `auth.users`, 1:1 with `employees`) | `app/(app)/layout.tsx`, `people/[id]`, `lib/auth.ts`, `lib/api.ts`, `lib/useProfile.ts`, API `employees/[id]/generate-login` |
| `roles` | table | 12 | Indirect (via `employee_roles` joins) |
| `permissions` | table | 12 | Indirect only — **no direct frontend query** |
| `role_permissions` | table | 12 | Indirect only |
| `employee_roles` | table | 12 | `app/(app)/layout.tsx`, `lib/useProfile.ts`, `lib/api.ts`, `lib/server/auth.ts` |

## 3. Workforce (People)

| Database object | Kind | Defined in | Consumed by (frontend) |
|---|---|---|---|
| `employees` | table | 05, altered 31 (`reviewed_by/at`, `approved_by/at`) | `people/*`, `people/import`, self-service, API `employees`, `employees/[id]`, `generate-login`, `leaves`, `attendance/*`, `assets/[id]/assign`, `people/[id]/exit`, `people/[id]/salary`, `people/[id]/documents` |
| `employee_addresses` | table | 05 | **No frontend consumer yet** |
| `employee_contacts` | table | 05 | **No frontend consumer yet** |
| `employee_emergency_contacts` | table | 05 | **No frontend consumer yet** |
| `employee_bank_accounts` | table | 05, hardened 22 | `payroll/payslip/[id]` |
| `employee_statutory_details` | table | 05, hardened 22 | `payroll/payslip/[id]` |
| `employee_history` | table | 05 | **No frontend consumer yet** (event-sourced history) |
| `employee_manager_history` | table | 05 | **No frontend consumer yet** |
| `custom_fields` | table | 29 (EAV definitions) | `people/[id]`, `organisation/page` |
| `employee_custom_data` | table | 29 (EAV values) | `people/[id]` |
| `resignations` | table | 25 (exit flow) | `people/[id]/exit`, API `people/[id]/exit` |
| `onboarding_tasks` | table | 25 | **No frontend consumer yet** |
| `v_employee_directory` | view | 40 | `people/page`, `assets/page`, API `employees` |
| `v_employee_profile` | view | 24 | `people/[id]/id-card` |

## 4. Attendance

| Database object | Kind | Defined in | Consumed by (frontend) |
|---|---|---|---|
| `attendance` | table | 06 | `self-service`, API `attendance`, `bulk-mark`, `check-in`, `check-out`, `correction`, `payroll/calculate` |
| `attendance_events` | table | 06 (raw punch log) | API `attendance/check-in`, `check-out` only |
| `attendance_exceptions` | table | 06 | `attendance/exceptions`, API `attendance/exceptions`, `attendance/exceptions/[id]` |
| `attendance_adjustments` | table | 06 | `attendance/corrections`, API `attendance/correction` |
| `attendance_monthly_summary` | table | 06 | **No direct frontend consumer** (rollup table) |
| `attendance_close_runs` | table | 35 (daily-close engine) | **No frontend consumer** (Supabase edge function `daily-close`) |
| `v_attendance` | view | 25, recreated 31, 40 | `attendance/page`, `attendance/calendar`, `reports/page` |
| `v_today_attendance` | view | 25, recreated 31, 40 | `dashboard/page` |
| `v_employee_attendance_summary` | view | 24 | **No frontend consumer yet** |

## 5. Leave

| Database object | Kind | Defined in | Consumed by (frontend) |
|---|---|---|---|
| `leave_types` | table | 07 | `leave/page` (apply form), `organisation/page`, `self-service` |
| `leave_policies` | table | 07 | **No direct frontend consumer** |
| `leave_policy_rules` | table | 07 | **No direct frontend consumer** |
| `leave_requests` | table | 07, altered 31 (`status` etc.) | `leave/page`, `reports/page`, `self-service`, API `leaves`, `leaves/[id]` (approval via `apply_leave_approval` RPC) |
| `leave_approvals` | table | 07 (workflow steps) | Indirect — written by `apply_leave_approval` RPC (migration 38) |
| `leave_balances` | table | 07 (accrual/deduction) | `self-service`, API `leaves` |
| `leave_transactions` | table | 07 (ledger) | Indirect — maintained by triggers/RPC |
| `v_pending_leave_approvals` | view | 40 | `dashboard/page`, `leave/page` |
| `v_leave_balances` | view | NOT DEFINED anywhere in SQL | API `leaves/balance` queries it, runtime error |

## 6. Payroll

| Database object | Kind | Defined in | Consumed by (frontend) |
|---|---|---|---|
| `salary_components` | table | 08 | API `payroll/calculate` only |
| `salary_structures` | table | 08 | `people/[id]/salary` |
| `salary_structure_components` | table | 08 | API `payroll/calculate` only |
| `employee_salary_assignments` | table | 08 | `people/[id]/salary`, API `people/[id]/salary`, `people/import` |
| `employee_salary_history` | table | 08, recreated 30 | `people/[id]/salary`, API `people/[id]/salary` |
| `payroll_runs` | table | 08 (workflow enum `payroll_run_status_enum`: DRAFT, CALCULATING, CALCULATED, HR_REVIEW, FINANCE_REVIEW, APPROVED, LOCKED, PAID, CANCELLED) | `payroll/page`, `payroll/[id]`, `reports/page`, API `payroll/runs`, `payroll/runs/[id]`, `payroll/calculate` |
| `payroll_items` | table | 08, altered 32 (`employee_contribution`, `employer_contribution`, `income_tax`, `taxable_income`) | `payroll/[id]`, API `payroll/calculate`, `payroll/runs/[id]` |
| `payroll_item_components` | table | 08 (per-component breakdown) | API `payroll/calculate` only |
| `payroll_adjustments` | table | 08 | **No frontend consumer yet** |
| `payroll_approvals` | table | 08 (workflow steps) | **No frontend consumer yet** |
| `payslips` | table | 08 | `payroll/payslip/[id]`, `self-service`, API `payroll/payslips`, `payroll/runs/[id]`, `payroll/calculate` |

## 7. Assets

| Database object | Kind | Defined in | Consumed by (frontend) |
|---|---|---|---|
| `asset_categories` | table | 09 | `assets/page`, `assets/import`, API `assets`, `assets/import` |
| `asset_brands` | table | 09 | API `assets/import` only |
| `assets` | table | 09 (status enum `asset_status_enum`: AVAILABLE, ASSIGNED, UNDER_REPAIR, LOST, DAMAGED, RETIRED, DISPOSED) | API `assets`, `assets/list`, `assets/import`, `assets/[id]/assign|return|repair` |
| `asset_assignments` | table | 09 | `self-service`, `people/[id]/assets`, `people/[id]/exit`, API `assets/[id]/assign|return` |
| `asset_handover` | table | 09, rewritten 26 | API `assets/[id]/assign` only |
| `asset_returns` | table | 09, rewritten 26, altered 31 | API `assets/[id]/return` only |
| `asset_maintenance` | table | 09, rewritten 26 | `assets/maintenance`, API `assets/maintenance`, `assets/maintenance/[id]`, `assets/[id]/repair` |
| `asset_audit` | table | 09 (asset audit trail) | **No frontend consumer yet** |
| `asset_documents` | table | 10 | **No frontend consumer yet** (bucket `asset_documents` exists) |
| `v_asset_inventory` | view | 26, recreated 40 | `assets/page`, `assets/maintenance`, `reports/page` |
| `v_asset_maintenance` | view | 26 | `assets/maintenance` |

## 8. Documents

| Database object | Kind | Defined in | Consumed by (frontend) |
|---|---|---|---|
| `document_types` | table | 10, altered 30 | `people/[id]/documents` |
| `employee_documents` | table | 10 | `people/[id]/documents`, API `people/[id]/documents`, `people/[id]/documents/[docId]` |
| `document_access_logs` | table | 10 | **No frontend consumer** (populated by triggers) |
| Storage buckets `employee_documents`, `asset_documents` | storage | 28 (private) | `people/[id]/documents` (path/URL field) |

## 9. Notifications

| Database object | Kind | Defined in | Consumed by (frontend) |
|---|---|---|---|
| `notifications` | table | 11, altered 32 & 42 (`is_read`) | `app/(app)/layout.tsx` (bell/unread badge) |
| `notification_templates` | table | 11 | **No frontend consumer** (system-generated) |
| `notification_preferences` | table | 11 | **No frontend consumer yet** |
| `notification_delivery_logs` | table | 11 | **No frontend consumer** (delivery audit) |

## 10. Self-Service (Extras beyond the spec)

| Database object | Kind | Defined in | Consumed by (frontend) |
|---|---|---|---|
| `expenses` | table | 25 | `self-service`, API `expenses`, `expenses/list` |
| `helpdesk_tickets` | table | 25 | `self-service`, API `helpdesk` |
| `v_helpdesk_tickets` | view | 31 | **No direct consumer** (page reads base table) |
| `goals` | table | 25 | **No frontend consumer yet** |
| `performance_reviews` | table | 25 | **No frontend consumer yet** |
| `v_resignations` | view | 31 | **No direct consumer** (exit page reads base table) |

## 11. Cross-Cutting (Audit / Platform)

| Database object | Kind | Defined in | Consumed by (frontend) |
|---|---|---|---|
| `audit_logs` | table | 13 | `reports/page`, API `audit`, `lib/server/audit.ts` |
| `api_logs` | table | 13 | `lib/server/audit.ts` only |
| `idempotency_keys` | table | 13 | `lib/server/idempotency.ts` only |
| `system_settings` | table | 13 | API `settings`, `lib/server/settings.ts` |

## Key DB Functions / RPCs used by the frontend

| Function | Defined in | Called from |
|---|---|---|
| `apply_leave_approval` | 38 (atomic approval) | API `leaves/[id]` |
| `calculate_attendance_status` | 14 | API `attendance/check-out` |
| `get_dashboard_metrics` | 37 | API `dashboard/metrics` |
| `next_asset_code` | asset migrations | API `assets`, `assets/import` |

---

## Deltas vs. the original spec

**In the database but NOT in the spec list:**
- RBAC model (`roles`, `permissions`, `role_permissions`, `employee_roles`) and `profiles`
- Employee satellite tables (addresses, contacts, emergency contacts, bank accounts, statutory details, manager history)
- Dynamic fields engine (`custom_fields`, `employee_custom_data` - EAV)
- Self-service suite (`expenses`, `helpdesk_tickets`, `goals`, `performance_reviews`) and exit flow (`resignations`, `onboarding_tasks`)
- Attendance engine internals (`attendance_events`, `attendance_monthly_summary`, `attendance_close_runs`)
- Cross-cutting: `audit_logs`, `api_logs`, `idempotency_keys`, `system_settings`, notification templates/preferences/delivery logs, `asset_audit`

**In the spec list but NOT in the database:**
- "Organizational hierarchy" as a dedicated structure - no table; hierarchy is expressed via `employees.manager_id` + `employee_manager_history` and `departments`/`teams` FKs.
- No dedicated "asset handover acknowledgment" workflow beyond the `asset_handover` table.
- "HR notifications" is not a separate table - HR-targeted notifications live in the same `notifications` table.

## Known gaps / risks discovered while mapping

1. **`v_leave_balances` does not exist.** `app/api/leaves/balance/route.ts` selects from it, but no migration ever creates it, so that endpoint fails at runtime. Either create the view or point the route at `leave_balances`.
2. **Enum drift:** `attendance_status_enum` contains `LEAVE` in `01_extensions.sql`; the historical `full_schema.sql` used `ON_LEAVE`. Numbered migrations are authoritative.
3. **Dormant tables:** `teams`, `weekly_off_rules`, `goals`, `performance_reviews`, `onboarding_tasks`, `payroll_adjustments`, `payroll_approvals`, `asset_audit`, `employee_addresses`/`employee_contacts`/`employee_emergency_contacts`, `notification_preferences` are created but have **zero frontend consumers** - candidate surface area for future modules.
4. **View churn:** `v_dashboard_metrics`, `v_today_attendance`, `v_asset_inventory`, `v_pending_leave_approvals` are dropped/recreated in migrations 24, 26, 31, and 40 - the migration-40 versions are current.
