-- 12_roles_permissions.sql

create table public.roles (
  id          uuid primary key default gen_random_uuid(),
  company_id  uuid references public.companies on delete cascade,  -- null = system role
  code        varchar(50)  not null,
  name        varchar(100) not null,
  description text,
  is_system   boolean      not null default false,
  is_active   boolean      not null default true,
  created_at  timestamptz  not null default now(),
  unique (company_id, code)
);

create table public.permissions (
  id          uuid primary key default gen_random_uuid(),
  code        varchar(100) not null unique,
  name        varchar(100) not null,
  module      varchar(50)  not null,
  description text,
  created_at  timestamptz  not null default now()
);

create table public.role_permissions (
  id            uuid primary key default gen_random_uuid(),
  role_id       uuid not null references public.roles       on delete cascade,
  permission_id uuid not null references public.permissions on delete cascade,
  created_at    timestamptz not null default now(),
  unique (role_id, permission_id)
);

create table public.employee_roles (
  id             uuid primary key default gen_random_uuid(),
  employee_id    uuid not null references public.employees on delete cascade,
  role_id        uuid not null references public.roles     on delete cascade,
  company_id     uuid not null references public.companies on delete cascade,
  location_id    uuid references public.locations          on delete set null,
  effective_from date         not null,
  effective_to   date,
  is_active      boolean      not null default true,
  assigned_by    uuid references public.employees on delete set null,
  created_at     timestamptz  not null default now()
);

-- ── Seed system roles ─────────────────────────────────────────────────────────
insert into public.roles (id, company_id, code, name, is_system) values
  (gen_random_uuid(), null, 'SUPER_ADMIN',      'Super Admin',      true),
  (gen_random_uuid(), null, 'HR_ADMIN',         'HR Admin',         true),
  (gen_random_uuid(), null, 'FINANCE_ADMIN',    'Finance Admin',    true),
  (gen_random_uuid(), null, 'OPERATIONS_ADMIN', 'Operations Admin', true),
  (gen_random_uuid(), null, 'LOCATION_ADMIN',   'Location Admin',   true),
  (gen_random_uuid(), null, 'MANAGER',          'Manager',          true),
  (gen_random_uuid(), null, 'EMPLOYEE',         'Employee',         true);

-- ── Seed permissions ──────────────────────────────────────────────────────────
insert into public.permissions (code, name, module) values
  ('employee.view',       'View Employees',        'PEOPLE'),
  ('employee.create',     'Create Employee',       'PEOPLE'),
  ('employee.update',     'Update Employee',       'PEOPLE'),
  ('employee.delete',     'Delete Employee',       'PEOPLE'),
  ('attendance.view',     'View Attendance',       'ATTENDANCE'),
  ('attendance.adjust',   'Adjust Attendance',     'ATTENDANCE'),
  ('attendance.approve',  'Approve Attendance',    'ATTENDANCE'),
  ('leave.view',          'View Leaves',           'LEAVE'),
  ('leave.apply',         'Apply Leave',           'LEAVE'),
  ('leave.approve',       'Approve Leave',         'LEAVE'),
  ('payroll.view',        'View Payroll',          'PAYROLL'),
  ('payroll.create',      'Create Payroll',        'PAYROLL'),
  ('payroll.approve',     'Approve Payroll',       'PAYROLL'),
  ('asset.view',          'View Assets',           'ASSETS'),
  ('asset.create',        'Create Asset',          'ASSETS'),
  ('asset.assign',        'Assign Asset',          'ASSETS'),
  ('asset.return',        'Return Asset',          'ASSETS'),
  ('reports.view',        'View Reports',          'REPORTS'),
  ('audit.view',          'View Audit Logs',       'SYSTEM'),
  ('settings.manage',     'Manage Settings',       'SYSTEM');
