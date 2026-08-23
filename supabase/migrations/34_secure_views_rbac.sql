-- ==============================================================================
-- MIGRATION 34: Secure views and seed the canonical RBAC matrix
--
-- 1. Every view is switched to security_invoker = true so that Row Level
--    Security on the underlying tables is honoured. Views created with
--    SECURITY DEFINER (the Postgres default) otherwise bypass RLS entirely,
--    leaking rows across company boundaries.
-- 2. The permission catalogue and role -> permission matrix are seeded from the
--    canonical definitions in packages/api-contract. tests/db/rbac-matrix.test.ts
--    fails the build if this matrix and the code ever diverge.
-- ==============================================================================

-- ── 1. Views honour RLS ───────────────────────────────────────────────────────
do $$
declare
  v record;
begin
  for v in
    select table_schema, table_name
    from information_schema.views
    where table_schema = 'public'
      and table_name not like 'pg_%'
  loop
    execute format(
      'alter view %I.%I set (security_invoker = true)',
      v.table_schema, v.table_name
    );
  end loop;
end $$;

-- ── 2. Permission catalogue (idempotent) ──────────────────────────────────────
insert into public.permissions (code, name, module) values
  ('employee.view',                 'View Employees',               'PEOPLE'),
  ('employee.create',               'Create Employee',              'PEOPLE'),
  ('employee.update',               'Update Employee',              'PEOPLE'),
  ('employee.delete',               'Delete Employee',              'PEOPLE'),
  ('employee.offboard',             'Offboard Employee',            'PEOPLE'),
  ('employee.document.view',        'View Employee Documents',      'PEOPLE'),
  ('employee.document.manage',      'Manage Employee Documents',    'PEOPLE'),
  ('employee.salary.view',          'View Employee Salary',         'PEOPLE'),
  ('employee.salary.manage',        'Manage Employee Salary',       'PEOPLE'),
  ('employee.bank.view',            'View Employee Bank Details',   'PEOPLE'),
  ('resignation.manage',            'Manage Resignations',          'PEOPLE'),
  ('attendance.mark_self',          'Mark Own Attendance',          'ATTENDANCE'),
  ('attendance.view',               'View Attendance',              'ATTENDANCE'),
  ('attendance.adjust',             'Adjust Attendance',            'ATTENDANCE'),
  ('attendance.approve',            'Approve Attendance',           'ATTENDANCE'),
  ('attendance.close',              'Run Attendance Daily Close',   'ATTENDANCE'),
  ('leave.view',                    'View Leaves',                  'LEAVE'),
  ('leave.apply',                   'Apply Leave',                  'LEAVE'),
  ('leave.approve',                 'Approve Leave',               'LEAVE'),
  ('leave.balance.manage',          'Manage Leave Balances',        'LEAVE'),
  ('payroll.view',                  'View Payroll',                 'PAYROLL'),
  ('payroll.create',                'Create Payroll',               'PAYROLL'),
  ('payroll.calculate',             'Calculate Payroll',           'PAYROLL'),
  ('payroll.approve',               'Approve Payroll',             'PAYROLL'),
  ('payroll.lock',                  'Lock Payroll',                'PAYROLL'),
  ('payslip.view_all',              'View All Payslips',            'PAYROLL'),
  ('asset.view',                    'View Assets',                  'ASSETS'),
  ('asset.create',                  'Create Asset',                'ASSETS'),
  ('asset.update',                  'Update Asset',                 'ASSETS'),
  ('asset.assign',                  'Assign Asset',                'ASSETS'),
  ('asset.return',                  'Return Asset',                'ASSETS'),
  ('asset.repair',                  'Manage Asset Repairs',        'ASSETS'),
  ('reports.view',                  'View Reports',                'REPORTS'),
  ('reports.export',                'Export Reports',              'REPORTS'),
  ('expense.view',                  'View Expenses',               'EXPENSES'),
  ('expense.approve',               'Approve Expenses',            'EXPENSES'),
  ('performance.view',              'View Performance',            'PERFORMANCE'),
  ('performance.manage',            'Manage Performance',          'PERFORMANCE'),
  ('helpdesk.view',                 'View Helpdesk',               'HELPDESK'),
  ('helpdesk.manage',               'Manage Helpdesk',             'HELPDESK'),
  ('audit.view',                    'View Audit Logs',             'SYSTEM'),
  ('settings.manage',               'Manage Settings',             'SYSTEM'),
  ('organisation.manage',           'Manage Organisation',         'SYSTEM'),
  ('role.manage',                   'Manage Roles',                'SYSTEM')
on conflict (code) do nothing;

-- ── 3. System roles (idempotent on company_id + code) ─────────────────────────
insert into public.roles (id, company_id, code, name, is_system) values
  (gen_random_uuid(), null, 'SUPER_ADMIN',      'Super Admin',      true),
  (gen_random_uuid(), null, 'HR_ADMIN',         'HR Admin',         true),
  (gen_random_uuid(), null, 'FINANCE_ADMIN',    'Finance Admin',    true),
  (gen_random_uuid(), null, 'ASSET_ADMIN',      'Asset Admin',      true),
  (gen_random_uuid(), null, 'OPERATIONS_ADMIN', 'Operations Admin', true),
  (gen_random_uuid(), null, 'LOCATION_ADMIN',   'Location Admin',   true),
  (gen_random_uuid(), null, 'MANAGER',          'Manager',          true),
  (gen_random_uuid(), null, 'EMPLOYEE',         'Employee',         true)
