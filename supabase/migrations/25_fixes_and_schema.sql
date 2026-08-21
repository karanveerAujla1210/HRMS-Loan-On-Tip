-- 25_fixes_and_schema.sql
-- Bug fixes, missing tables, and schema additions.

-- ── Fix v_today_attendance to support date-range queries ─────────────────────
create or replace view public.v_attendance as
select
  a.id, a.employee_id, e.display_name, e.employee_code,
  d.name  as department,
  l.name  as location,
  a.attendance_date, a.status,
  a.check_in_at, a.check_out_at,
  a.worked_minutes, a.late_minutes,
  a.company_id
from public.attendance a
join public.employees e on e.id = a.employee_id
left join public.locations   l on l.id = a.location_id
left join public.departments d on d.id = e.department_id;

-- Keep v_today_attendance for backward compat but fix it
create or replace view public.v_today_attendance as
select * from public.v_attendance where attendance_date = current_date;

-- ── Add ON_LEAVE to attendance_status_enum if missing ────────────────────────
do $$ begin
  alter type public.attendance_status_enum add value if not exists 'ON_LEAVE';
exception when others then null;
end $$;

-- ── Add NOTICE_PERIOD to employment_status_enum if missing ───────────────────
do $$ begin
  alter type public.employment_status_enum add value if not exists 'NOTICE_PERIOD';
exception when others then null;
end $$;

-- ── Add EXITED to employment_status_enum if missing ──────────────────────────
do $$ begin
  alter type public.employment_status_enum add value if not exists 'EXITED';
exception when others then null;
end $$;

-- ── Expenses table ────────────────────────────────────────────────────────────
create table if not exists public.expenses (
  id               uuid primary key default gen_random_uuid(),
  company_id       uuid not null references public.companies  on delete cascade,
  employee_id      uuid not null references public.employees  on delete cascade,
  expense_date     date         not null,
  category         varchar(50)  not null default 'OTHER',
  description      text         not null,
  amount           numeric(12,2) not null,
  receipt_path     text,
  status           varchar(20)  not null default 'PENDING',
  submitted_at     timestamptz  not null default now(),
  approved_by      uuid references public.employees on delete set null,
  approved_at      timestamptz,
  rejection_reason text,
  created_at       timestamptz  not null default now(),
  updated_at       timestamptz  not null default now()
);

