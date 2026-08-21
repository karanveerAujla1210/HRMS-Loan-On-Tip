-- ==============================================================================
-- LOAN ON TIP HRMS — SCHEMA, RLS AND DATA FIXES
-- ==============================================================================

-- ── 1. FIX EMPLOYEE CODE TRIGGER ──────────────────────────────────────────────
drop trigger if exists trg_employees_set_code on public.employees;

create or replace function public.set_employee_code()
returns trigger language plpgsql as $$
begin
  if new.employee_code is null then
    new.employee_code := 'EMP-' || lpad(nextval('public.employee_code_seq')::text, 6, '0');
  end if;
  return new;
end;
$$;

create trigger trg_employees_set_code
  before insert on public.employees
  for each row execute function public.set_employee_code();

-- ── 2. FIX AUTH_EMPLOYEE_ID NULL HANDLING ─────────────────────────────────────
create or replace function public.auth_employee_id()
returns uuid language sql stable security definer as $$
  select employee_id from public.profiles
  where auth_user_id = auth.uid()
  limit 1;
$$;

-- ── 3. ADD MISSING CHECK CONSTRAINTS ─────────────────────────────────────────
alter table public.resignations
  add constraint if not exists chk_resignations_status
  check (status in ('SUBMITTED','UNDER_REVIEW','APPROVED','REJECTED','WITHDRAWN','COMPLETED'));

alter table public.expenses
  add constraint if not exists chk_expenses_status
  check (status in ('PENDING','APPROVED','REJECTED','PAID','CANCELLED'));

alter table public.attendance_adjustments
  add constraint if not exists chk_attendance_adjustments_status
  check (status in ('PENDING','APPROVED','REJECTED'));

alter table public.asset_assignments
  add constraint if not exists chk_asset_assignments_status
  check (status in ('ACTIVE','RETURNED','OVERDUE','CANCELLED'));

alter table public.asset_returns
  add constraint if not exists chk_asset_returns_condition
  check (condition_at_return in ('GOOD','DAMAGED','LOST','FAIR'));

alter table public.helpdesk_tickets
  add constraint if not exists chk_helpdesk_status
  check (status in ('OPEN','IN_PROGRESS','RESOLVED','CLOSED'));

alter table public.payroll_runs
  add constraint if not exists chk_payroll_year
  check (payroll_year >= 2000 and payroll_year <= 2100);

alter table public.payroll_items
  add constraint if not exists chk_payroll_item_status
  check (status in ('DRAFT','CALCULATED','APPROVED','PAID','CANCELLED'));

-- ── 4. ADD MISSING COLUMNS ────────────────────────────────────────────────────
alter table public.asset_returns add column if not exists status varchar(20) not null default 'PENDING';
alter table public.asset_returns add column if not exists approved_by uuid references public.employees on delete set null;
alter table public.asset_returns add column if not exists approved_at timestamptz;

alter table public.leave_requests add column if not exists reviewed_by uuid references public.employees on delete set null;
alter table public.leave_requests add column if not exists reviewed_at timestamptz;

alter table public.employees add column if not exists user_id uuid references auth.users on delete set null;

-- ── 5. ADD UNIQUE CONSTRAINTS ────────────────────────────────────────────────
create unique index if not exists uq_employee_roles on public.employee_roles(employee_id, role_id) where is_active = true;
create unique index if not exists uq_leave_balances on public.leave_balances(employee_id, leave_type_id, year);
create unique index if not exists uq_shift_assignments on public.shift_assignments(employee_id) where is_current = true;

-- ── 6. FIX CLOSING BALANCE TRIGGER ───────────────────────────────────────────
create or replace function public.update_leave_closing_balance()
returns trigger language plpgsql as $$
begin
  new.closing_balance := new.opening_balance + new.accrued - new.used;
  return new;
end;
$$;

drop trigger if exists trg_leave_balance_closing on public.leave_balances;
create trigger trg_leave_balance_closing
  before insert or update of opening_balance, accrued, used on public.leave_balances
  for each row execute function public.update_leave_closing_balance();

-- ── 7. FIX ATTENDANCE STATUS TRIGGER ─────────────────────────────────────────
create or replace function public.update_attendance_status()
returns trigger language plpgsql as $$
begin
  if new.check_in_at is null and new.check_out_at is null then
    new.status := 'ABSENT';
  elsif new.check_in_at is not null and new.check_out_at is null then
    new.status := 'PRESENT';
  elsif new.worked_minutes < 240 then
    new.status := 'HALF_DAY';
  elsif new.late_minutes > 0 then
    new.status := 'LATE';
  else
    new.status := 'PRESENT';
  end if;
  return new;
