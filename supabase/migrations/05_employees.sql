-- 05_employees.sql
-- employees and all satellite people tables.

-- ── Sequence for human-readable employee codes ────────────────────────────────
create sequence public.employee_code_seq start 1;

create table public.employees (
  -- Identity
  id                   uuid primary key default gen_random_uuid(),
  company_id           uuid not null references public.companies on delete cascade,
  employee_code        varchar(20) not null
                         generated always as (
                           'EMP-' || lpad(nextval('public.employee_code_seq')::text, 6, '0')
                         ) stored,
  first_name           varchar(100) not null,
  middle_name          varchar(100),
  last_name            varchar(100) not null,
  display_name         varchar(255) generated always as (
                         trim(first_name || ' ' || coalesce(middle_name || ' ', '') || last_name)
                       ) stored,
  gender               varchar(20),
  date_of_birth        date,
  blood_group          varchar(5),
  profile_photo_url    text,
  -- Employment
  joining_date         date         not null,
  confirmation_date    date,
  employment_type_id   uuid references public.employment_types on delete set null,
  department_id        uuid references public.departments       on delete set null,
  designation_id       uuid references public.designations      on delete set null,
  team_id              uuid references public.teams             on delete set null,
  location_id          uuid references public.locations         on delete set null,
  manager_id           uuid references public.employees         on delete set null,
  hr_manager_id        uuid references public.employees         on delete set null,
  employment_status    public.employment_status_enum not null default 'ACTIVE',
  probation_end_date   date,
  notice_period_days   integer,
  last_working_date    date,
  -- Contact
  official_email       varchar(255) unique,
  personal_email       varchar(255),
  official_mobile      varchar(20),
  personal_mobile      varchar(20),
  -- Other
  nationality          varchar(100) default 'Indian',
  marital_status       varchar(30),
  created_at           timestamptz  not null default now(),
  updated_at           timestamptz  not null default now(),
  unique (company_id, employee_code)
);

-- Back-fill deferred FKs now that employees exists
alter table public.departments  add constraint fk_dept_head
  foreign key (head_employee_id)    references public.employees on delete set null;
alter table public.teams        add constraint fk_team_manager
  foreign key (manager_employee_id) references public.employees on delete set null;
alter table public.shift_assignments add constraint fk_shift_emp
  foreign key (employee_id)         references public.employees on delete cascade;
alter table public.shift_assignments add constraint fk_shift_assigned_by
  foreign key (assigned_by)         references public.employees on delete set null;
alter table public.profiles     add constraint fk_profile_employee
  foreign key (employee_id)         references public.employees on delete set null;

-- ── Satellite tables ──────────────────────────────────────────────────────────

create table public.employee_contacts (
  id            uuid primary key default gen_random_uuid(),
  employee_id   uuid not null references public.employees on delete cascade,
  contact_type  varchar(30) not null,
  contact_name  varchar(255),
  relationship  varchar(50),
  mobile        varchar(20),
  email         varchar(255),
  is_primary    boolean     not null default false,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create table public.employee_addresses (
  id            uuid primary key default gen_random_uuid(),
  employee_id   uuid not null references public.employees on delete cascade,
  address_type  varchar(20) not null check (address_type in ('CURRENT','PERMANENT','OFFICE')),
  address_line1 text,
  address_line2 text,
  city          varchar(100),
  state         varchar(100),
  country       varchar(100) default 'India',
  pincode       varchar(20),
  is_current    boolean     not null default true,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create table public.employee_emergency_contacts (
  id               uuid primary key default gen_random_uuid(),
  employee_id      uuid not null references public.employees on delete cascade,
  name             varchar(255) not null,
  relationship     varchar(50),
  mobile           varchar(20)  not null,
  alternate_mobile varchar(20),
  address          text,
  is_primary       boolean     not null default false,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

create table public.employee_bank_accounts (
  id                       uuid primary key default gen_random_uuid(),
  employee_id              uuid not null references public.employees on delete cascade,
  account_holder_name      varchar(255) not null,
  bank_name                varchar(255) not null,
  account_number_encrypted text         not null,  -- pgp_sym_encrypt at app layer
  account_number_last4     varchar(4)   not null,
  ifsc_code                varchar(20)  not null,
  branch_name              varchar(255),
  account_type             varchar(30)  not null default 'SAVINGS',
  is_primary               boolean      not null default false,
  is_verified              boolean      not null default false,
  verified_at              timestamptz,
  created_at               timestamptz  not null default now(),
  updated_at               timestamptz  not null default now()
);

create table public.employee_statutory_details (
  id                      uuid primary key default gen_random_uuid(),
  employee_id             uuid unique not null references public.employees on delete cascade,
  pan_encrypted           text,
  pan_last4               varchar(4),
  uan                     varchar(30),
  pf_number               varchar(30),
  esi_number              varchar(30),
  professional_tax_number varchar(30),
  aadhaar_last4           varchar(4),
  tax_regime              varchar(10) default 'NEW',
  created_at              timestamptz not null default now(),
  updated_at              timestamptz not null default now()
);

create table public.employee_history (
  id             uuid primary key default gen_random_uuid(),
  employee_id    uuid not null references public.employees on delete cascade,
  change_type    varchar(50) not null,
  old_value      jsonb,
  new_value      jsonb,
  effective_date date        not null,
  reason         text,
  changed_by     uuid references public.employees on delete set null,
  created_at     timestamptz not null default now()
);

create table public.employee_manager_history (
  id             uuid primary key default gen_random_uuid(),
  employee_id    uuid not null references public.employees on delete cascade,
  manager_id     uuid references public.employees on delete set null,
  effective_from date        not null,
  effective_to   date,
  is_current     boolean     not null default true,
  changed_by     uuid references public.employees on delete set null,
  created_at     timestamptz not null default now()
);
create unique index uq_manager_history_current
  on public.employee_manager_history (employee_id) where is_current = true;
