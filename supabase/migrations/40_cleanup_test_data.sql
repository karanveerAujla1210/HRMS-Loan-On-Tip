-- ==============================================================================
-- MIGRATION 40: Remove test/dummy data and restore reporting views
-- ==============================================================================

-- ── 1. Remove test admin auth user ────────────────────────────────────────────
delete from auth.users where email = 'admin@loanontip.com';

-- ── 2. Remove test company and all cascading operational data ─────────────────
delete from public.companies where id = '00000000-0000-0000-0000-000000000001';

-- ── 3. Reporting views (functional, not test data) ────────────────────────────
--    Extracted from the old demo-seed migration so they survive cleanup.

create or replace view public.v_employee_directory as
select
  e.id, e.company_id, e.employee_code, e.display_name,
  e.official_email, e.official_mobile,
  d.name  as department,
  dg.name as designation,
  l.name  as location,
  m.display_name as manager_name,
  e.employment_status, e.joining_date
from public.employees e
left join public.departments  d  on d.id  = e.department_id
left join public.designations dg on dg.id = e.designation_id
left join public.locations    l  on l.id  = e.location_id
left join public.employees    m  on m.id  = e.manager_id;

create or replace view public.v_today_attendance as
select
  a.id, a.employee_id, e.display_name, e.employee_code,
  l.name as location,
  a.attendance_date, a.status,
  a.check_in_at, a.check_out_at,
  a.worked_minutes, a.late_minutes
from public.attendance a
join public.employees e on e.id = a.employee_id
left join public.locations l on l.id = a.location_id
where a.attendance_date = current_date;

create or replace view public.v_pending_leave_approvals as
select
  lr.id, lr.employee_id, e.display_name, e.employee_code,
  lt.name as leave_type,
  lr.from_date, lr.to_date, lr.total_days, lr.reason,
  lr.submitted_at
from public.leave_requests lr
join public.employees  e  on e.id  = lr.employee_id
join public.leave_types lt on lt.id = lr.leave_type_id
where lr.status = 'PENDING';

create or replace view public.v_asset_inventory as
select
  a.id, a.company_id, a.asset_code, a.asset_tag,
  ac.name as category, ab.name as brand,
  a.model, a.serial_number, a.imei_1, a.mobile_number,
  a.status, a.condition,
  e.display_name as assigned_to,
  l.name as location,
  a.warranty_end
from public.assets a
join public.asset_categories ac on ac.id = a.asset_category_id
left join public.asset_brands  ab on ab.id = a.brand_id
left join public.employees     e  on e.id  = a.current_employee_id
left join public.locations     l  on l.id  = a.location_id;

create or replace view public.v_dashboard_metrics as
select
  c.id as company_id,
  (select count(*) from public.employees where company_id = c.id and employment_status = 'ACTIVE')  as active_employees,
  (select count(*) from public.attendance where company_id = c.id and attendance_date = current_date and status in ('PRESENT','LATE')) as present_today,
  (select count(*) from public.leave_requests lr join public.employees e on e.id = lr.employee_id where e.company_id = c.id and lr.status = 'PENDING') as pending_leaves,
  (select count(*) from public.assets where company_id = c.id and status = 'AVAILABLE') as available_assets
from public.companies c;

select 'Migration 40 completed' as status;
