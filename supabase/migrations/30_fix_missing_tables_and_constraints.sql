-- ==============================================================================
-- MIGRATION 30: Fix missing tables, sequences, and schema gaps
-- Safe to run on existing databases — uses IF NOT EXISTS throughout
-- ==============================================================================

-- ── 1. employee_salary_history (referenced in salary page but missing from schema) ──
create table if not exists public.employee_salary_history (
  id                    uuid primary key default gen_random_uuid(),
  employee_id           uuid not null references public.employees on delete cascade,
  previous_ctc          numeric(14,2),
  new_ctc               numeric(14,2) not null,
  previous_structure_id uuid references public.salary_structures on delete set null,
  new_structure_id      uuid references public.salary_structures on delete set null,
  effective_date        date not null default current_date,
  reason                text,
  approved_by           uuid references public.employees on delete set null,
  created_at            timestamptz not null default now()
);

alter table public.employee_salary_history enable row level security;
drop policy if exists "salary_history: all" on public.employee_salary_history;
create policy "salary_history: all" on public.employee_salary_history for all using (true);

-- ── 2. Fix document_types — add company_id column if missing ──
alter table public.document_types add column if not exists company_id uuid references public.companies on delete cascade;

-- Re-seed document types with company_id properly set
insert into public.document_types (company_id, code, name)
select c.id, v.code, v.name
from public.companies c
cross join (values
  ('AADHAAR',            'Aadhaar Card'),
  ('PAN',                'PAN Card'),
  ('PASSPORT',           'Passport'),
  ('DRIVING_LICENSE',    'Driving License'),
  ('VOTER_ID',           'Voter ID Card'),
  ('OFFER_LETTER',       'Signed Offer Letter'),
  ('APPOINTMENT_LETTER', 'Appointment Letter'),
  ('EXPERIENCE_CERT',    'Previous Experience Letter'),
  ('SALARY_SLIP',        'Previous Salary Slips'),
  ('BANK_STATEMENT',     'Bank Statement / Cancelled Cheque'),
  ('GRADUATION_CERT',    'Degree / Graduation Certificate'),
  ('RELIEVING_LETTER',   'Relieving Letter'),
  ('NOC',                'No Objection Certificate')
) as v(code, name)
where not exists (
  select 1 from public.document_types dt
  where dt.company_id = c.id and dt.code = v.code
);

-- ── 3. Fix asset code generation — use proper sequence-based codes ──
-- Replace the timestamp-based asset code with a proper sequential one
create or replace function public.generate_asset_code(p_prefix text)
returns text language plpgsql as $$
declare
  v_seq bigint;
begin
  v_seq := nextval('public.asset_code_seq');
  return upper(p_prefix) || '-' || lpad(v_seq::text, 6, '0');
end;
$$;

-- ── 4. Transactional leave approval function ──
-- Approving leave must atomically update leave_balances
create or replace function public.approve_leave_request(
  p_leave_request_id uuid,
  p_approver_id      uuid
) returns void language plpgsql security definer as $$
declare
  v_lr record;
begin
  -- Lock and fetch the leave request
  select * into v_lr
  from public.leave_requests
  where id = p_leave_request_id
    and status = 'PENDING'
  for update;

  if not found then
    raise exception 'Leave request not found or already processed';
  end if;

  -- Update leave request status
  update public.leave_requests
  set status = 'APPROVED', updated_at = now()
  where id = p_leave_request_id;

  -- Record approval
  insert into public.leave_approvals (leave_request_id, approver_id, action, approval_level)
  values (p_leave_request_id, p_approver_id, 'APPROVED', 1);

  -- Deduct from leave balance (upsert). closing_balance is GENERATED ALWAYS,
  -- so we never write it directly — the trigger maintains it.
  insert into public.leave_balances (employee_id, leave_type_id, year, opening_balance, used)
  values (
    v_lr.employee_id,
    v_lr.leave_type_id,
    extract(year from v_lr.from_date)::smallint,
    0,
    v_lr.total_days
  )
  on conflict (employee_id, leave_type_id, year) do update
  set
    used            = public.leave_balances.used + v_lr.total_days,
    updated_at      = now();

  -- Mark attendance days as ON_LEAVE
  insert into public.attendance (employee_id, company_id, attendance_date, status, source)
  select
    v_lr.employee_id,
    (select company_id from public.employees where id = v_lr.employee_id),
    d::date,
    'ON_LEAVE',
    'SYSTEM'
  from generate_series(v_lr.from_date, v_lr.to_date, '1 day'::interval) d
  on conflict (employee_id, attendance_date) do update
  set status = 'ON_LEAVE', updated_at = now();
