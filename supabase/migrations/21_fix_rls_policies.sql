-- ================================================================
-- Fix RLS: Add insert/update/delete policies
-- Run in Supabase Dashboard → SQL Editor
-- ================================================================

-- EMPLOYEES: insert, update, delete for HR/Super Admin
create policy "employee: hr insert"
  on public.employees for insert
  with check (
    company_id = public.auth_company_id()
    and public.has_permission('employee.create')
  );

create policy "employee: hr update"
  on public.employees for update
  using (
    company_id = public.auth_company_id()
    and public.has_permission('employee.update')
  );

create policy "employee: hr delete"
  on public.employees for delete
  using (
    company_id = public.auth_company_id()
    and public.has_permission('employee.delete')
  );

-- ASSETS: insert, update for asset admin
alter table public.assets enable row level security;

create policy "asset: admin read"
  on public.assets for select
  using (
    company_id = public.auth_company_id()
    and public.has_permission('asset.view')
  );

create policy "asset: admin insert"
  on public.assets for insert
  with check (
    company_id = public.auth_company_id()
    and public.has_permission('asset.create')
  );

create policy "asset: admin update"
  on public.assets for update
  using (
    company_id = public.auth_company_id()
    and public.has_permission('asset.assign')
  );

-- ASSET ASSIGNMENTS: insert for asset admin
create policy "asset_assignment: admin insert"
  on public.asset_assignments for insert
  with check (public.has_permission('asset.assign'));

create policy "asset_assignment: admin update"
  on public.asset_assignments for update
  using (public.has_permission('asset.assign'));

-- LEAVE REQUESTS: update for manager/HR (approve/reject)
create policy "leave: hr update"
  on public.leave_requests for update
  using (public.has_permission('leave.approve'));

-- PAYROLL RUNS: all for finance
alter table public.payroll_runs enable row level security;

create policy "payroll_run: finance read"
  on public.payroll_runs for select
  using (
    company_id = public.auth_company_id()
    and public.has_permission('payroll.view')
  );

create policy "payroll_run: finance insert"
  on public.payroll_runs for insert
  with check (
    company_id = public.auth_company_id()
    and public.has_permission('payroll.create')
  );

create policy "payroll_run: finance update"
  on public.payroll_runs for update
  using (
    company_id = public.auth_company_id()
    and public.has_permission('payroll.approve')
  );

-- Verify policies on employees table
select policyname, cmd, qual
from pg_policies
where tablename = 'employees'
order by cmd;
