-- 08_payroll.sql

create sequence public.payslip_number_seq start 1;

create table public.salary_components (
  id               uuid primary key default gen_random_uuid(),
  company_id       uuid not null references public.companies on delete cascade,
  code             varchar(30)  not null,
  name             varchar(100) not null,
  component_type   public.component_type_enum not null,
  calculation_type varchar(30)  not null default 'FIXED',
  is_taxable       boolean      not null default false,
  is_statutory     boolean      not null default false,
  is_active        boolean      not null default true,
  created_at       timestamptz  not null default now(),
  updated_at       timestamptz  not null default now(),
  unique (company_id, code)
);

create table public.salary_structures (
  id             uuid primary key default gen_random_uuid(),
  company_id     uuid not null references public.companies on delete cascade,
  name           varchar(255) not null,
  description    text,
  effective_from date         not null,
  effective_to   date,
  is_active      boolean      not null default true,
  created_at     timestamptz  not null default now(),
  updated_at     timestamptz  not null default now()
);

create table public.salary_structure_components (
  id                   uuid primary key default gen_random_uuid(),
  salary_structure_id  uuid not null references public.salary_structures  on delete cascade,
  salary_component_id  uuid not null references public.salary_components  on delete cascade,
  calculation_method   varchar(30) not null default 'FIXED',
  value                numeric(14,4),
  percentage           numeric(7,4),
  base_component_id    uuid references public.salary_components on delete set null,
  monthly_limit        numeric(12,2),
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now(),
  unique (salary_structure_id, salary_component_id)
);

create table public.employee_salary_assignments (
  id                  uuid primary key default gen_random_uuid(),
  employee_id         uuid not null references public.employees        on delete cascade,
  salary_structure_id uuid not null references public.salary_structures on delete restrict,
  annual_ctc          numeric(14,2) not null,
  monthly_ctc         numeric(14,2) generated always as (annual_ctc / 12) stored,
  effective_from      date          not null,
  effective_to        date,
  is_current          boolean       not null default true,
  approved_by         uuid references public.employees on delete set null,
  created_at          timestamptz   not null default now(),
  updated_at          timestamptz   not null default now()
);
create unique index uq_salary_assignment_current
  on public.employee_salary_assignments (employee_id) where is_current = true;

create table public.employee_salary_history (
  id                    uuid primary key default gen_random_uuid(),
  employee_id           uuid not null references public.employees on delete cascade,
  previous_ctc          numeric(14,2),
  new_ctc               numeric(14,2) not null,
  previous_structure_id uuid references public.salary_structures on delete set null,
  new_structure_id      uuid references public.salary_structures on delete set null,
  effective_date        date          not null,
  reason                text,
  approved_by           uuid references public.employees on delete set null,
  created_at            timestamptz   not null default now()
);

create table public.payroll_runs (
  id               uuid primary key default gen_random_uuid(),
  company_id       uuid not null references public.companies on delete cascade,
  payroll_month    smallint not null check (payroll_month between 1 and 12),
  payroll_year     smallint not null,
  period_start     date     not null,
  period_end       date     not null,
  status           public.payroll_run_status_enum not null default 'DRAFT',
  employee_count   integer  not null default 0,
  gross_pay        numeric(16,2) not null default 0,
  total_deductions numeric(16,2) not null default 0,
  net_pay          numeric(16,2) not null default 0,
  created_by       uuid references public.employees on delete set null,
  approved_by      uuid references public.employees on delete set null,
  approved_at      timestamptz,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  unique (company_id, payroll_year, payroll_month)
);

create table public.payroll_items (
  id                    uuid primary key default gen_random_uuid(),
  payroll_run_id        uuid not null references public.payroll_runs on delete cascade,
  employee_id           uuid not null references public.employees     on delete cascade,
  working_days          integer      not null default 0,
  paid_days             numeric(5,2) not null default 0,
  leave_days            numeric(5,2) not null default 0,
  lop_days              numeric(5,2) not null default 0,
  absent_days           integer      not null default 0,
  gross_salary          numeric(14,2) not null default 0,
  total_earnings        numeric(14,2) not null default 0,
  total_deductions      numeric(14,2) not null default 0,
  net_salary            numeric(14,2) not null default 0,
  employer_contribution numeric(14,2) not null default 0,
  employee_contribution numeric(14,2) not null default 0,
  taxable_income        numeric(14,2) not null default 0,
  income_tax            numeric(14,2) not null default 0,
  status                varchar(20)   not null default 'DRAFT',
  created_at            timestamptz   not null default now(),
  updated_at            timestamptz   not null default now(),
  unique (payroll_run_id, employee_id)
);

create table public.payroll_item_components (
  id                  uuid primary key default gen_random_uuid(),
  payroll_item_id     uuid not null references public.payroll_items      on delete cascade,
  salary_component_id uuid references public.salary_components           on delete set null,
  component_code      varchar(30)  not null,
  component_name      varchar(100) not null,
  component_type      public.component_type_enum not null,
  calculation_basis   text,
  quantity            numeric(10,4),
  rate                numeric(14,4),
  amount              numeric(14,2) not null,
  created_at          timestamptz   not null default now()
);

create table public.payroll_adjustments (
  id              uuid primary key default gen_random_uuid(),
  payroll_item_id uuid not null references public.payroll_items on delete cascade,
  employee_id     uuid not null references public.employees      on delete cascade,
  adjustment_type varchar(30)   not null,
  description     text,
  amount          numeric(14,2) not null,
  is_earning      boolean       not null default false,
  is_deduction    boolean       not null default false,
  approved_by     uuid references public.employees on delete set null,
  created_at      timestamptz   not null default now()
);

create table public.payroll_approvals (
  id             uuid primary key default gen_random_uuid(),
  payroll_run_id uuid not null references public.payroll_runs on delete cascade,
  approver_id    uuid not null references public.employees    on delete cascade,
  approval_level smallint    not null default 1,
  action         public.approval_action_enum not null,
  comments       text,
  acted_at       timestamptz not null default now(),
  created_at     timestamptz not null default now()
);

create table public.payslips (
  id               uuid primary key default gen_random_uuid(),
  payroll_item_id  uuid not null references public.payroll_items on delete cascade,
  employee_id      uuid not null references public.employees      on delete cascade,
  payroll_run_id   uuid not null references public.payroll_runs   on delete cascade,
  payslip_number   varchar(30) not null unique
                     default ('PAY-' || to_char(now(), 'YYYY-MM') || '-' ||
                              lpad(nextval('public.payslip_number_seq')::text, 4, '0')),
  gross_salary     numeric(14,2) not null,
  deductions       numeric(14,2) not null,
  net_salary       numeric(14,2) not null,
  payslip_json     jsonb         not null default '{}',
  pdf_storage_path text,
  generated_at     timestamptz,
  published_at     timestamptz,
  created_at       timestamptz   not null default now(),
  unique (payroll_run_id, employee_id)
);