on conflict (company_id, code) do nothing;

-- ── 4. Role -> permission matrix ──────────────────────────────────────────────
insert into public.role_permissions (role_id, permission_id)
select r.id, p.id
from public.roles r
cross join public.permissions p
where r.company_id is null
  and (
    (r.code = 'SUPER_ADMIN')
    or
    (r.code = 'HR_ADMIN' and p.code in (
      'attendance.mark_self','attendance.view','leave.view','leave.apply','asset.view',
      'expense.view','helpdesk.view','employee.document.view',
      'employee.create','employee.update','employee.offboard','employee.document.manage',
      'resignation.manage','attendance.adjust','attendance.approve','attendance.close',
      'leave.approve','leave.balance.manage','payroll.view','reports.view','reports.export',
      'expense.approve','performance.view','performance.manage','helpdesk.manage',
      'organisation.manage'
    ))
    or
    (r.code = 'FINANCE_ADMIN' and p.code in (
      'attendance.mark_self','attendance.view','leave.view','leave.apply','asset.view',
      'expense.view','helpdesk.view','employee.document.view',
      'employee.salary.view','employee.salary.manage','employee.bank.view',
      'payroll.view','payroll.create','payroll.calculate','payroll.approve','payroll.lock',
      'payslip.view_all','reports.view','reports.export','expense.approve'
    ))
    or
    (r.code = 'ASSET_ADMIN' and p.code in (
      'attendance.mark_self','attendance.view','leave.view','leave.apply','asset.view',
      'expense.view','helpdesk.view','employee.document.view',
      'asset.create','asset.update','asset.assign','asset.return','asset.repair',
      'reports.view','reports.export'
    ))
    or
    (r.code = 'OPERATIONS_ADMIN' and p.code in (
      'attendance.mark_self','attendance.view','leave.view','leave.apply','asset.view',
      'expense.view','helpdesk.view','employee.document.view',
      'asset.create','asset.update','asset.assign','asset.return','asset.repair',
      'reports.view','reports.export'
    ))
    or
    (r.code = 'LOCATION_ADMIN' and p.code in (
      'attendance.mark_self','attendance.view','leave.view','leave.apply','asset.view',
      'expense.view','helpdesk.view','employee.document.view',
      'attendance.adjust','attendance.approve','leave.approve','reports.view'
    ))
    or
    (r.code = 'MANAGER' and p.code in (
      'attendance.mark_self','attendance.view','leave.view','leave.apply','asset.view',
      'expense.view','helpdesk.view','employee.document.view',
      'attendance.approve','leave.approve','reports.view','expense.approve',
      'performance.view','performance.manage'
    ))
    or
    (r.code = 'EMPLOYEE' and p.code in (
      'attendance.mark_self','attendance.view','leave.view','leave.apply','asset.view',
      'expense.view','helpdesk.view','employee.document.view'
    ))
  )
on conflict (role_id, permission_id) do nothing;

-- Ensure legacy alias roles resolve cleanly: map ADMIN/FINANCE/HR to the
-- canonical system roles if any rows still use them (they will after the
-- role-normalisation job). We only grant here so audit trails stay consistent.
insert into public.roles (id, company_id, code, name, is_system) values
  (gen_random_uuid(), null, 'ADMIN',  'Admin (legacy)',  true),
  (gen_random_uuid(), null, 'FINANCE','Finance (legacy)',true),
  (gen_random_uuid(), null, 'HR',     'HR (legacy)',     true)
on conflict (company_id, code) do nothing;

insert into public.role_permissions (role_id, permission_id)
select r.id, p.id
from public.roles r
cross join public.permissions p
where r.company_id is null and r.code in ('ADMIN','FINANCE','HR')
  and (
    (r.code = 'ADMIN' and p.code in (select code from public.permissions)) -- ADMIN == SUPER_ADMIN
    or
    (r.code = 'FINANCE' and p.code in (
      'attendance.mark_self','attendance.view','leave.view','leave.apply','asset.view',
      'expense.view','helpdesk.view','employee.document.view',
      'employee.salary.view','employee.salary.manage','employee.bank.view',
      'payroll.view','payroll.create','payroll.calculate','payroll.approve','payroll.lock',
      'payslip.view_all','reports.view','reports.export','expense.approve'
    ))
    or
    (r.code = 'HR' and p.code in (
      'attendance.mark_self','attendance.view','leave.view','leave.apply','asset.view',
      'expense.view','helpdesk.view','employee.document.view',
      'employee.create','employee.update','employee.offboard','employee.document.manage',
      'resignation.manage','attendance.adjust','attendance.approve','attendance.close',
      'leave.approve','leave.balance.manage','payroll.view','reports.view','reports.export',
      'expense.approve','performance.view','performance.manage','helpdesk.manage',
      'organisation.manage'
    ))
  )
on conflict (role_id, permission_id) do nothing;

select 'Migration 34 completed' as status;