end;
$$;

-- ── 5. Unique constraint on leave_balances (employee + type + year) ──
do $$ begin
  alter table public.leave_balances
    add constraint leave_balances_emp_type_year_unique
    unique (employee_id, leave_type_id, year);
exception when duplicate_table then null;
         when duplicate_object then null;
end $$;

-- ── 6. Unique constraint on attendance (employee + date) ──
do $$ begin
  alter table public.attendance
    add constraint attendance_emp_date_unique
    unique (employee_id, attendance_date);
exception when duplicate_table then null;
         when duplicate_object then null;
end $$;

-- ── 7. Unique constraint on payroll_runs (company + month + year) ──
do $$ begin
  alter table public.payroll_runs
    add constraint payroll_runs_company_period_unique
    unique (company_id, payroll_month, payroll_year);
exception when duplicate_table then null;
         when duplicate_object then null;
end $$;

-- ── 8. Unique constraint on employee_salary_assignments (one active per employee) ──
-- Partial unique index: only one is_current=true per employee
create unique index if not exists idx_salary_assignments_current
  on public.employee_salary_assignments (employee_id)
  where is_current = true;

-- ── 9. Unique constraint on asset_assignments (one active per asset) ──
create unique index if not exists idx_asset_assignments_active
  on public.asset_assignments (asset_id)
  where status = 'ACTIVE';

-- ── 10. Missing indexes for performance ──
create index if not exists idx_employees_company_status
  on public.employees (company_id, employment_status);

create index if not exists idx_employees_manager
  on public.employees (manager_id);

create index if not exists idx_attendance_emp_date
  on public.attendance (employee_id, attendance_date desc);

create index if not exists idx_attendance_company_date
  on public.attendance (company_id, attendance_date desc);

create index if not exists idx_leave_requests_emp_status
  on public.leave_requests (employee_id, status);

create index if not exists idx_leave_requests_status
  on public.leave_requests (status) where status = 'PENDING';

create index if not exists idx_payroll_items_run
  on public.payroll_items (payroll_run_id);

create index if not exists idx_payroll_items_emp
  on public.payroll_items (employee_id);

create index if not exists idx_payslips_emp
  on public.payslips (employee_id);

create index if not exists idx_payslips_run
  on public.payslips (payroll_run_id);

create index if not exists idx_assets_code
  on public.assets (asset_code);

create index if not exists idx_assets_serial
  on public.assets (serial_number) where serial_number is not null;

create index if not exists idx_assets_employee
  on public.assets (current_employee_id) where current_employee_id is not null;

create index if not exists idx_asset_assignments_emp_status
  on public.asset_assignments (employee_id, status);

create index if not exists idx_notifications_recipient_unread
  on public.notifications (recipient_employee_id, is_read)
  where is_read = false;

create index if not exists idx_audit_logs_company_date
  on public.audit_logs (company_id, created_at desc);

create index if not exists idx_idempotency_emp_key
  on public.idempotency_keys (employee_id, idempotency_key);