end;
$$;

drop trigger if exists trg_attendance_status on public.attendance;
create trigger trg_attendance_status
  before insert or update of check_in_at, check_out_at, worked_minutes, late_minutes on public.attendance
  for each row execute function public.update_attendance_status();

-- ── 8. FIX RLS POLICIES — REMOVE PERMISSIVE POLICIES ─────────────────────────
drop policy if exists "employees: all select" on public.employees;
drop policy if exists "employees: all insert" on public.employees;
drop policy if exists "employees: all update" on public.employees;

drop policy if exists "assets: all select" on public.assets;
drop policy if exists "assets: all insert" on public.assets;
drop policy if exists "assets: all update" on public.assets;

drop policy if exists "asset_assignments: all" on public.asset_assignments;
drop policy if exists "asset_maintenance: all" on public.asset_maintenance;
drop policy if exists "asset_handover: all" on public.asset_handover;
drop policy if exists "asset_returns: all" on public.asset_returns;
drop policy if exists "asset_categories: all" on public.asset_categories;
drop policy if exists "asset_brands: all" on public.asset_brands;
drop policy if exists "attendance: all" on public.attendance;
drop policy if exists "leave_requests: all" on public.leave_requests;
drop policy if exists "leave_balances: all" on public.leave_balances;
drop policy if exists "payroll_runs: all" on public.payroll_runs;
drop policy if exists "payroll_items: all" on public.payroll_items;
drop policy if exists "payslips: all" on public.payslips;
drop policy if exists "expenses: all" on public.expenses;
drop policy if exists "helpdesk_tickets: all" on public.helpdesk_tickets;
drop policy if exists "resignations: all" on public.resignations;
drop policy if exists "documents: all" on public.employee_documents;
drop policy if exists "bank: all" on public.employee_bank_accounts;
drop policy if exists "statutory: all" on public.employee_statutory_details;

-- ── 9. CREATE PROPER RLS POLICIES ─────────────────────────────────────────────

-- Employees: self read/write, admin/HR all
create policy "employees: read own" on public.employees for select using (id = public.auth_employee_id());
create policy "employees: read all for admin/hr" on public.employees for select using (
  exists (select 1 from public.employee_roles er join public.roles r on r.id = er.role_id where er.employee_id = public.auth_employee_id() and er.is_active = true and r.code in ('SUPER_ADMIN','HR_ADMIN'))
);
create policy "employees: update own" on public.employees for update using (id = public.auth_employee_id());
create policy "employees: update all for admin/hr" on public.employees for update using (
  exists (select 1 from public.employee_roles er join public.roles r on r.id = er.role_id where er.employee_id = public.auth_employee_id() and er.is_active = true and r.code in ('SUPER_ADMIN','HR_ADMIN'))
);
create policy "employees: insert for admin/hr" on public.employees for insert with check (
  exists (select 1 from public.employee_roles er join public.roles r on r.id = er.role_id where er.employee_id = public.auth_employee_id() and er.is_active = true and r.code in ('SUPER_ADMIN','HR_ADMIN'))
);

-- Attendance: self read/write, manager/admin all
create policy "attendance: read own" on public.attendance for select using (employee_id = public.auth_employee_id());
create policy "attendance: read all for admin/manager" on public.attendance for select using (
  exists (select 1 from public.employee_roles er join public.roles r on r.id = er.role_id where er.employee_id = public.auth_employee_id() and er.is_active = true and r.code in ('SUPER_ADMIN','HR_ADMIN','MANAGER'))
);
create policy "attendance: insert own" on public.attendance for insert with check (employee_id = public.auth_employee_id());
create policy "attendance: update all for admin/manager" on public.attendance for update using (
  exists (select 1 from public.employee_roles er join public.roles r on r.id = er.role_id where er.employee_id = public.auth_employee_id() and er.is_active = true and r.code in ('SUPER_ADMIN','HR_ADMIN','MANAGER'))
);

