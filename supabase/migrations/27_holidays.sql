-- 27_holidays.sql
-- Holiday calendar master table, safe column additions, RLS policies and seeds.

-- ── 1. Create or Alter Table ───────────────────────────────────────────────

create table if not exists public.holidays (
  id           uuid primary key default gen_random_uuid(),
  company_id   uuid not null references public.companies on delete cascade,
  location_id  uuid references public.locations on delete cascade,
  name         varchar(255) not null,
  holiday_date date         not null,
  is_optional  boolean      not null default false,
  description  text,
  created_at   timestamptz  not null default now(),
  updated_at   timestamptz  not null default now()
);

-- Ensure description and holiday_type exist if table was created in earlier migrations
alter table public.holidays add column if not exists description text;
alter table public.holidays add column if not exists holiday_type varchar(50) default 'NATIONAL';
alter table public.holidays add column if not exists is_optional boolean default false;

-- ── 2. Enable RLS and Idempotent Policies ──────────────────────────────────

alter table public.holidays enable row level security;

drop policy if exists "holidays: all read" on public.holidays;
create policy "holidays: all read" on public.holidays for select using (true);

drop policy if exists "holidays: admin insert" on public.holidays;
create policy "holidays: admin insert" on public.holidays for insert with check (true);

drop policy if exists "holidays: admin update" on public.holidays;
create policy "holidays: admin update" on public.holidays for update using (true);

drop policy if exists "holidays: admin delete" on public.holidays;
create policy "holidays: admin delete" on public.holidays for delete using (true);

-- ── 3. Seed National Holidays ──────────────────────────────────────────────

insert into public.holidays (company_id, name, holiday_date, description)
select c.id, 'Republic Day', '2026-01-26'::date, 'National Holiday'
from public.companies c
where not exists (
  select 1 from public.holidays h where h.company_id = c.id and h.holiday_date = '2026-01-26'::date
);

insert into public.holidays (company_id, name, holiday_date, description)
select c.id, 'Independence Day', '2026-08-15'::date, 'National Holiday'
from public.companies c
where not exists (
  select 1 from public.holidays h where h.company_id = c.id and h.holiday_date = '2026-08-15'::date
);

insert into public.holidays (company_id, name, holiday_date, description)
select c.id, 'Mahatma Gandhi Jayanti', '2026-10-02'::date, 'National Holiday'
from public.companies c
where not exists (
  select 1 from public.holidays h where h.company_id = c.id and h.holiday_date = '2026-10-02'::date
);

insert into public.holidays (company_id, name, holiday_date, description)
select c.id, 'Diwali (Deepavali)', '2026-11-08'::date, 'Festival Holiday'
from public.companies c
where not exists (
  select 1 from public.holidays h where h.company_id = c.id and h.holiday_date = '2026-11-08'::date
);

insert into public.holidays (company_id, name, holiday_date, description)
select c.id, 'Christmas Day', '2026-12-25'::date, 'Public Holiday'
from public.companies c
where not exists (
  select 1 from public.holidays h where h.company_id = c.id and h.holiday_date = '2026-12-25'::date
);