-- ── 11. Seed employment types if missing ──
insert into public.employment_types (company_id, name, code)
select c.id, v.name, v.code
from public.companies c
cross join (values
  ('Full Time',   'FULL_TIME'),
  ('Part Time',   'PART_TIME'),
  ('Contract',    'CONTRACT'),
  ('Intern',      'INTERN'),
  ('Consultant',  'CONSULTANT')
) as v(name, code)
where not exists (
  select 1 from public.employment_types et
  where et.company_id = c.id and et.code = v.code
);

-- ── 12. Seed departments if missing ──
insert into public.departments (company_id, department_code, name)
select c.id, v.code, v.name
from public.companies c
cross join (values
  ('HR',          'Human Resources'),
  ('FINANCE',     'Finance'),
  ('CREDIT',      'Credit'),
  ('OPS',         'Operations'),
  ('COLLECTIONS', 'Collections'),
  ('IT',          'Information Technology'),
  ('SALES',       'Sales'),
  ('LEGAL',       'Legal'),
  ('COMPLIANCE',  'Compliance'),
  ('ADMIN',       'Administration')
) as v(code, name)
where not exists (
  select 1 from public.departments d
  where d.company_id = c.id and d.department_code = v.code
);

-- ── 13. Seed default shift if missing ──
insert into public.shifts (company_id, shift_code, name, start_time, end_time, grace_minutes)
select c.id, 'GENERAL', 'General Shift', '09:30', '18:30', 15
from public.companies c
where not exists (
  select 1 from public.shifts s
  where s.company_id = c.id and s.shift_code = 'GENERAL'
);

-- ── 14. Seed leave types if missing ──
insert into public.leave_types (company_id, code, name, is_paid, allows_half_day, requires_document)
select c.id, v.code, v.name, v.is_paid, v.half_day, v.req_doc
from public.companies c
cross join (values
  ('CL',      'Casual Leave',         true,  true,  false),
  ('SL',      'Sick Leave',           true,  true,  false),
  ('EL',      'Earned Leave',         true,  true,  false),
  ('LOP',     'Loss of Pay',          false, true,  false),
  ('COMP_OFF','Compensatory Off',     true,  false, false),
  ('ML',      'Maternity Leave',      true,  false, true),
  ('PL',      'Paternity Leave',      true,  false, false)
) as v(code, name, is_paid, half_day, req_doc)
where not exists (
  select 1 from public.leave_types lt
  where lt.company_id = c.id and lt.code = v.code
);

-- ── 15. Seed head office location if missing ──
insert into public.locations (company_id, location_code, name, city, state, attendance_radius_meters)
select c.id, 'DEL-HO', 'Delhi Head Office', 'New Delhi', 'Delhi', 150
from public.companies c
where not exists (
  select 1 from public.locations l
  where l.company_id = c.id and l.location_code = 'DEL-HO'
);

-- ── 16. Seed asset categories if missing ──
insert into public.asset_categories (company_id, code, name, prefix)
select c.id, v.code, v.name, v.prefix
from public.companies c
cross join (values
  ('LAPTOP',    'Laptop / Computer',        'LAP'),
  ('DESKTOP',   'Desktop Computer',         'DES'),
  ('MOBILE',    'Mobile Phone',             'MOB'),
  ('SIM',       'SIM Card',                 'SIM'),
  ('MONITOR',   'External Display Monitor', 'MON'),
  ('KEYBOARD',  'Keyboard',                 'KEY'),
  ('MOUSE',     'Mouse',                    'MOU'),
  ('HEADSET',   'Headset / Headphones',     'HDS'),
  ('CHAIR',     'Office Chair',             'CHR'),
  ('FURNITURE', 'Office Furniture',         'FUR'),
  ('PRINTER',   'Printer / Scanner',        'PRN'),
  ('OTHER',     'Other Equipment',          'OTH')
) as v(code, name, prefix)
where not exists (
  select 1 from public.asset_categories ac
  where ac.company_id = c.id and ac.code = v.code
);

select 'Migration 30 completed successfully' as status;