-- Leave requests: self read/write, manager/admin all
create policy "leave_requests: read own" on public.leave_requests for select using (employee_id = public.auth_employee_id());
create policy "leave_requests: read all for admin/manager" on public.leave_requests for select using (
  exists (select 1 from public.employee_roles er join public.roles r on r.id = er.role_id where er.employee_id = public.auth_employee_id() and er.is_active = true and r.code in ('SUPER_ADMIN','HR_ADMIN','MANAGER'))
);
create policy "leave_requests: insert own" on public.leave_requests for insert with check (employee_id = public.auth_employee_id());
create policy "leave_requests: update all for admin/manager" on public.leave_requests for update using (
  exists (select 1 from public.employee_roles er join public.roles r on r.id = er.role_id where er.employee_id = public.auth_employee_id() and er.is_active = true and r.code in ('SUPER_ADMIN','HR_ADMIN','MANAGER'))
);

-- Leave balances: self read, admin/hr all
create policy "leave_balances: read own" on public.leave_balances for select using (employee_id = public.auth_employee_id());
create policy "leave_balances: read all for admin/hr" on public.leave_balances for select using (
  exists (select 1 from public.employee_roles er join public.roles r on r.id = er.role_id where er.employee_id = public.auth_employee_id() and er.is_active = true and r.code in ('SUPER_ADMIN','HR_ADMIN'))
);
create policy "leave_balances: update all for admin/hr" on public.leave_balances for update using (
  exists (select 1 from public.employee_roles er join public.roles r on r.id = er.role_id where er.employee_id = public.auth_employee_id() and er.is_active = true and r.code in ('SUPER_ADMIN','HR_ADMIN'))
);

-- Assets: self read, admin/operations all
create policy "assets: read own" on public.assets for select using (current_employee_id = public.auth_employee_id());
create policy "assets: read all for admin/operations" on public.assets for select using (
  exists (select 1 from public.employee_roles er join public.roles r on r.id = er.role_id where er.employee_id = public.auth_employee_id() and er.is_active = true and r.code in ('SUPER_ADMIN','HR_ADMIN','OPERATIONS_ADMIN'))
);
create policy "assets: insert for admin" on public.assets for insert with check (
  exists (select 1 from public.employee_roles er join public.roles r on r.id = er.role_id where er.employee_id = public.auth_employee_id() and er.is_active = true and r.code in ('SUPER_ADMIN','HR_ADMIN'))
);
create policy "assets: update for admin/operations" on public.assets for update using (
  exists (select 1 from public.employee_roles er join public.roles r on r.id = er.role_id where er.employee_id = public.auth_employee_id() and er.is_active = true and r.code in ('SUPER_ADMIN','HR_ADMIN','OPERATIONS_ADMIN'))
);

-- Asset assignments: self read, admin/operations all
create policy "asset_assignments: read own" on public.asset_assignments for select using (employee_id = public.auth_employee_id());
create policy "asset_assignments: read all for admin/operations" on public.asset_assignments for select using (
  exists (select 1 from public.employee_roles er join public.roles r on r.id = er.role_id where er.employee_id = public.auth_employee_id() and er.is_active = true and r.code in ('SUPER_ADMIN','HR_ADMIN','OPERATIONS_ADMIN'))
);
create policy "asset_assignments: insert for admin/operations" on public.asset_assignments for insert with check (
  exists (select 1 from public.employee_roles er join public.roles r on r.id = er.role_id where er.employee_id = public.auth_employee_id() and er.is_active = true and r.code in ('SUPER_ADMIN','HR_ADMIN','OPERATIONS_ADMIN'))
);
create policy "asset_assignments: update for admin/operations" on public.asset_assignments for update using (
  exists (select 1 from public.employee_roles er join public.roles r on r.id = er.role_id where er.employee_id = public.auth_employee_id() and er.is_active = true and r.code in ('SUPER_ADMIN','HR_ADMIN','OPERATIONS_ADMIN'))
);

-- Asset categories/brands: read all, write admin only
create policy "asset_categories: read all" on public.asset_categories for select using (true);
create policy "asset_categories: write admin" on public.asset_categories for all using (
  exists (select 1 from public.employee_roles er join public.roles r on r.id = er.role_id where er.employee_id = public.auth_employee_id() and er.is_active = true and r.code = 'SUPER_ADMIN')
);
create policy "asset_brands: read all" on public.asset_brands for select using (true);
create policy "asset_brands: write admin" on public.asset_brands for all using (
  exists (select 1 from public.employee_roles er join public.roles r on r.id = er.role_id where er.employee_id = public.auth_employee_id() and er.is_active = true and r.code = 'SUPER_ADMIN')
);

