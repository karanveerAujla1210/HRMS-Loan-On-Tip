-- 26_asset_enhancements.sql
-- Self-contained migration: Creates missing asset tables if not present, sets RLS and views.

-- ── 1. Create Tables If Not Exist ──────────────────────────────────────────

create table if not exists public.asset_maintenance (
  id               uuid primary key default gen_random_uuid(),
  asset_id         uuid not null references public.assets on delete cascade,
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

create table if not exists public.asset_handover (
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

create table if not exists public.asset_returns (
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

-- ── 2. Enable RLS ──────────────────────────────────────────────────────────

alter table public.assets            enable row level security;
alter table public.asset_assignments enable row level security;
alter table public.asset_maintenance enable row level security;
alter table public.asset_handover    enable row level security;
alter table public.asset_returns     enable row level security;
alter table public.asset_categories  enable row level security;
alter table public.asset_brands      enable row level security;

-- ── 3. Idempotent Policies (Drop if exists then create) ─────────────────────

-- Asset Categories
drop policy if exists "asset_categories: read all active" on public.asset_categories;
create policy "asset_categories: read all active" on public.asset_categories for select using (true);

drop policy if exists "asset_categories: admin manage" on public.asset_categories;
create policy "asset_categories: admin manage" on public.asset_categories for all using (true);

-- Asset Brands
drop policy if exists "asset_brands: read all" on public.asset_brands;
create policy "asset_brands: read all" on public.asset_brands for select using (true);

drop policy if exists "asset_brands: admin manage" on public.asset_brands;
create policy "asset_brands: admin manage" on public.asset_brands for all using (true);

-- Asset Maintenance
drop policy if exists "asset_maintenance: admin read" on public.asset_maintenance;
create policy "asset_maintenance: admin read" on public.asset_maintenance for select using (true);

drop policy if exists "asset_maintenance: admin insert" on public.asset_maintenance;
create policy "asset_maintenance: admin insert" on public.asset_maintenance for insert with check (true);

drop policy if exists "asset_maintenance: admin update" on public.asset_maintenance;
create policy "asset_maintenance: admin update" on public.asset_maintenance for update using (true);

-- Asset Handover
drop policy if exists "asset_handover: read" on public.asset_handover;
create policy "asset_handover: read" on public.asset_handover for select using (true);

drop policy if exists "asset_handover: insert" on public.asset_handover;
create policy "asset_handover: insert" on public.asset_handover for insert with check (true);

drop policy if exists "asset_handover: update" on public.asset_handover;
create policy "asset_handover: update" on public.asset_handover for update using (true);

-- Asset Returns
drop policy if exists "asset_returns: read" on public.asset_returns;
create policy "asset_returns: read" on public.asset_returns for select using (true);

drop policy if exists "asset_returns: insert" on public.asset_returns;
create policy "asset_returns: insert" on public.asset_returns for insert with check (true);

-- ── 4. Create or Replace Views ─────────────────────────────────────────────

create or replace view public.v_asset_inventory as
select
  a.id,
  a.company_id,
  a.asset_code,
  a.asset_tag,
  a.asset_category_id,
  ac.name as category,
  ac.prefix as category_prefix,
  a.brand_id,
  ab.name as brand,
  a.model,
  a.serial_number,
  a.imei_1,
  a.imei_2,
  a.mobile_number,
  a.sim_number,
  a.purchase_date,
  a.purchase_cost,
  a.warranty_start,
  a.warranty_end,
  a.condition,
  a.status,
  a.current_employee_id,
  e.display_name as assigned_to,
  e.employee_code as assigned_employee_code,
  e.official_email as assigned_employee_email,
  a.location_id,
  l.name as location,
  a.vendor_name,
  a.invoice_number,
  a.notes,
  a.created_at,
  a.updated_at
from public.assets a
join public.asset_categories ac on ac.id = a.asset_category_id
left join public.asset_brands  ab on ab.id = a.brand_id
left join public.employees     e  on e.id  = a.current_employee_id
left join public.locations     l  on l.id  = a.location_id;

create or replace view public.v_asset_maintenance as
select
  m.id,
  m.asset_id,
  a.asset_code,
  a.model,
  a.company_id,
  ac.name as category,
  m.maintenance_type,
  m.vendor,
  m.started_at,
  m.completed_at,
  m.cost,
  m.description,
  m.status,
  m.created_by,
  cb.display_name as created_by_name,
  m.created_at
from public.asset_maintenance m
join public.assets a on a.id = m.asset_id
join public.asset_categories ac on ac.id = a.asset_category_id
left join public.employees cb on cb.id = m.created_by;
