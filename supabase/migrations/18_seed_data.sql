-- 18_seed_data.sql
-- Demo seed + reporting views.

-- ── Reporting views ───────────────────────────────────────────────────────────

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

-- ── Demo seed data ────────────────────────────────────────────────────────────

insert into public.companies (id, company_code, legal_name, display_name, timezone, currency) values
  ('00000000-0000-0000-0000-000000000001',
   'LOT', 'ACG Leasing Limited', 'Loan On Tip', 'Asia/Kolkata', 'INR')
on conflict do nothing;

insert into public.locations (id, company_id, location_code, name, city, state, latitude, longitude, attendance_radius_meters) values
  ('11111111-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000001', 'DEL-HO', 'Delhi Head Office',  'Delhi',    'Delhi',     28.6139, 77.2090, 150),
  ('11111111-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000001', 'MUM-BR', 'Mumbai Branch',      'Mumbai',   'Maharashtra',19.0760, 72.8777, 150),
  ('11111111-0000-0000-0000-000000000003', '00000000-0000-0000-0000-000000000001', 'NOI-BR', 'Noida Branch',       'Noida',    'Uttar Pradesh',28.5355, 77.3910, 150),
  ('11111111-0000-0000-0000-000000000004', '00000000-0000-0000-0000-000000000001', 'GGN-BR', 'Gurugram Branch',    'Gurugram', 'Haryana',   28.4595, 77.0266, 150)
on conflict do nothing;

insert into public.departments (id, company_id, department_code, name) values
  (gen_random_uuid(), '00000000-0000-0000-0000-000000000001', 'HR',         'Human Resources'),
  (gen_random_uuid(), '00000000-0000-0000-0000-000000000001', 'CREDIT',     'Credit'),
  (gen_random_uuid(), '00000000-0000-0000-0000-000000000001', 'SALES',      'Sales'),
  (gen_random_uuid(), '00000000-0000-0000-0000-000000000001', 'COLLECTION', 'Collection'),
  (gen_random_uuid(), '00000000-0000-0000-0000-000000000001', 'FINANCE',    'Finance'),
  (gen_random_uuid(), '00000000-0000-0000-0000-000000000001', 'OPERATIONS', 'Operations'),
  (gen_random_uuid(), '00000000-0000-0000-0000-000000000001', 'TECHNOLOGY', 'Technology')
on conflict do nothing;

insert into public.designations (id, company_id, designation_code, name, level) values
  (gen_random_uuid(), '00000000-0000-0000-0000-000000000001', 'EXEC',   'Executive',          1),
  (gen_random_uuid(), '00000000-0000-0000-0000-000000000001', 'SR_EXEC','Senior Executive',   2),
  (gen_random_uuid(), '00000000-0000-0000-0000-000000000001', 'AM',     'Assistant Manager',  3),
  (gen_random_uuid(), '00000000-0000-0000-0000-000000000001', 'DM',     'Deputy Manager',     4),
  (gen_random_uuid(), '00000000-0000-0000-0000-000000000001', 'MGR',    'Manager',            5),
  (gen_random_uuid(), '00000000-0000-0000-0000-000000000001', 'SR_MGR', 'Senior Manager',     6),
  (gen_random_uuid(), '00000000-0000-0000-0000-000000000001', 'AVP',    'AVP',                7),
  (gen_random_uuid(), '00000000-0000-0000-0000-000000000001', 'VP',     'VP',                 8)
on conflict do nothing;

insert into public.employment_types (company_id, code, name) values
  ('00000000-0000-0000-0000-000000000001', 'FULL_TIME',  'Full Time'),
  ('00000000-0000-0000-0000-000000000001', 'PART_TIME',  'Part Time'),
  ('00000000-0000-0000-0000-000000000001', 'CONTRACT',   'Contract'),
  ('00000000-0000-0000-0000-000000000001', 'INTERN',     'Intern'),
  ('00000000-0000-0000-0000-000000000001', 'PROBATION',  'Probation')