-- Asset maintenance: read all, write admin/operations
create policy "asset_maintenance: read all" on public.asset_maintenance for select using (true);
create policy "asset_maintenance: write admin/operations" on public.asset_maintenance for all using (
  exists (select 1 from public.employee_roles er join public.roles r on r.id = er.role_id where er.employee_id = public.auth_employee_id() and er.is_active = true and r.code in ('SUPER_ADMIN','HR_ADMIN','OPERATIONS_ADMIN'))
);

-- Asset handover: read all, write admin/operations
create policy "asset_handover: read all" on public.asset_handover for select using (true);
create policy "asset_handover: write admin/operations" on public.asset_handover for all using (
  exists (select 1 from public.employee_roles er join public.roles r on r.id = er.role_id where er.employee_id = public.auth_employee_id() and er.is_active = true and r.code in ('SUPER_ADMIN','HR_ADMIN','OPERATIONS_ADMIN'))
);

-- Asset returns: read all, write admin/operations
create policy "asset_returns: read all" on public.asset_returns for select using (true);
create policy "asset_returns: write admin/operations" on public.asset_returns for all using (
  exists (select 1 from public.employee_roles er join public.roles r on r.id = er.role_id where er.employee_id = public.auth_employee_id() and er.is_active = true and r.code in ('SUPER_ADMIN','HR_ADMIN','OPERATIONS_ADMIN'))
);

-- Payroll: read own payslips, admin/finance all
create policy "payroll_runs: read all for admin/finance" on public.payroll_runs for select using (
  exists (select 1 from public.employee_roles er join public.roles r on r.id = er.role_id where er.employee_id = public.auth_employee_id() and er.is_active = true and r.code in ('SUPER_ADMIN','HR_ADMIN','FINANCE_ADMIN'))
);
create policy "payroll_runs: write for admin/finance" on public.payroll_runs for all using (
  exists (select 1 from public.employee_roles er join public.roles r on r.id = er.role_id where er.employee_id = public.auth_employee_id() and er.is_active = true and r.code in ('SUPER_ADMIN','HR_ADMIN','FINANCE_ADMIN'))
);
create policy "payroll_items: read own" on public.payroll_items for select using (employee_id = public.auth_employee_id());
create policy "payroll_items: read all for admin/finance" on public.payroll_items for select using (
  exists (select 1 from public.employee_roles er join public.roles r on r.id = er.role_id where er.employee_id = public.auth_employee_id() and er.is_active = true and r.code in ('SUPER_ADMIN','HR_ADMIN','FINANCE_ADMIN'))
);
create policy "payslips: read own" on public.payslips for select using (employee_id = public.auth_employee_id());
create policy "payslips: read all for admin/finance" on public.payslips for select using (
  exists (select 1 from public.employee_roles er join public.roles r on r.id = er.role_id where er.employee_id = public.auth_employee_id() and er.is_active = true and r.code in ('SUPER_ADMIN','HR_ADMIN','FINANCE_ADMIN'))
);

-- Expenses: self read/write, manager/admin all
create policy "expenses: read own" on public.expenses for select using (employee_id = public.auth_employee_id());
create policy "expenses: read all for admin/manager" on public.expenses for select using (
  exists (select 1 from public.employee_roles er join public.roles r on r.id = er.role_id where er.employee_id = public.auth_employee_id() and er.is_active = true and r.code in ('SUPER_ADMIN','HR_ADMIN','FINANCE_ADMIN','MANAGER'))
);
create policy "expenses: insert own" on public.expenses for insert with check (employee_id = public.auth_employee_id());
create policy "expenses: update all for admin/manager" on public.expenses for update using (
  exists (select 1 from public.employee_roles er join public.roles r on r.id = er.role_id where er.employee_id = public.auth_employee_id() and er.is_active = true and r.code in ('SUPER_ADMIN','HR_ADMIN','FINANCE_ADMIN','MANAGER'))
);

