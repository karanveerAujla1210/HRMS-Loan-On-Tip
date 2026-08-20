-- 07_leave.sql

create table public.leave_types (
  id                    uuid primary key default gen_random_uuid(),
  company_id            uuid not null references public.companies on delete cascade,
  code                  varchar(20)  not null,
  name                  varchar(100) not null,
  description           text,
  is_paid               boolean not null default true,
  requires_document     boolean not null default false,
  allows_half_day       boolean not null default true,
  max_consecutive_days  integer,
  is_active             boolean not null default true,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now(),
  unique (company_id, code)
);

create table public.leave_policies (
  id             uuid primary key default gen_random_uuid(),
  company_id     uuid not null references public.companies on delete cascade,
  name           varchar(255) not null,
  effective_from date         not null,
  effective_to   date,
  is_active      boolean      not null default true,
  created_at     timestamptz  not null default now(),
  updated_at     timestamptz  not null default now()
);

create table public.leave_policy_rules (
  id                       uuid primary key default gen_random_uuid(),
  policy_id                uuid not null references public.leave_policies on delete cascade,
  leave_type_id            uuid not null references public.leave_types    on delete cascade,
  annual_entitlement       numeric(5,2) not null default 0,
  monthly_accrual          numeric(5,2) not null default 0,
  carry_forward_limit      numeric(5,2) not null default 0,
  encashment_allowed       boolean      not null default false,
  minimum_notice_days      integer      not null default 0,
  maximum_days_per_request integer,
  probation_allowed        boolean      not null default false,
  created_at               timestamptz  not null default now(),
  updated_at               timestamptz  not null default now(),
  unique (policy_id, leave_type_id)
);

create table public.leave_balances (
  id               uuid primary key default gen_random_uuid(),
  employee_id      uuid     not null references public.employees  on delete cascade,
  leave_type_id    uuid     not null references public.leave_types on delete cascade,
  year             smallint not null,
  opening_balance  numeric(6,2) not null default 0,
  accrued          numeric(6,2) not null default 0,
  used             numeric(6,2) not null default 0,
  adjusted         numeric(6,2) not null default 0,
  encashed         numeric(6,2) not null default 0,
  closing_balance  numeric(6,2) generated always as (
                     opening_balance + accrued + adjusted - used - encashed
                   ) stored,
  updated_at       timestamptz not null default now(),
  unique (employee_id, leave_type_id, year)
);

create table public.leave_transactions (
  id               uuid primary key default gen_random_uuid(),
  employee_id      uuid not null references public.employees  on delete cascade,
  leave_type_id    uuid not null references public.leave_types on delete cascade,
  transaction_type varchar(20) not null
                     check (transaction_type in ('ACCRUAL','CONSUMPTION','ADJUSTMENT','ENCASHMENT','REVERSAL')),
  quantity         numeric(6,2) not null,
  reference_id     uuid,
  reason           text,
  transaction_date date         not null,
  created_by       uuid references public.employees on delete set null,
  created_at       timestamptz  not null default now()
);

create table public.leave_requests (
  id                   uuid primary key default gen_random_uuid(),
  employee_id          uuid not null references public.employees  on delete cascade,
  leave_type_id        uuid not null references public.leave_types on delete cascade,
  from_date            date not null,
  to_date              date not null,
  total_days           numeric(5,2) not null,
  half_day_type        varchar(10),
  reason               text,
  attachment_document_id uuid,                    -- FK added after documents table
  status               public.leave_request_status_enum not null default 'PENDING',
  submitted_at         timestamptz not null default now(),
  cancelled_at         timestamptz,
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now(),
  check (to_date >= from_date)
);

create table public.leave_approvals (
  id               uuid primary key default gen_random_uuid(),
  leave_request_id uuid not null references public.leave_requests on delete cascade,
  approver_id      uuid not null references public.employees       on delete cascade,
  approval_level   smallint    not null default 1,
  action           public.approval_action_enum not null,
  comments         text,
  acted_at         timestamptz not null default now(),
  created_at       timestamptz not null default now()
);