on conflict do nothing;

insert into public.shifts (company_id, shift_code, name, start_time, end_time, grace_minutes) values
  ('00000000-0000-0000-0000-000000000001', 'GENERAL', 'General Shift', '09:30', '18:30', 15)
on conflict do nothing;

insert into public.leave_types (company_id, code, name, is_paid, allows_half_day) values
  ('00000000-0000-0000-0000-000000000001', 'CL',        'Casual Leave',     true,  true),
  ('00000000-0000-0000-0000-000000000001', 'SL',        'Sick Leave',       true,  true),
  ('00000000-0000-0000-0000-000000000001', 'PL',        'Privilege Leave',  true,  false),
  ('00000000-0000-0000-0000-000000000001', 'LWP',       'Leave Without Pay',false, true),
  ('00000000-0000-0000-0000-000000000001', 'MATERNITY', 'Maternity Leave',  true,  false),
  ('00000000-0000-0000-0000-000000000001', 'PATERNITY', 'Paternity Leave',  true,  false)
on conflict do nothing;

insert into public.asset_categories (company_id, code, name, prefix) values
  ('00000000-0000-0000-0000-000000000001', 'LAPTOP',   'Laptop',   'LAP'),
  ('00000000-0000-0000-0000-000000000001', 'MOBILE',   'Mobile',   'MOB'),
  ('00000000-0000-0000-0000-000000000001', 'SIM',      'SIM Card', 'SIM'),
  ('00000000-0000-0000-0000-000000000001', 'MONITOR',  'Monitor',  'MON'),
  ('00000000-0000-0000-0000-000000000001', 'HEADSET',  'Headset',  'HDS'),
  ('00000000-0000-0000-0000-000000000001', 'VEHICLE',  'Vehicle',  'VEH'),
  ('00000000-0000-0000-0000-000000000001', 'OTHER',    'Other',    'OTH')
on conflict do nothing;

insert into public.document_types (company_id, code, name) values
  ('00000000-0000-0000-0000-000000000001', 'AADHAAR',          'Aadhaar Card'),
  ('00000000-0000-0000-0000-000000000001', 'PAN',              'PAN Card'),
  ('00000000-0000-0000-0000-000000000001', 'OFFER_LETTER',     'Offer Letter'),
  ('00000000-0000-0000-0000-000000000001', 'JOINING_LETTER',   'Joining Letter'),
  ('00000000-0000-0000-0000-000000000001', 'EXPERIENCE_LETTER','Experience Letter'),
  ('00000000-0000-0000-0000-000000000001', 'SALARY_SLIP',      'Salary Slip'),
  ('00000000-0000-0000-0000-000000000001', 'BANK_PROOF',       'Bank Proof'),
  ('00000000-0000-0000-0000-000000000001', 'ADDRESS_PROOF',    'Address Proof'),
  ('00000000-0000-0000-0000-000000000001', 'ASSET_HANDOVER',   'Asset Handover Form')
on conflict do nothing;

insert into public.system_settings (company_id, setting_key, setting_value, data_type, description, is_public) values
  ('00000000-0000-0000-0000-000000000001', 'attendance.radius',              '150',   'INTEGER', 'Geo-fence radius in metres',          true),
  ('00000000-0000-0000-0000-000000000001', 'attendance.grace_minutes',       '15',    'INTEGER', 'Late grace period in minutes',        true),
  ('00000000-0000-0000-0000-000000000001', 'attendance.auto_absent_time',    '11:00', 'TIME',    'Daily close time (next day)',         false),
  ('00000000-0000-0000-0000-000000000001', 'payroll.cutoff_date',            '25',    'INTEGER', 'Payroll cutoff day of month',         false),
  ('00000000-0000-0000-0000-000000000001', 'leave.approval_levels',          '2',     'INTEGER', 'Number of approval levels for leave', false)
on conflict do nothing;