-- Helpdesk: self read/write, admin all
create policy "helpdesk_tickets: read own" on public.helpdesk_tickets for select using (employee_id = public.auth_employee_id());
create policy "helpdesk_tickets: read all for admin" on public.helpdesk_tickets for select using (
  exists (select 1 from public.employee_roles er join public.roles r on r.id = er.role_id where er.employee_id = public.auth_employee_id() and er.is_active = true and r.code in ('SUPER_ADMIN','HR_ADMIN'))
);
create policy "helpdesk_tickets: insert own" on public.helpdesk_tickets for insert with check (employee_id = public.auth_employee_id());
create policy "helpdesk_tickets: update all for admin" on public.helpdesk_tickets for update using (
  exists (select 1 from public.employee_roles er join public.roles r on r.id = er.role_id where er.employee_id = public.auth_employee_id() and er.is_active = true and r.code in ('SUPER_ADMIN','HR_ADMIN'))
);

-- Resignations: self read, admin/hr all
create policy "resignations: read own" on public.resignations for select using (employee_id = public.auth_employee_id());
create policy "resignations: read all for admin/hr" on public.resignations for select using (
  exists (select 1 from public.employee_roles er join public.roles r on r.id = er.role_id where er.employee_id = public.auth_employee_id() and er.is_active = true and r.code in ('SUPER_ADMIN','HR_ADMIN'))
);
create policy "resignations: insert own" on public.resignations for insert with check (employee_id = public.auth_employee_id());
create policy "resignations: update all for admin/hr" on public.resignations for update using (
  exists (select 1 from public.employee_roles er join public.roles r on r.id = er.role_id where er.employee_id = public.auth_employee_id() and er.is_active = true and r.code in ('SUPER_ADMIN','HR_ADMIN'))
);

-- Documents: self read/write, admin/hr all
create policy "employee_documents: read own" on public.employee_documents for select using (
  exists (select 1 from public.employees where id = employee_documents.employee_id and id = public.auth_employee_id())
);
create policy "employee_documents: read all for admin/hr" on public.employee_documents for select using (
  exists (select 1 from public.employee_roles er join public.roles r on r.id = er.role_id where er.employee_id = public.auth_employee_id() and er.is_active = true and r.code in ('SUPER_ADMIN','HR_ADMIN'))
);
create policy "employee_documents: insert own" on public.employee_documents for insert with check (
  exists (select 1 from public.employees where id = employee_documents.employee_id and id = public.auth_employee_id())
);
create policy "employee_documents: update all for admin/hr" on public.employee_documents for update using (
  exists (select 1 from public.employee_roles er join public.roles r on r.id = er.role_id where er.employee_id = public.auth_employee_id() and er.is_active = true and r.code in ('SUPER_ADMIN','HR_ADMIN'))
);

-- Bank accounts: self read/write, admin/hr all
create policy "employee_bank_accounts: read own" on public.employee_bank_accounts for select using (
  exists (select 1 from public.employees where id = employee_bank_accounts.employee_id and id = public.auth_employee_id())
);
create policy "employee_bank_accounts: read all for admin/hr" on public.employee_bank_accounts for select using (
  exists (select 1 from public.employee_roles er join public.roles r on r.id = er.role_id where er.employee_id = public.auth_employee_id() and er.is_active = true and r.code in ('SUPER_ADMIN','HR_ADMIN'))
);
create policy "employee_bank_accounts: insert own" on public.employee_bank_accounts for insert with check (
  exists (select 1 from public.employees where id = employee_bank_accounts.employee_id and id = public.auth_employee_id())
);
create policy "employee_bank_accounts: update all for admin/hr" on public.employee_bank_accounts for update using (
  exists (select 1 from public.employee_roles er join public.roles r on r.id = er.role_id where er.employee_id = public.auth_employee_id() and er.is_active = true and r.code in ('SUPER_ADMIN','HR_ADMIN'))
);

-- Statutory details: self read/write, admin/hr all
create policy "employee_statutory_details: read own" on public.employee_statutory_details for select using (
  exists (select 1 from public.employees where id = employee_statutory_details.employee_id and id = public.auth_employee_id())
);
create policy "employee_statutory_details: read all for admin/hr" on public.employee_statutory_details for select using (
  exists (select 1 from public.employee_roles er join public.roles r on r.id = er.role_id where er.employee_id = public.auth_employee_id() and er.is_active = true and r.code in ('SUPER_ADMIN','HR_ADMIN'))
);
create policy "employee_statutory_details: insert own" on public.employee_statutory_details for insert with check (
  exists (select 1 from public.employees where id = employee_statutory_details.employee_id and id = public.auth_employee_id())
);
create policy "employee_statutory_details: update all for admin/hr" on public.employee_statutory_details for update using (
  exists (select 1 from public.employee_roles er join public.roles r on r.id = er.role_id where er.employee_id = public.auth_employee_id() and er.is_active = true and r.code in ('SUPER_ADMIN','HR_ADMIN'))
);

