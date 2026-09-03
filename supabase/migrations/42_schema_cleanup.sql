-- ==============================================================================
-- MIGRATION 42: Schema cleanup — fix generation conflicts, missing constraints,
--               and data integrity gaps identified in schema audit.
-- ==============================================================================

-- ── 1. FIX employee_code: drop generated column, use trigger instead ──────────
-- GENERATED ALWAYS AS cannot call nextval(); replace with a plain column + trigger.
do $$ begin
  -- Only alter if still defined as a generated column
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public'
      and table_name   = 'employees'
      and column_name  = 'employee_code'
      and is_generated = 'ALWAYS'
  ) then
    alter table public.employees
      alter column employee_code drop expression if exists;
  end if;
end $$;

alter table public.employees
  alter column employee_code set default null;

drop trigger  if exists trg_employees_set_code on public.employees;
drop function if exists public.set_employee_code();

create function public.set_employee_code()
returns trigger language plpgsql as $$
begin
  if new.employee_code is null then
    new.employee_code :=
      'EMP-' || lpad(nextval('public.employee_code_seq')::text, 6, '0');
  end if;
  return new;
end;
$$;

create trigger trg_employees_set_code
  before insert on public.employees
  for each row execute function public.set_employee_code();

-- ── 2. FIX closing_balance: drop generated column, keep as plain numeric ──────
-- GENERATED ALWAYS AS conflicts with trigger-based updates; use a trigger instead.
do $$ begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public'
      and table_name   = 'leave_balances'
      and column_name  = 'closing_balance'
      and is_generated = 'ALWAYS'
  ) then
    alter table public.leave_balances
      alter column closing_balance drop expression if exists;
  end if;
end $$;

alter table public.leave_balances
  alter column closing_balance set default 0;

drop trigger  if exists trg_leave_balance_closing on public.leave_balances;
drop function if exists public.update_leave_closing_balance();

create function public.update_leave_closing_balance()
returns trigger language plpgsql as $$
begin
  new.closing_balance :=
    new.opening_balance + new.accrued + new.adjusted - new.used - new.encashed;
  return new;
end;
$$;

create trigger trg_leave_balance_closing
  before insert or update of opening_balance, accrued, adjusted, used, encashed
  on public.leave_balances
  for each row execute function public.update_leave_closing_balance();

-- ── 3. ADD is_read to notifications if missing ────────────────────────────────
alter table public.notifications
  add column if not exists is_read boolean not null default false;

-- ── 4. ADD missing company columns if not present ────────────────────────────
alter table public.companies add column if not exists trade_name  varchar(255) default 'Loan On Tip';
alter table public.companies add column if not exists tax_id      varchar(50);
alter table public.companies add column if not exists logo_url    text;

-- ── 5. ENFORCE salary_structure_id NOT NULL on current assignments ────────────
-- Allow null only on historical (is_current = false) rows.
do $$ begin
  alter table public.employee_salary_assignments
    add constraint chk_salary_structure_required
    check (is_current = false or salary_structure_id is not null);
exception when duplicate_object then null; end $$;

-- ── 6. UNIQUE constraint on idempotency_keys ─────────────────────────────────
do $$ begin
  alter table public.idempotency_keys
    add constraint uq_idempotency_emp_key
    unique (employee_id, idempotency_key);
exception when duplicate_object then null; end $$;

-- ── 7. ADD payroll_year range check if missing ────────────────────────────────
do $$ begin
  alter table public.payroll_runs
    add constraint chk_payroll_year
    check (payroll_year >= 2000 and payroll_year <= 2100);
exception when duplicate_object then null; end $$;

-- ── 8. ADD document_number_encrypted if missing ───────────────────────────────
alter table public.employee_documents
  add column if not exists document_number_encrypted text;

-- ── 9. ENSURE attendance_status accepts ON_LEAVE ─────────────────────────────
-- Migration 33 should have converted the enum to varchar+CHECK.
-- If the column is still an enum type, add the value safely.
do $$ begin
  if exists (
    select 1 from information_schema.columns c
    join pg_type t on t.typname = udt_name
    where c.table_schema = 'public'
      and c.table_name   = 'attendance'
      and c.column_name  = 'status'
      and c.data_type    = 'USER-DEFINED'
  ) then
    -- Safe enum extension (auto-committed outside transaction block)
    execute 'alter type public.attendance_status_enum add value if not exists ''ON_LEAVE''';
  end if;
exception when others then null; end $$;

-- ── 10. INDEX cleanup — drop duplicates created across migrations ─────────────
-- Keep the IF NOT EXISTS versions; drop any plain duplicates by name.
drop index if exists public.idx_employees_company_status;   -- recreated below
drop index if exists public.idx_attendance_employee_date;
drop index if exists public.idx_notifications_recipient_unread;

create index if not exists idx_employees_company_status
  on public.employees (company_id, employment_status);

create index if not exists idx_attendance_employee_date
  on public.attendance (employee_id, attendance_date desc);

create index if not exists idx_notifications_recipient_unread
  on public.notifications (recipient_employee_id)
  where is_read = false;

select '42_schema_cleanup completed' as status;
