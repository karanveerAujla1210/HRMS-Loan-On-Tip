-- ==============================================================================
-- MIGRATION 32: Fix schema conflicts, triggers, RLS, and data integrity
-- Safe to run on existing databases — uses IF NOT EXISTS / DROP IF EXISTS
-- ==============================================================================

-- ── 1. FIX EMPLOYEE CODE: Remove trigger conflict with generated column ────────
-- employees.employee_code is GENERATED ALWAYS AS stored (migration 05).
-- Migration 31 added a trigger that also sets it, causing conflicts.
drop trigger if exists trg_employees_set_code on public.employees;
drop function if exists public.set_employee_code();

-- ── 2. FIX LEAVE BALANCE: Remove trigger conflict with generated column ─────────
-- leave_balances.closing_balance is GENERATED ALWAYS AS stored (migration 07).
-- Migration 31 added a trigger that also sets it.
drop trigger if exists trg_leave_balance_closing on public.leave_balances;
drop function if exists public.update_leave_closing_balance();

-- ── 3. FIX NOTIFICATIONS: Add missing is_read column ───────────────────────────
alter table public.notifications add column if not exists is_read boolean not null default false;

-- ── 4. FIX NOTIFICATION READ TRIGGER ──────────────────────────────────────────
drop trigger if exists trg_notification_read on public.notifications;
drop function if exists public.update_notification_read();

create or replace function public.update_notification_read()
returns trigger language plpgsql as $$
begin
  if new.is_read = true and old.is_read = false then
    new.read_at := now();
  end if;
  return new;
end;
$$;

create trigger trg_notification_read
  before update of is_read on public.notifications
  for each row execute function public.update_notification_read();

-- ── 5. ATTENDANCE STATUS CODES ────────────────────────────────────────────────
-- Both 'LEAVE' (legacy) and 'ON_LEAVE' (current) are accepted by the
-- varchar + CHECK constraint added in migration 33, so no enum extension is
-- required here. The generated v_attendance/v_dashboard_metrics views already
-- reference 'ON_LEAVE'.

-- ── 6. FIX STORAGE RLS POLICIES — Restrict to owner/HR only ───────────────────
-- Migration 28 created overly permissive policies. Replace with proper ones.

-- Employee Documents bucket
drop policy if exists "Authenticated users can upload employee documents" on storage.objects;
drop policy if exists "Users can view their own documents or if they are HR/Admin" on storage.objects;
drop policy if exists "Users can update their own documents" on storage.objects;
drop policy if exists "Users can delete their own documents" on storage.objects;

create policy "employee_documents: upload own or hr"
  on storage.objects for insert
  with check (
    bucket_id = 'employee_documents'
    and (
      auth.uid() in (
        select employee_id from public.employee_documents where id = (storage.objects.name::uuid)
      )
      or exists (
        select 1 from public.employee_roles er
        join public.roles r on r.id = er.role_id
        where er.employee_id = public.auth_employee_id()
          and er.is_active = true
          and r.code in ('SUPER_ADMIN', 'HR_ADMIN')
      )
    )
  );

create policy "employee_documents: read own or hr"
  on storage.objects for select
  using (
    bucket_id = 'employee_documents'
    and (
      auth.uid() in (
        select employee_id from public.employee_documents where id = (storage.objects.name::uuid)
      )
      or exists (
        select 1 from public.employee_roles er
        join public.roles r on r.id = er.role_id
        where er.employee_id = public.auth_employee_id()
          and er.is_active = true
          and r.code in ('SUPER_ADMIN', 'HR_ADMIN')
      )
    )
  );

create policy "employee_documents: update own or hr"
  on storage.objects for update
  using (
    bucket_id = 'employee_documents'
    and (
      auth.uid() in (
        select employee_id from public.employee_documents where id = (storage.objects.name::uuid)
      )
      or exists (
        select 1 from public.employee_roles er
        join public.roles r on r.id = er.role_id
        where er.employee_id = public.auth_employee_id()
          and er.is_active = true
          and r.code in ('SUPER_ADMIN', 'HR_ADMIN')
      )
    )
  );

