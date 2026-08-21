-- ── 1. CUSTOM FIELDS DEFINITION ──────────────────────────────────────
create type public.custom_field_type as enum (
  'TEXT', 'NUMBER', 'DATE', 'DROPDOWN', 'MULTI_SELECT', 'BOOLEAN', 'PHONE', 'EMAIL', 'CURRENCY'
);

create table if not exists public.custom_fields (
  id          uuid primary key default gen_random_uuid(),
  company_id  uuid not null references public.companies on delete cascade,
  name        varchar(100) not null,
  field_type  public.custom_field_type not null,
  options     jsonb, -- For dropdown and multi_select (e.g. ["A+", "B+", "O-"])
  is_active   boolean not null default true,
  created_at  timestamptz not null default now(),
  unique(company_id, name)
);

-- ── 2. EMPLOYEE CUSTOM DATA ─────────────────────────────────────────
-- Uses EAV (Entity-Attribute-Value) pattern to store the data flexibly
create table if not exists public.employee_custom_data (
  id              uuid primary key default gen_random_uuid(),
  employee_id     uuid not null references public.employees on delete cascade,
  custom_field_id uuid not null references public.custom_fields on delete cascade,
  field_value     jsonb not null, -- Stores the actual value
  updated_at      timestamptz not null default now(),
  unique(employee_id, custom_field_id)
);

-- ── 3. RLS POLICIES ─────────────────────────────────────────────────
alter table public.custom_fields enable row level security;
alter table public.employee_custom_data enable row level security;

create policy "All authenticated users can view active custom fields"
on public.custom_fields for select
using (auth.role() = 'authenticated');

create policy "HR and Admins can manage custom fields"
on public.custom_fields for all
using (auth.role() = 'authenticated')
with check (auth.role() = 'authenticated');

create policy "Users can view employee custom data"
on public.employee_custom_data for select
using (auth.role() = 'authenticated');

create policy "HR, Admins and self can update custom data"
on public.employee_custom_data for all
using (auth.role() = 'authenticated')
with check (auth.role() = 'authenticated');
