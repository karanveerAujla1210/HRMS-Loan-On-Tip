-- ==============================================================================
-- MIGRATION 43: Harden RLS on sensitive tables
--
-- Several early migrations left UNRESTRICTED policies (USING (true) / FOR ALL
-- USING (true)) on asset, salary, holiday and dynamic-field tables. Those let
-- any authenticated user read or mutate every company's rows. This migration:
--   1. adds permissions_for_employee() used by the API and policies;
--   2. drops the insecure policies on the affected tables;
--   3. recreates least-privilege, company-scoped / permission-scoped policies.
-- Writes performed by the Next.js API use the service-role key (RLS bypass) and
-- are authorised in application code, so these policies additionally protect
-- direct client access.
-- ==============================================================================

-- ── 1. Permission helper ──────────────────────────────────────────────────────
create or replace function public.permissions_for_employee(p_employee_id uuid)
returns text[] language sql stable security definer as $$
  select coalesce(
    array_agg(distinct p.code order by p.code),
    array[]::text[]
  )
  from public.employee_roles er
  join public.role_permissions rp on rp.role_id = er.role_id
  join public.permissions p       on p.id = rp.permission_id
  where er.employee_id = p_employee_id
    and er.is_active   = true;
$$;

-- ── 2. Drop the insecure / redundant policies on the affected tables ───────────
do $$
declare
  p record;
begin
  for p in
    select schemaname, tablename, policyname
    from pg_policies
    where schemaname = 'public'
      and tablename in (
        'asset_categories', 'asset_brands', 'asset_maintenance',
        'asset_handover', 'asset_returns', 'holidays',
        'employee_salary_history', 'employee_salary_assignments',
        'custom_fields', 'employee_custom_data'
      )
  loop
    execute format('drop policy if exists %I on %I.%I', p.policyname, p.schemaname, p.tablename);
  end loop;
end $$;

-- ── 3. Asset reference data (non-sensitive lookup, but company-scoped) ─────────
create policy "asset_categories: company read"
  on public.asset_categories for select
  using (company_id = public.auth_company_id());

create policy "asset_categories: admin manage"
  on public.asset_categories for all
  using (public.has_permission('asset.create'))
  with check (public.has_permission('asset.create'));

create policy "asset_brands: company read"
  on public.asset_brands for select
  using (company_id = public.auth_company_id());

create policy "asset_brands: admin manage"
  on public.asset_brands for all
  using (public.has_permission('asset.create'))
  with check (public.has_permission('asset.create'));

-- ── 4. Asset lifecycle tables (scoped through the parent asset's company) ───────
create policy "asset_maintenance: company read"
  on public.asset_maintenance for select
  using (
    exists (
      select 1 from public.assets a
      where a.id = asset_maintenance.asset_id
        and a.company_id = public.auth_company_id()
    )
  );

create policy "asset_maintenance: admin write"
  on public.asset_maintenance for all
  using (public.has_permission('asset.repair'))
  with check (public.has_permission('asset.repair'));

create policy "asset_handover: company read"
  on public.asset_handover for select
  using (
    exists (
      select 1
      from public.asset_assignments aa
      join public.assets a on a.id = aa.asset_id
      where aa.id = asset_handover.asset_assignment_id
        and a.company_id = public.auth_company_id()
    )
  );

create policy "asset_handover: admin write"
  on public.asset_handover for all
  using (public.has_permission('asset.assign'))
  with check (public.has_permission('asset.assign'));

create policy "asset_returns: company read"
  on public.asset_returns for select
  using (
    exists (
      select 1
      from public.asset_assignments aa
      join public.assets a on a.id = aa.asset_id
      where aa.id = asset_returns.asset_assignment_id
        and a.company_id = public.auth_company_id()
    )
  );

create policy "asset_returns: admin write"
  on public.asset_returns for all
  using (public.has_permission('asset.return'))
  with check (public.has_permission('asset.return'));

-- ── 5. Holidays (low-risk reference; writes stay admin-only) ───────────────────
create policy "holidays: authenticated read"
  on public.holidays for select
  using (auth.role() = 'authenticated');

create policy "holidays: admin write"
  on public.holidays for all
  using (
    exists (
      select 1 from public.employee_roles er
      join public.roles r on r.id = er.role_id
      where er.employee_id = public.auth_employee_id()
        and er.is_active = true
        and r.code in ('SUPER_ADMIN','HR_ADMIN')
    )
  )
  with check (
    exists (
      select 1 from public.employee_roles er
      join public.roles r on r.id = er.role_id
      where er.employee_id = public.auth_employee_id()
        and er.is_active = true
        and r.code in ('SUPER_ADMIN','HR_ADMIN')
    )
  );

-- ── 6. Salary data (highly sensitive) ─────────────────────────────────────────
alter table public.employee_salary_assignments enable row level security;

create policy "salary_assignment: self or finance read"
  on public.employee_salary_assignments for select
  using (
    employee_id = public.auth_employee_id()
    or public.has_permission('employee.salary.view')
  );

create policy "salary_assignment: finance write"
  on public.employee_salary_assignments for all
  using (public.has_permission('employee.salary.manage'))
  with check (public.has_permission('employee.salary.manage'));

create policy "salary_history: self or finance read"
  on public.employee_salary_history for select
  using (
    employee_id = public.auth_employee_id()
    or public.has_permission('employee.salary.view')
  );

create policy "salary_history: finance write"
  on public.employee_salary_history for all
  using (public.has_permission('employee.salary.manage'))
  with check (public.has_permission('employee.salary.manage'));

-- ── 7. Dynamic fields ──────────────────────────────────────────────────────────
create policy "custom_fields: company read"
  on public.custom_fields for select
  using (company_id = public.auth_company_id());

create policy "custom_fields: admin manage"
  on public.custom_fields for all
  using (public.has_permission('organisation.manage'))
  with check (public.has_permission('organisation.manage'));

create policy "employee_custom_data: self or hr read"
  on public.employee_custom_data for select
  using (
    employee_id = public.auth_employee_id()
    or public.has_permission('employee.view')
  );

create policy "employee_custom_data: self or hr write"
  on public.employee_custom_data for all
  using (
    employee_id = public.auth_employee_id()
    or public.has_permission('employee.update')
  )
  with check (
    employee_id = public.auth_employee_id()
    or public.has_permission('employee.update')
  );

select 'Migration 43 (RLS hardening) completed' as status;