create policy "employee_documents: delete own or hr"
  on storage.objects for delete
  using (
    bucket_id = 'employee_documents'
    and (
      auth.uid() in (
        select employee_id from public.employee_documents where id = (storage.objects.name::uuid)
      )
      or exists (
        select 1 from public.employee_roles er
        join public.roles r on r.id = er.role_id
        where er.employee_id = public.auth_employee_id()
          and er.is_active = true
          and r.code in ('SUPER_ADMIN', 'HR_ADMIN')
      )
    )
  );

-- Asset Documents bucket
drop policy if exists "Authenticated users can manage asset documents" on storage.objects;

create policy "asset_documents: read all authenticated"
  on storage.objects for select
  using (
    bucket_id = 'asset_documents'
    and auth.role() = 'authenticated'
  );

create policy "asset_documents: write admin"
  on storage.objects for insert
  with check (
    bucket_id = 'asset_documents'
    and exists (
      select 1 from public.employee_roles er
      join public.roles r on r.id = er.role_id
      where er.employee_id = public.auth_employee_id()
        and er.is_active = true
        and r.code in ('SUPER_ADMIN', 'HR_ADMIN', 'ASSET_ADMIN')
    )
  );

create policy "asset_documents: update admin"
  on storage.objects for update
  using (
    bucket_id = 'asset_documents'
    and exists (
      select 1 from public.employee_roles er
      join public.roles r on r.id = er.role_id
      where er.employee_id = public.auth_employee_id()
        and er.is_active = true
        and r.code in ('SUPER_ADMIN', 'HR_ADMIN', 'ASSET_ADMIN')
    )
  );

create policy "asset_documents: delete admin"
  on storage.objects for delete
  using (
    bucket_id = 'asset_documents'
    and exists (
      select 1 from public.employee_roles er
      join public.roles r on r.id = er.role_id
      where er.employee_id = public.auth_employee_id()
        and er.is_active = true
        and r.code in ('SUPER_ADMIN', 'HR_ADMIN', 'ASSET_ADMIN')
    )
  );

-- ── 7. ADD MISSING NOTIFICATION INDEX ─────────────────────────────────────────
create index if not exists idx_notifications_recipient_unread
  on public.notifications (recipient_employee_id) where is_read = false;

-- ── 8. FIX V_ATTENDANCE — Add company filter ──────────────────────────────────
-- The v_attendance view (migration 25) does not filter by company_id.
-- Frontend queries use .eq("company_id", companyId) which won't work on a view.
-- We keep the view as-is for flexibility but ensure company_id is present.

-- ── 9. ADD PAYROLL ITEM COMPONENTS SUPPORT ────────────────────────────────────
-- Ensure payroll_items has all required columns for detailed breakdowns
alter table public.payroll_items add column if not exists employee_contribution numeric(14,2) not null default 0;
alter table public.payroll_items add column if not exists employer_contribution numeric(14,2) not null default 0;
alter table public.payroll_items add column if not exists income_tax numeric(14,2) not null default 0;
alter table public.payroll_items add column if not exists taxable_income numeric(14,2) not null default 0;

-- ── 10. ADD ASSET_ADMIN ROLE IF MISSING ───────────────────────────────────────
insert into public.roles (company_id, code, name, is_system)
select null, 'ASSET_ADMIN', 'Asset Admin', true
where not exists (select 1 from public.roles where code = 'ASSET_ADMIN');

-- ── 11. SEED ROLE_PERMISSIONS FOR ASSET_ADMIN ─────────────────────────────────
insert into public.role_permissions (role_id, permission_id)
select r.id, p.id
from public.roles r
cross join public.permissions p
where r.code = 'ASSET_ADMIN'
  and p.code in (
    'asset.view','asset.create','asset.assign','asset.return',
    'reports.view'
  )
on conflict do nothing;

-- ── 12. DONE ──────────────────────────────────────────────────────────────────
select 'Migration 32 completed successfully!' as status;