-- Attendance adjustments: read all, write admin/manager
create policy "attendance_adjustments: read all for admin/manager" on public.attendance_adjustments for select using (
  exists (select 1 from public.employee_roles er join public.roles r on r.id = er.role_id where er.employee_id = public.auth_employee_id() and er.is_active = true and r.code in ('SUPER_ADMIN','HR_ADMIN','MANAGER'))
);
create policy "attendance_adjustments: insert own" on public.attendance_adjustments for insert with check (
  exists (select 1 from public.attendance where id = attendance_adjustments.attendance_id and employee_id = public.auth_employee_id())
);
create policy "attendance_adjustments: update all for admin/manager" on public.attendance_adjustments for update using (
  exists (select 1 from public.employee_roles er join public.roles r on r.id = er.role_id where er.employee_id = public.auth_employee_id() and er.is_active = true and r.code in ('SUPER_ADMIN','HR_ADMIN','MANAGER'))
);

-- Attendance exceptions: read all, write admin/manager
create policy "attendance_exceptions: read all for admin/manager" on public.attendance_exceptions for select using (
  exists (select 1 from public.employee_roles er join public.roles r on r.id = er.role_id where er.employee_id = public.auth_employee_id() and er.is_active = true and r.code in ('SUPER_ADMIN','HR_ADMIN','MANAGER'))
);
create policy "attendance_exceptions: insert own" on public.attendance_exceptions for insert with check (employee_id = public.auth_employee_id());
create policy "attendance_exceptions: update all for admin/manager" on public.attendance_exceptions for update using (
  exists (select 1 from public.employee_roles er join public.roles r on r.id = er.role_id where er.employee_id = public.auth_employee_id() and er.is_active = true and r.code in ('SUPER_ADMIN','HR_ADMIN','MANAGER'))
);

-- Notifications: self read, admin insert
create policy "notifications: read own" on public.notifications for select using (recipient_employee_id = public.auth_employee_id());
create policy "notifications: insert for admin" on public.notifications for insert with check (
  exists (select 1 from public.employee_roles er join public.roles r on r.id = er.role_id where er.employee_id = public.auth_employee_id() and er.is_active = true and r.code in ('SUPER_ADMIN','HR_ADMIN'))
);
create policy "notifications: update own" on public.notifications for update using (recipient_employee_id = public.auth_employee_id());

-- Audit logs: read for admin only
create policy "audit_logs: read for admin" on public.audit_logs for select using (
  exists (select 1 from public.employee_roles er join public.roles r on r.id = er.role_id where er.employee_id = public.auth_employee_id() and er.is_active = true and r.code = 'SUPER_ADMIN')
);
create policy "audit_logs: insert for admin" on public.audit_logs for insert with check (
  exists (select 1 from public.employee_roles er join public.roles r on r.id = er.role_id where er.employee_id = public.auth_employee_id() and er.is_active = true and r.code = 'SUPER_ADMIN')
);

-- Idempotency keys: self read/write
create policy "idempotency_keys: read own" on public.idempotency_keys for select using (employee_id = public.auth_employee_id());
create policy "idempotency_keys: insert own" on public.idempotency_keys for insert with check (employee_id = public.auth_employee_id());

-- ── 10. FIX VIEWS FOR TIMEZONE ────────────────────────────────────────────────
drop view if exists public.v_today_attendance cascade;

create view public.v_today_attendance as
select * from public.v_attendance
where attendance_date = (current_timestamp at time zone 'Asia/Kolkata')::date;

-- ── 11. FIX DASHBOARD METRICS VIEW ───────────────────────────────────────────
drop view if exists public.v_dashboard_metrics cascade;