-- ── Performance goals ─────────────────────────────────────────────────────────
create table if not exists public.goals (
  id            uuid primary key default gen_random_uuid(),
  company_id    uuid not null references public.companies on delete cascade,
  employee_id   uuid not null references public.employees on delete cascade,
  title         varchar(255) not null,
  description   text,
  target_date   date,
  status        varchar(20) not null default 'ACTIVE',
  progress      smallint    not null default 0 check (progress between 0 and 100),
  created_by    uuid references public.employees on delete set null,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

-- ── Performance reviews ───────────────────────────────────────────────────────
create table if not exists public.performance_reviews (
  id            uuid primary key default gen_random_uuid(),
  company_id    uuid not null references public.companies on delete cascade,
  employee_id   uuid not null references public.employees on delete cascade,
  reviewer_id   uuid references public.employees on delete set null,
  review_period varchar(20) not null,
  rating        smallint check (rating between 1 and 5),
  comments      text,
  status        varchar(20) not null default 'DRAFT',
  reviewed_at   timestamptz,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

-- ── Helpdesk tickets ──────────────────────────────────────────────────────────
create table if not exists public.helpdesk_tickets (
  id            uuid primary key default gen_random_uuid(),
  company_id    uuid not null references public.companies on delete cascade,
  employee_id   uuid not null references public.employees on delete cascade,
  category      varchar(30) not null default 'HR',
  subject       varchar(255) not null,
  description   text,
  priority      varchar(10) not null default 'NORMAL',
  status        varchar(20) not null default 'OPEN',
  assigned_to   uuid references public.employees on delete set null,
  resolved_at   timestamptz,
  resolution    text,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

-- ── Resignation / exit flow ───────────────────────────────────────────────────
create table if not exists public.resignations (
  id                    uuid primary key default gen_random_uuid(),
  company_id            uuid not null references public.companies on delete cascade,
  employee_id           uuid not null references public.employees on delete cascade,
  resignation_date      date         not null,
  last_working_date     date,
  reason                text,
  status                varchar(30)  not null default 'SUBMITTED',
  -- clearance flags
  it_cleared            boolean not null default false,
  it_cleared_by         uuid references public.employees on delete set null,
  it_cleared_at         timestamptz,
  finance_cleared       boolean not null default false,
  finance_cleared_by    uuid references public.employees on delete set null,
  finance_cleared_at    timestamptz,
  hr_cleared            boolean not null default false,
  hr_cleared_by         uuid references public.employees on delete set null,
  hr_cleared_at         timestamptz,
  assets_cleared        boolean not null default false,
  assets_cleared_by     uuid references public.employees on delete set null,
  assets_cleared_at     timestamptz,
  ff_amount             numeric(14,2),
  ff_notes              text,
  approved_by           uuid references public.employees on delete set null,
  approved_at           timestamptz,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now(),
  unique (employee_id, resignation_date)
);

-- ── Onboarding checklist ──────────────────────────────────────────────────────
create table if not exists public.onboarding_tasks (
  id          uuid primary key default gen_random_uuid(),
  company_id  uuid not null references public.companies on delete cascade,
  employee_id uuid not null references public.employees on delete cascade,
  task        varchar(255) not null,
  category    varchar(50)  not null default 'GENERAL',
  is_done     boolean      not null default false,
  done_by     uuid references public.employees on delete set null,
  done_at     timestamptz,
  due_date    date,
  created_at  timestamptz  not null default now()
);

-- ── Enable RLS on new tables ──────────────────────────────────────────────────
alter table public.expenses             enable row level security;
alter table public.goals                enable row level security;
alter table public.performance_reviews  enable row level security;
alter table public.helpdesk_tickets     enable row level security;
alter table public.resignations         enable row level security;
alter table public.onboarding_tasks     enable row level security;

-- ── RLS policies for new tables ───────────────────────────────────────────────
create policy "expense: own read"
  on public.expenses for select
  using (employee_id = public.auth_employee_id());

create policy "expense: own insert"
  on public.expenses for insert
  with check (employee_id = public.auth_employee_id());

create policy "expense: hr reads company"
  on public.expenses for select
  using (company_id = public.auth_company_id() and public.has_permission('employee.view'));

create policy "goal: own read"
  on public.goals for select
  using (employee_id = public.auth_employee_id());

create policy "goal: manager reads direct reports"
  on public.goals for select
  using (employee_id in (select public.auth_direct_report_ids()));

create policy "goal: hr reads company"
  on public.goals for select
  using (company_id = public.auth_company_id() and public.has_permission('employee.view'));

create policy "review: own read"
  on public.performance_reviews for select
  using (employee_id = public.auth_employee_id());

create policy "review: hr reads company"
  on public.performance_reviews for select
  using (company_id = public.auth_company_id() and public.has_permission('employee.view'));

create policy "ticket: own read"
  on public.helpdesk_tickets for select
  using (employee_id = public.auth_employee_id());

create policy "ticket: own insert"
  on public.helpdesk_tickets for insert
  with check (employee_id = public.auth_employee_id());

create policy "ticket: hr reads company"
  on public.helpdesk_tickets for select
  using (company_id = public.auth_company_id() and public.has_permission('employee.view'));

create policy "resignation: own read"
  on public.resignations for select
  using (employee_id = public.auth_employee_id());

create policy "resignation: hr reads company"
  on public.resignations for select
  using (company_id = public.auth_company_id() and public.has_permission('employee.view'));

create policy "onboarding: hr reads company"
  on public.onboarding_tasks for select
  using (company_id = public.auth_company_id() and public.has_permission('employee.view'));

-- ── updated_at triggers for new tables ───────────────────────────────────────
create trigger trg_expenses_updated_at
  before update on public.expenses
  for each row execute function public.set_updated_at();

create trigger trg_goals_updated_at
  before update on public.goals
  for each row execute function public.set_updated_at();

create trigger trg_performance_reviews_updated_at
  before update on public.performance_reviews
  for each row execute function public.set_updated_at();

create trigger trg_helpdesk_tickets_updated_at
  before update on public.helpdesk_tickets
  for each row execute function public.set_updated_at();

create trigger trg_resignations_updated_at
  before update on public.resignations
  for each row execute function public.set_updated_at();

-- ── Add missing permissions ───────────────────────────────────────────────────
insert into public.permissions (code, name, module) values
  ('expense.view',        'View Expenses',         'EXPENSES'),
  ('expense.approve',     'Approve Expenses',      'EXPENSES'),
  ('performance.view',    'View Performance',      'PERFORMANCE'),
  ('performance.manage',  'Manage Performance',    'PERFORMANCE'),
  ('helpdesk.view',       'View Helpdesk',         'HELPDESK'),
  ('helpdesk.manage',     'Manage Helpdesk',       'HELPDESK'),
  ('resignation.manage',  'Manage Resignations',   'PEOPLE'),
  ('organisation.manage', 'Manage Organisation',   'SYSTEM')
on conflict (code) do nothing;

-- ── Seed role_permissions for SUPER_ADMIN (all permissions) ──────────────────
insert into public.role_permissions (role_id, permission_id)
select r.id, p.id
from public.roles r
cross join public.permissions p
where r.code = 'SUPER_ADMIN'
on conflict do nothing;

-- ── Seed role_permissions for HR_ADMIN ───────────────────────────────────────
insert into public.role_permissions (role_id, permission_id)
select r.id, p.id
from public.roles r
cross join public.permissions p
where r.code = 'HR_ADMIN'
  and p.code in (
    'employee.view','employee.create','employee.update',
    'attendance.view','attendance.adjust','attendance.approve',
    'leave.view','leave.apply','leave.approve',
    'payroll.view','payroll.create',
    'asset.view','asset.assign','asset.return',
    'reports.view','expense.view','expense.approve',
    'performance.view','performance.manage',
    'helpdesk.view','helpdesk.manage','resignation.manage'
  )
on conflict do nothing;

-- ── Seed role_permissions for FINANCE_ADMIN ──────────────────────────────────
insert into public.role_permissions (role_id, permission_id)
select r.id, p.id
from public.roles r
cross join public.permissions p
where r.code = 'FINANCE_ADMIN'
  and p.code in (
    'employee.view','payroll.view','payroll.create','payroll.approve',
    'reports.view','expense.view','expense.approve'
  )
on conflict do nothing;

-- ── Seed role_permissions for MANAGER ────────────────────────────────────────
insert into public.role_permissions (role_id, permission_id)
select r.id, p.id
from public.roles r
cross join public.permissions p
where r.code = 'MANAGER'
  and p.code in (
    'employee.view','attendance.view','attendance.approve',
    'leave.view','leave.apply','leave.approve',
    'asset.view','reports.view','expense.view','expense.approve',
    'performance.view','performance.manage','helpdesk.view'
  )
on conflict do nothing;

-- ── Seed role_permissions for EMPLOYEE ───────────────────────────────────────
insert into public.role_permissions (role_id, permission_id)
select r.id, p.id
from public.roles r
cross join public.permissions p
where r.code = 'EMPLOYEE'
  and p.code in (
    'attendance.view','leave.view','leave.apply',
    'asset.view','expense.view'
  )
on conflict do nothing;
