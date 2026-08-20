-- 09_assets.sql

create sequence public.asset_code_seq start 1;

create table public.asset_categories (
  id         uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies on delete cascade,
  code       varchar(30)  not null,
  name       varchar(100) not null,
  prefix     varchar(10)  not null,            -- e.g. LAP, MOB, SIM
  is_active  boolean      not null default true,
  unique (company_id, code)
);

create table public.asset_brands (
  id         uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies on delete cascade,
  name       varchar(100) not null,
  is_active  boolean      not null default true,
  created_at timestamptz  not null default now()
);

create table public.assets (
  id                  uuid primary key default gen_random_uuid(),
  company_id          uuid not null references public.companies       on delete cascade,
  location_id         uuid references public.locations                on delete set null,
  asset_category_id   uuid not null references public.asset_categories on delete restrict,
  brand_id            uuid references public.asset_brands             on delete set null,
  asset_code          varchar(30) not null unique,
  asset_tag           varchar(100),
  model               varchar(255),
  serial_number       varchar(255) unique,
  imei_1              varchar(20)  unique,
  imei_2              varchar(20)  unique,
  mobile_number       varchar(20)  unique,
  sim_number          varchar(30)  unique,
  purchase_date       date,
  purchase_cost       numeric(14,2),
  warranty_start      date,
  warranty_end        date,
  condition           varchar(30)  not null default 'GOOD',
  status              public.asset_status_enum not null default 'AVAILABLE',
  current_employee_id uuid references public.employees on delete set null,
  vendor_name         varchar(255),
  invoice_number      varchar(100),
  notes               text,
  created_at          timestamptz  not null default now(),
  updated_at          timestamptz  not null default now()
);

create table public.asset_assignments (
  id                   uuid primary key default gen_random_uuid(),
  asset_id             uuid not null references public.assets    on delete cascade,
  employee_id          uuid not null references public.employees on delete cascade,
  assigned_at          timestamptz  not null default now(),
  assigned_by          uuid references public.employees on delete set null,
  expected_return_date date,
  returned_at          timestamptz,
  status               varchar(20)  not null default 'ACTIVE',
  remarks              text,
  created_at           timestamptz  not null default now(),
  updated_at           timestamptz  not null default now()
);
create unique index uq_asset_assignment_active
  on public.asset_assignments (asset_id) where status = 'ACTIVE';

create table public.asset_handover (
  id                      uuid primary key default gen_random_uuid(),
  asset_assignment_id     uuid not null references public.asset_assignments on delete cascade,
  handover_date           date         not null,
  employee_acknowledged   boolean      not null default false,
  employee_signature_path text,
  handover_document_path  text,
  condition_at_handover   varchar(30),
  remarks                 text,
  created_at              timestamptz  not null default now()
);

create table public.asset_returns (
  id                  uuid primary key default gen_random_uuid(),
  asset_assignment_id uuid not null references public.asset_assignments on delete cascade,
  return_date         date         not null,
  received_by         uuid references public.employees on delete set null,
  condition_at_return varchar(30),
  damage_description  text,
  missing_items       text,
  recovery_amount     numeric(12,2),
  remarks             text,
  created_at          timestamptz  not null default now()
);

create table public.asset_maintenance (
  id               uuid primary key default gen_random_uuid(),
  asset_id         uuid not null references public.assets    on delete cascade,
  maintenance_type varchar(50)   not null,
  vendor           varchar(255),
  started_at       timestamptz,
  completed_at     timestamptz,
  cost             numeric(12,2),
  description      text,
  status           varchar(20)   not null default 'OPEN',
  created_by       uuid references public.employees on delete set null,
  created_at       timestamptz   not null default now()
);

create table public.asset_audit (
  id          uuid primary key default gen_random_uuid(),
  asset_id    uuid not null references public.assets    on delete cascade,
  audited_by  uuid references public.employees on delete set null,
  audit_date  date         not null,
  condition   varchar(30),
  location_id uuid references public.locations on delete set null,
  notes       text,
  created_at  timestamptz  not null default now()
);