create view public.v_dashboard_metrics as
select
  c.id as company_id,
  (select count(*) from public.employees where company_id = c.id and employment_status::text = 'ACTIVE')  as active_employees,
  (select count(*) from public.employees where company_id = c.id and employment_status::text = 'INACTIVE') as inactive_employees,
  (select count(*) from public.attendance where company_id = c.id and attendance_date = (current_timestamp at time zone 'Asia/Kolkata')::date and status::text in ('PRESENT','LATE')) as present_today,
  (select count(*) from public.attendance where company_id = c.id and attendance_date = (current_timestamp at time zone 'Asia/Kolkata')::date and status::text = 'ABSENT') as absent_today,
  (select count(*) from public.attendance where company_id = c.id and attendance_date = (current_timestamp at time zone 'Asia/Kolkata')::date and status::text = 'LATE') as late_today,
  (select count(*) from public.attendance where company_id = c.id and attendance_date = (current_timestamp at time zone 'Asia/Kolkata')::date and status::text = 'HALF_DAY') as half_day_today,
  (select count(*) from public.attendance where company_id = c.id and attendance_date = (current_timestamp at time zone 'Asia/Kolkata')::date and status::text = 'ON_LEAVE') as on_leave_today,
  (select count(*) from public.leave_requests lr join public.employees e on e.id = lr.employee_id where e.company_id = c.id and lr.status::text = 'PENDING') as pending_leaves,
  (select count(*) from public.attendance_adjustments aa join public.attendance a on a.id = aa.attendance_id where a.company_id = c.id and aa.status::text = 'PENDING') as pending_corrections,
  (select count(*) from public.attendance_exceptions ae join public.attendance a on a.id = ae.attendance_id where a.company_id = c.id and ae.status::text = 'OPEN') as open_exceptions,
  (select count(*) from public.assets where company_id = c.id and status::text = 'AVAILABLE') as available_assets,
  (select count(*) from public.assets where company_id = c.id and status::text = 'ASSIGNED') as assigned_assets,
  (select count(*) from public.employees where company_id = c.id and joining_date >= (current_timestamp at time zone 'Asia/Kolkata')::date - interval '30 days' and employment_status::text = 'ACTIVE') as new_joiners_30d,
  (select count(*) from public.employees where company_id = c.id and employment_status::text = 'ON_NOTICE') as on_notice,
  (select count(*) from public.payroll_runs where company_id = c.id and status::text = 'DRAFT') as draft_payroll_runs,
  (select count(*) from public.payroll_runs where company_id = c.id and status::text = 'CALCULATED') as pending_payroll_approvals
from public.companies c;

-- ── 12. ADD HELPDESK ASSIGNED_TO NAME ────────────────────────────────────────
create or replace view public.v_helpdesk_tickets as
select
  ht.id,
  ht.company_id,
  ht.employee_id,
  coalesce(e.display_name, trim(e.first_name || ' ' || e.last_name))::varchar(255) as employee_name,
  ht.category,
  ht.subject,
  ht.description,
  ht.priority,
  ht.status,
  ht.assigned_to,
  coalesce(at.display_name, trim(at.first_name || ' ' || at.last_name))::varchar(255) as assigned_to_name,
  ht.resolved_at,
  ht.resolution,
  ht.created_at,
  ht.updated_at
from public.helpdesk_tickets ht
join public.employees e on e.id = ht.employee_id
left join public.employees at on at.id = ht.assigned_to;

-- ── 13. ADD RESIGNATION NAME VIEW ────────────────────────────────────────────
create or replace view public.v_resignations as
select
  r.id,
  r.company_id,
  r.employee_id,
  coalesce(e.display_name, trim(e.first_name || ' ' || e.last_name))::varchar(255) as employee_name,
  e.employee_code,
  d.name as department,
  dg.name as designation,
  m.first_name as manager_name,
  r.resignation_date,
  r.last_working_date,
  r.reason,
  r.status,
  r.it_cleared,
  r.finance_cleared,
  r.hr_cleared,
  r.ff_amount,
  r.ff_notes,
  r.approved_by,
  r.approved_at,
  r.created_at,
  r.updated_at
from public.resignations r
join public.employees e on e.id = r.employee_id
left join public.departments d on d.id = e.department_id
left join public.designations dg on dg.id = e.designation_id
left join public.employees m on m.id = e.manager_id;

-- ── 14. FIX LEAVE APPROVAL TRIGGER ───────────────────────────────────────────
create or replace function public.after_leave_approval()
returns trigger language plpgsql as $$
begin
  if new.action = 'APPROVED' and old.action <> 'APPROVED' then
    update public.leave_requests
    set status = 'APPROVED',
        reviewed_by = new.approver_id,
        reviewed_at = new.acted_at
    where id = new.leave_request_id;
  elsif new.action = 'REJECTED' and old.action <> 'REJECTED' then
    update public.leave_requests
    set status = 'REJECTED',
        reviewed_by = new.approver_id,
        reviewed_at = new.acted_at
    where id = new.leave_request_id;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_after_leave_approval on public.leave_approvals;
