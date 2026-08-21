-- 24_views_extended.sql
-- Extended dashboard metrics and supporting views.

-- Drop and recreate v_dashboard_metrics with full operational stats
create or replace view public.v_dashboard_metrics as
select
  c.id as company_id,
  (select count(*) from public.employees where company_id = c.id and employment_status = 'ACTIVE')  as active_employees,
  (select count(*) from public.employees where company_id = c.id and employment_status = 'INACTIVE') as inactive_employees,
  (select count(*) from public.attendance where company_id = c.id and attendance_date = current_date and status in ('PRESENT','LATE')) as present_today,
  (select count(*) from public.attendance where company_id = c.id and attendance_date = current_date and status = 'ABSENT') as absent_today,
  (select count(*) from public.attendance where company_id = c.id and attendance_date = current_date and status = 'LATE') as late_today,
  (select count(*) from public.attendance where company_id = c.id and attendance_date = current_date and status = 'HALF_DAY') as half_day_today,
  (select count(*) from public.attendance where company_id = c.id and attendance_date = current_date and status = 'ON_LEAVE') as on_leave_today,
  (select count(*) from public.leave_requests lr join public.employees e on e.id = lr.employee_id where e.company_id = c.id and lr.status = 'PENDING') as pending_leaves,
  (select count(*) from public.attendance_adjustments aa join public.attendance a on a.id = aa.attendance_id where a.company_id = c.id and aa.status = 'PENDING') as pending_corrections,
  (select count(*) from public.attendance_exceptions ae join public.attendance a on a.id = ae.attendance_id where a.company_id = c.id and ae.status = 'OPEN') as open_exceptions,
  (select count(*) from public.assets where company_id = c.id and status = 'AVAILABLE') as available_assets,
  (select count(*) from public.assets where company_id = c.id and status = 'ASSIGNED') as assigned_assets,
  (select count(*) from public.employees where company_id = c.id and joining_date >= current_date - interval '30 days' and employment_status = 'ACTIVE') as new_joiners_30d,
  (select count(*) from public.employees where company_id = c.id and employment_status = 'NOTICE_PERIOD') as on_notice,
  (select count(*) from public.payroll_runs where company_id = c.id and status = 'DRAFT') as draft_payroll_runs,
  (select count(*) from public.payroll_runs where company_id = c.id and status = 'CALCULATED') as pending_payroll_approvals
from public.companies c;

-- Employee profile view (full detail for /people/[id])
create or replace view public.v_employee_profile as
select
  e.id, e.company_id, e.employee_code, e.display_name,
  e.first_name, e.middle_name, e.last_name,
  e.gender, e.date_of_birth, e.blood_group, e.profile_photo_url,
  e.official_email, e.personal_email, e.official_mobile, e.personal_mobile,
  e.joining_date, e.confirmation_date, e.probation_end_date,
  e.notice_period_days, e.last_working_date,
  e.employment_status, e.nationality, e.marital_status,
  d.name  as department,  d.id as department_id,
  dg.name as designation, dg.id as designation_id,
  l.name  as location,    l.id as location_id,
  et.name as employment_type, et.id as employment_type_id,
  m.display_name as manager_name, m.id as manager_id,
  m.official_email as manager_email,
  hr.display_name as hr_manager_name, hr.id as hr_manager_id,
  e.created_at, e.updated_at
from public.employees e
left join public.departments    d  on d.id  = e.department_id
left join public.designations   dg on dg.id = e.designation_id
left join public.locations      l  on l.id  = e.location_id
left join public.employment_types et on et.id = e.employment_type_id
left join public.employees      m  on m.id  = e.manager_id
left join public.employees      hr on hr.id = e.hr_manager_id;

-- Attendance monthly summary view for employee profile
create or replace view public.v_employee_attendance_summary as
select
  a.employee_id,
  extract(year  from a.attendance_date)::smallint as year,
  extract(month from a.attendance_date)::smallint as month,
  count(*) filter (where a.status in ('PRESENT','LATE')) as present_days,
  count(*) filter (where a.status = 'ABSENT')            as absent_days,
  count(*) filter (where a.status = 'HALF_DAY')          as half_days,
  count(*) filter (where a.status = 'LATE')              as late_days,
  count(*) filter (where a.status = 'ON_LEAVE')          as leave_days,
  sum(a.worked_minutes)                                   as total_worked_minutes
from public.attendance a
group by a.employee_id, extract(year from a.attendance_date), extract(month from a.attendance_date);

-- Department headcount view
create or replace view public.v_department_headcount as
select
  d.id as department_id,
  d.company_id,
  d.name as department,
  count(e.id) filter (where e.employment_status = 'ACTIVE')       as active_count,
  count(e.id) filter (where e.employment_status = 'NOTICE_PERIOD') as notice_count,
  count(e.id)                                                       as total_count
from public.departments d
left join public.employees e on e.department_id = d.id
group by d.id, d.company_id, d.name;
