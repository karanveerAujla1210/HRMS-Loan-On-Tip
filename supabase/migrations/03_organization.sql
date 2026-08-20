-- 03_organization.sql
-- locations, departments, teams, designations, employment_types,
-- shifts, shift_assignments, holidays, weekly_off_rules

create table public.locations (
  id                       uuid primary key default gen_random_uuid(),
  company_id               uuid not null references public.companies on delete cascade,
  location_code            varchar(20)  not null,
  name                     varchar(255) not null,
  location_type            varchar(50)  not null default 'OFFICE',
  address_line1            text,
  address_line2            text,
  city                     varchar(100),
  state                    varchar(100),
  pincode                  varchar(20),
  latitude                 numeric(9,6),
  longitude                numeric(9,6),
  attendance_radius_meters integer      not null default 150 check (attendance_radius_meters between 25 and 5000),
  timezone                 varchar(60)  not null default 'Asia/Kolkata',
  contact_name             varchar(255),
  contact_phone            varchar(20),
  is_active                boolean      not null default true,
  created_at               timestamptz  not null default now(),
  updated_at               timestamptz  not null default now(),
  unique (company_id, location_code)
);

create table public.departments (
  id               uuid primary key default gen_random_uuid(),
  company_id       uuid not null references public.companies on delete cascade,
  department_code  varchar(20)  not null,
  name             varchar(255) not null,
  description      text,
  head_employee_id uuid,                          -- FK added after employees table
  is_active        boolean     not null default true,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  unique (company_id, department_code)
);

create table public.teams (
  id                  uuid primary key default gen_random_uuid(),
  company_id          uuid not null references public.companies on delete cascade,
  department_id       uuid references public.departments on delete set null,
  location_id         uuid references public.locations  on delete set null,
  team_code           varchar(20)  not null,
  name                varchar(255) not null,
  manager_employee_id uuid,                       -- FK added after employees table
  is_active           boolean     not null default true,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),
  unique (company_id, team_code)
);

create table public.designations (
  id               uuid primary key default gen_random_uuid(),
  company_id       uuid not null references public.companies on delete cascade,
  designation_code varchar(20)  not null,
  name             varchar(255) not null,
  level            integer,
  description      text,
  is_active        boolean     not null default true,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  unique (company_id, designation_code)
);

create table public.employment_types (
  id          uuid primary key default gen_random_uuid(),
  company_id  uuid not null references public.companies on delete cascade,
  code        varchar(30)  not null,
  name        varchar(100) not null,
  description text,
  is_active   boolean     not null default true,
  unique (company_id, code)
);

create table public.shifts (
  id                      uuid primary key default gen_random_uuid(),
  company_id              uuid not null references public.companies on delete cascade,
  location_id             uuid references public.locations on delete set null,
  shift_code              varchar(20)  not null,
  name                    varchar(100) not null,
  start_time              time         not null,
  end_time                time         not null,
  break_minutes           integer      not null default 0,
  grace_minutes           integer      not null default 15,
  half_day_after_minutes  integer      not null default 240,
  full_day_after_minutes  integer      not null default 360,
  minimum_work_minutes    integer      not null default 240,
  overtime_after_minutes  integer      not null default 540,
  is_overnight            boolean      not null default false,
  is_active               boolean      not null default true,
  created_at              timestamptz  not null default now(),
  updated_at              timestamptz  not null default now(),
  unique (company_id, shift_code)
);

create table public.shift_assignments (
  id             uuid primary key default gen_random_uuid(),
  employee_id    uuid not null,                   -- FK added after employees table
  shift_id       uuid not null references public.shifts on delete restrict,
  effective_from date not null,
  effective_to   date,
  is_current     boolean     not null default true,
  assigned_by    uuid,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);
create unique index uq_shift_assignment_current
  on public.shift_assignments (employee_id) where is_current = true;

create table public.holidays (
  id           uuid primary key default gen_random_uuid(),
  company_id   uuid not null references public.companies on delete cascade,
  location_id  uuid references public.locations on delete set null,
  holiday_date date         not null,
  name         varchar(255) not null,
  holiday_type varchar(50)  not null default 'NATIONAL',
  is_optional  boolean      not null default false,
  created_at   timestamptz  not null default now(),
  updated_at   timestamptz  not null default now(),
  unique (company_id, location_id, holiday_date)
);

create table public.weekly_off_rules (
  id             uuid primary key default gen_random_uuid(),
  company_id     uuid not null references public.companies on delete cascade,
  location_id    uuid references public.locations on delete set null,
  day_of_week    smallint not null check (day_of_week between 0 and 6), -- 0=Sun
  week_number    smallint check (week_number between 1 and 5),          -- null = every week
  is_off         boolean  not null default true,
  effective_from date     not null,
  effective_to   date
);