create trigger trg_after_leave_approval
  after insert or update of action on public.leave_approvals
  for each row execute function public.after_leave_approval();

-- ── 15. FIX NOTIFICATION READ TRIGGER ────────────────────────────────────────
create or replace function public.update_notification_read()
returns trigger language plpgsql as $$
begin
  if new.is_read = true and old.is_read = false then
    new.read_at := now();
  end if;
  return new;
end;
$$;

drop trigger if exists trg_notification_read on public.notifications;
create trigger trg_notification_read
  before update of is_read on public.notifications
  for each row execute function public.update_notification_read();

-- ── 16. ADD EMPLOYEE STATUS CHANGE AUDIT TRIGGER ─────────────────────────────
create or replace function public.audit_employee_status_change()
returns trigger language plpgsql as $$
begin
  if old.employment_status is distinct from new.employment_status then
    insert into public.audit_logs (company_id, actor_employee_id, action, entity_type, entity_id, old_values, new_values)
    values (
      new.company_id,
      public.auth_employee_id(),
      'EMPLOYEE_STATUS_CHANGE',
      'EMPLOYEE',
      new.id::text,
      jsonb_build_object('employment_status', old.employment_status),
      jsonb_build_object('employment_status', new.employment_status)
    );
  end if;
  return new;
end;
$$;

drop trigger if exists trg_audit_employee_status on public.employees;
create trigger trg_audit_employee_status
  after update of employment_status on public.employees
  for each row execute function public.audit_employee_status_change();

-- ── 17. FIX ASSET RETURN TRIGGER ─────────────────────────────────────────────
create or replace function public.after_asset_return()
returns trigger language plpgsql as $$
begin
  if new.status = 'APPROVED' and old.status <> 'APPROVED' then
    update public.asset_assignments
    set status = 'RETURNED',
        returned_at = new.return_date
    where id = new.asset_assignment_id;
    update public.assets
    set status = 'AVAILABLE',
        current_employee_id = null
    where id = (select asset_id from public.asset_assignments where id = new.asset_assignment_id);
  end if;
  return new;
end;
$$;

drop trigger if exists trg_after_asset_return on public.asset_returns;
create trigger trg_after_asset_return
  after update of status on public.asset_returns
  for each row execute function public.after_asset_return();

-- ── 18. FIX PAYROLL STATUS TRANSITIONS ───────────────────────────────────────
create or replace function public.validate_payroll_status()
returns trigger language plpgsql as $$
begin
  if old.status = 'LOCKED' and new.status <> 'LOCKED' then
    raise exception 'Cannot change status from LOCKED';
  end if;
  return new;
end;
$$;

drop trigger if exists trg_validate_payroll_status on public.payroll_runs;
create trigger trg_validate_payroll_status
  before update of status on public.payroll_runs
  for each row execute function public.validate_payroll_status();

-- ── 19. ADD MISSING INDEXES ──────────────────────────────────────────────────
create index if not exists idx_employees_company_status on public.employees(company_id, employment_status);
create index if not exists idx_employees_manager on public.employees(manager_id) where manager_id is not null;
create index if not exists idx_attendance_employee_date on public.attendance(employee_id, attendance_date);
create index if not exists idx_attendance_company_date on public.attendance(company_id, attendance_date);
create index if not exists idx_leave_requests_employee_status on public.leave_requests(employee_id, status);
create index if not exists idx_leave_requests_dates on public.leave_requests(from_date, to_date);
create index if not exists idx_payroll_runs_company_month on public.payroll_runs(company_id, payroll_year, payroll_month);
create index if not exists idx_assets_company_status on public.assets(company_id, status);
create index if not exists idx_assets_employee on public.assets(current_employee_id) where current_employee_id is not null;
create index if not exists idx_expenses_employee_status on public.expenses(employee_id, status);
create index if not exists idx_audit_logs_company_created on public.audit_logs(company_id, created_at);
create index if not exists idx_notifications_recipient on public.notifications(recipient_employee_id, is_read, created_at);

-- ── 20. DONE ─────────────────────────────────────────────────────────────────
select 'Schema fixes migration completed successfully!' as status;
