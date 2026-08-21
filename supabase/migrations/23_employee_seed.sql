-- ================================================================
-- LOAN ON TIP HRMS  –  EMPLOYEE SEED
-- Run in: Supabase Dashboard → SQL Editor → Run
-- ================================================================

BEGIN;

-- ----------------------------------------------------------------
-- 00. MAKE joining_date NULLABLE (if not already)
-- ----------------------------------------------------------------
ALTER TABLE public.employees
    ALTER COLUMN joining_date DROP NOT NULL;

-- ----------------------------------------------------------------
-- 01. COMPANY
-- ----------------------------------------------------------------
INSERT INTO public.companies (
    id, company_code, legal_name, display_name, timezone, currency, is_active
) VALUES (
    '00000000-0000-0000-0000-000000000001',
    'LOT', 'ACG Leasing Limited', 'Loan On Tip', 'Asia/Kolkata', 'INR', true
)
ON CONFLICT (company_code) DO UPDATE SET
    legal_name   = EXCLUDED.legal_name,
    display_name = EXCLUDED.display_name,
    timezone     = EXCLUDED.timezone,
    currency     = EXCLUDED.currency,
    is_active    = true,
    updated_at   = now();

-- ----------------------------------------------------------------
-- 02. DELHI HEAD OFFICE
-- ----------------------------------------------------------------
INSERT INTO public.locations (
    id, company_id, location_code, name, location_type,
    city, state, attendance_radius_meters, timezone, is_active
) VALUES (
    '11111111-0000-0000-0000-000000000001',
    '00000000-0000-0000-0000-000000000001',
    'DEL-HO', 'Delhi Head Office', 'HEAD_OFFICE',
    'Delhi', 'Delhi', 150, 'Asia/Kolkata', true
)
ON CONFLICT (company_id, location_code) DO UPDATE SET
    name                     = EXCLUDED.name,
    location_type            = EXCLUDED.location_type,
    city                     = EXCLUDED.city,
    state                    = EXCLUDED.state,
    attendance_radius_meters = EXCLUDED.attendance_radius_meters,
    timezone                 = EXCLUDED.timezone,
    is_active                = true,
    updated_at               = now();

-- ----------------------------------------------------------------
-- 03. DEPARTMENTS
-- ----------------------------------------------------------------
INSERT INTO public.departments (company_id, department_code, name, is_active)
VALUES
    ('00000000-0000-0000-0000-000000000001', 'MANAGEMENT', 'Management',      true),
    ('00000000-0000-0000-0000-000000000001', 'ACCOUNTS',   'Accounts',        true),
    ('00000000-0000-0000-0000-000000000001', 'COLLECTION', 'Collection',      true),
    ('00000000-0000-0000-0000-000000000001', 'CREDIT',     'Credit',          true),
    ('00000000-0000-0000-0000-000000000001', 'OPERATIONS', 'Operations',      true),
    ('00000000-0000-0000-0000-000000000001', 'HR',         'Human Resources', true),
    ('00000000-0000-0000-0000-000000000001', 'SALES',      'Sales',           true),
    ('00000000-0000-0000-0000-000000000001', 'FINANCE',    'Finance',         true),
    ('00000000-0000-0000-0000-000000000001', 'TECHNOLOGY', 'Technology',      true)
ON CONFLICT (company_id, department_code) DO UPDATE SET
    name      = EXCLUDED.name,
    is_active = true,
    updated_at = now();

-- ----------------------------------------------------------------
-- 04. DESIGNATIONS
-- ----------------------------------------------------------------
INSERT INTO public.designations (company_id, designation_code, name, level, is_active)
VALUES
    ('00000000-0000-0000-0000-000000000001', 'CEO',                'CEO',                 10, true),
    ('00000000-0000-0000-0000-000000000001', 'ACCOUNTS_EXEC',      'Accounts Executive',   2, true),
    ('00000000-0000-0000-0000-000000000001', 'COLLECTION_MANAGER', 'Collection Manager',   5, true),
    ('00000000-0000-0000-0000-000000000001', 'COLLECTION_EXEC',    'Collection Executive', 2, true),
    ('00000000-0000-0000-0000-000000000001', 'COLLECTION_HEAD',    'Collection Head',      8, true),
    ('00000000-0000-0000-0000-000000000001', 'SCREENER',           'Screener',             2, true),
    ('00000000-0000-0000-0000-000000000001', 'CREDIT_HEAD',        'Credit Head',          8, true),
    ('00000000-0000-0000-0000-000000000001', 'CREDIT_MANAGER',     'Credit Manager',       5, true),
    ('00000000-0000-0000-0000-000000000001', 'OPERATIONAL_HEAD',   'Operational Head',     8, true)
ON CONFLICT (company_id, designation_code) DO UPDATE SET
    name      = EXCLUDED.name,
    level     = EXCLUDED.level,
    is_active = true,
    updated_at = now();

-- ----------------------------------------------------------------
-- 05. EMPLOYMENT TYPES
-- ----------------------------------------------------------------
INSERT INTO public.employment_types (company_id, code, name, description, is_active)
VALUES
    ('00000000-0000-0000-0000-000000000001', 'FULL_TIME', 'Full Time', 'Regular full-time employee', true),
    ('00000000-0000-0000-0000-000000000001', 'CONTRACT',  'Contract',  'Contract employee',          true),
    ('00000000-0000-0000-0000-000000000001', 'INTERN',    'Intern',    'Intern / trainee',           true)
ON CONFLICT (company_id, code) DO NOTHING;

-- ----------------------------------------------------------------
-- 06. GENERAL SHIFT
-- ----------------------------------------------------------------
INSERT INTO public.shifts (
    company_id, location_id, shift_code, name,
    start_time, end_time, break_minutes, grace_minutes,
    half_day_after_minutes, full_day_after_minutes,
    minimum_work_minutes, overtime_after_minutes,
    is_overnight, is_active
) VALUES (
    '00000000-0000-0000-0000-000000000001',
    '11111111-0000-0000-0000-000000000001',
    'GENERAL', 'General Shift',
    '09:30', '18:30', 60, 15, 240, 360, 240, 540, false, true
)
ON CONFLICT (company_id, shift_code) DO UPDATE SET
    start_time    = EXCLUDED.start_time,
    end_time      = EXCLUDED.end_time,
    grace_minutes = EXCLUDED.grace_minutes,
    is_active     = true,
    updated_at    = now();

-- ----------------------------------------------------------------
-- 07. EMPLOYEES  (EMP002 – EMP035)
-- Uses NOT EXISTS on employee_code to avoid the partial-index
-- ON CONFLICT limitation. Safe to re-run.
-- ----------------------------------------------------------------
INSERT INTO public.employees (
    company_id, employee_code,
    first_name, middle_name, last_name,
    employment_type_id, department_id, designation_id,
    location_id, employment_status,
    official_email, official_mobile
)
SELECT
    '00000000-0000-0000-0000-000000000001',
    v.employee_code,
    v.first_name, v.middle_name, v.last_name,
    et.id, d.id, dg.id,
    '11111111-0000-0000-0000-000000000001',
    v.employment_status::public.employment_status_enum,
    NULLIF(v.official_email, ''),
    NULLIF(v.official_mobile, '')
FROM (VALUES
    ('EMP002', 'ARJAN',        NULL, 'GANDHI',    'FULL_TIME', 'MANAGEMENT', 'CEO',                'ACTIVE',   'arjan.gandhi@loanontip.com',     ''),
    ('EMP003', 'ANKIT',        NULL, 'KUMAR',     'FULL_TIME', 'ACCOUNTS',   'ACCOUNTS_EXEC',      'ACTIVE',   'ankit.kumar@loanontip.com',       '9311720065'),
    ('EMP004', 'ANAND',        NULL, 'KUMAR',     'FULL_TIME', 'ACCOUNTS',   'ACCOUNTS_EXEC',      'ACTIVE',   'anand@loanontip.com',             '9311924271'),
    ('EMP005', 'ROSHINI',      NULL, '',          'FULL_TIME', 'COLLECTION', 'COLLECTION_MANAGER', 'ACTIVE',   'roshni@loanontip.com',            '9818703782'),
    ('EMP006', 'SITARA',       NULL, '',          'FULL_TIME', 'COLLECTION', 'COLLECTION_EXEC',    'INACTIVE', '',                               ''),
    ('EMP007', 'SURYANSHU',    NULL, '',          'FULL_TIME', 'COLLECTION', 'COLLECTION_EXEC',    'ACTIVE',   'suryanshu.mishra@loanontip.com',  '9217305685'),
    ('EMP008', 'SUJEET',       NULL, '',          'FULL_TIME', 'COLLECTION', 'COLLECTION_EXEC',    'ACTIVE',   'sujeet.pandey@loanontip.com',     '7303348649'),
    ('EMP009', 'JYOTI',        NULL, 'RANA',      'FULL_TIME', 'COLLECTION', 'COLLECTION_EXEC',    'ACTIVE',   'jyoti.rana@loanontip.com',        '9910238816'),
    ('EMP010', 'DEEPAK',       NULL, 'RAWAT',     'FULL_TIME', 'COLLECTION', 'COLLECTION_MANAGER', 'INACTIVE', '',                               ''),
    ('EMP011', 'SACHINA',      NULL, '',          'FULL_TIME', 'COLLECTION', 'COLLECTION_EXEC',    'ACTIVE',   'sachin@loanontip.com',            '9958062756'),
    ('EMP012', 'K',            NULL, 'PUSHPA',    'FULL_TIME', 'COLLECTION', 'COLLECTION_EXEC',    'ACTIVE',   'k.pushpa@loanontip.com',          '8796338477'),
    ('EMP013', 'ANANYA',       NULL, '',          'FULL_TIME', 'COLLECTION', 'COLLECTION_EXEC',    'ACTIVE',   'ananya@loanontip.com',            '9311914701'),
    ('EMP014', 'DEEPAK',       NULL, 'BHAGOTI',   'FULL_TIME', 'COLLECTION', 'COLLECTION_EXEC',    'ACTIVE',   '',                               ''),
    ('EMP015', 'SANGEETA',     NULL, '',          'FULL_TIME', 'COLLECTION', 'COLLECTION_MANAGER', 'ACTIVE',   '',                               ''),
    ('EMP016', 'CHAHAT',       NULL, 'CHOUDHARY', 'FULL_TIME', 'COLLECTION', 'COLLECTION_EXEC',    'ACTIVE',   'chahat.choudhary@loanontip.com',  '9311924266'),
    ('EMP017', 'POOJA',        NULL, 'NEGI',      'FULL_TIME', 'COLLECTION', 'COLLECTION_EXEC',    'ACTIVE',   'pooja.negi@loanontip.com',        '9818764032'),
    ('EMP018', 'PAWAN',        NULL, 'KUMAR',     'FULL_TIME', 'COLLECTION', 'COLLECTION_EXEC',    'ACTIVE',   '',                               ''),
    ('EMP019', 'RACHNA',       NULL, '',          'FULL_TIME', 'COLLECTION', '',                   'ACTIVE',   'rachna.singh@loanontip.com',      '8800209981'),
    ('EMP020', 'MOHIT',        NULL, '',          'FULL_TIME', 'COLLECTION', 'COLLECTION_EXEC',    'ACTIVE',   'mohit@loanontip.com',             '9560178464'),
    ('EMP021', 'MUDIT',        NULL, 'BHARDWAJ',  'FULL_TIME', 'COLLECTION', 'COLLECTION_HEAD',    'ACTIVE',   'mudit.bhardwaj@loanontip.com',    ''),
    ('EMP022', 'ANURADHA',     NULL, '',          'FULL_TIME', 'CREDIT',     'SCREENER',           'ACTIVE',   'anuradha@loanontip.com',          '7303348675'),
    ('EMP023', 'KISHAN',       NULL, 'KUMAR',     'FULL_TIME', 'CREDIT',     'CREDIT_HEAD',        'ACTIVE',   'kishan.kumar@loanontip.com',      '9599300421'),
    ('EMP024', 'TANVI',        NULL, '',          'FULL_TIME', 'CREDIT',     'SCREENER',           'ACTIVE',   'tanvi.singh@loanontip.com',       '8796338505'),
    ('EMP025', 'KAJAL',        NULL, '',          'FULL_TIME', 'CREDIT',     'SCREENER',           'INACTIVE', '',                               ''),
    ('EMP026', 'SHIVANI',      NULL, 'JOSHI',     'FULL_TIME', 'CREDIT',     'CREDIT_MANAGER',     'ACTIVE',   'shivani.joshi@loanontip.com',     '8796336190'),
    ('EMP027', 'DEEPAK',       NULL, 'KUMAR',     'FULL_TIME', 'CREDIT',     'CREDIT_MANAGER',     'ACTIVE',   'deepak.kumar@loanontip.com',      '9599279053'),
    ('EMP028', 'GARISHMA',     NULL, 'MALHOTRA',  'FULL_TIME', 'CREDIT',     'CREDIT_MANAGER',     'ACTIVE',   'garishma.malhotra@loanontip.com', '9311924275'),
    ('EMP029', 'POOJA',        NULL, '',          'FULL_TIME', 'CREDIT',     'CREDIT_MANAGER',     'ACTIVE',   'pooja@loanontip.com',             '9311924269'),
    ('EMP030', 'MEGHA',        NULL, 'SINGH',     'FULL_TIME', 'CREDIT',     'SCREENER',           'ACTIVE',   'megha.singh@loanontip.com',       '9311924273'),
    ('EMP031', 'TIA',          NULL, '',          'FULL_TIME', 'CREDIT',     'SCREENER',           'INACTIVE', '',                               ''),
    ('EMP032', 'RITIKA',       NULL, '',          'FULL_TIME', 'CREDIT',     'SCREENER',           'INACTIVE', '',                               ''),
    ('EMP033', 'TANNU',        NULL, 'SINGH',     'FULL_TIME', 'CREDIT',     'CREDIT_MANAGER',     'ACTIVE',   'tannu.singh@loanontip.com',       '9650507739'),
    ('EMP034', 'MUSKAN',       NULL, '',          'FULL_TIME', 'CREDIT',     'SCREENER',           'ACTIVE',   'muskan@loanontip.com',            '9217549595'),
    ('EMP035', 'NAVEEN KUMAR', NULL, 'BHILWARA',  'FULL_TIME', 'OPERATIONS', 'OPERATIONAL_HEAD',   'ACTIVE',   'naveen.bhilwara@loanontip.com',   '')
) AS v(employee_code, first_name, middle_name, last_name,
       et_code, dept_code, desig_code,
       employment_status, official_email, official_mobile)
JOIN public.employment_types et
    ON et.company_id = '00000000-0000-0000-0000-000000000001'
   AND et.code = v.et_code
JOIN public.departments d
    ON d.company_id = '00000000-0000-0000-0000-000000000001'
   AND d.department_code = v.dept_code
LEFT JOIN public.designations dg
    ON dg.company_id = '00000000-0000-0000-0000-000000000001'
   AND dg.designation_code = NULLIF(v.desig_code, '')
WHERE NOT EXISTS (
    SELECT 1 FROM public.employees ex
    WHERE ex.company_id    = '00000000-0000-0000-0000-000000000001'
      AND ex.employee_code = v.employee_code
)
AND (
    NULLIF(v.official_email, '') IS NULL
    OR NOT EXISTS (
        SELECT 1 FROM public.employees ex
        WHERE ex.official_email = NULLIF(v.official_email, '')
    )
);

-- ----------------------------------------------------------------
-- 08. ASSIGN GENERAL SHIFT (skip employees who already have one)
-- ----------------------------------------------------------------
INSERT INTO public.shift_assignments (employee_id, shift_id, effective_from, is_current)
SELECT e.id, s.id, CURRENT_DATE, true
FROM public.employees e
JOIN public.shifts s
    ON s.company_id = e.company_id
   AND s.shift_code = 'GENERAL'
WHERE e.company_id = '00000000-0000-0000-0000-000000000001'
  AND NOT EXISTS (
      SELECT 1 FROM public.shift_assignments sa
      WHERE sa.employee_id = e.id AND sa.is_current = true
  );

-- ----------------------------------------------------------------
-- 09. SUNDAY WEEKLY OFF
-- ----------------------------------------------------------------
INSERT INTO public.weekly_off_rules (
    company_id, location_id, day_of_week, week_number, is_off, effective_from
)
SELECT
    '00000000-0000-0000-0000-000000000001',
    '11111111-0000-0000-0000-000000000001',
    0, NULL, true, CURRENT_DATE
WHERE NOT EXISTS (
    SELECT 1 FROM public.weekly_off_rules
    WHERE company_id  = '00000000-0000-0000-0000-000000000001'
      AND location_id = '11111111-0000-0000-0000-000000000001'
      AND day_of_week = 0
);

-- ----------------------------------------------------------------
-- 10. LEAVE TYPES
-- ----------------------------------------------------------------
INSERT INTO public.leave_types (company_id, code, name, is_paid, requires_document, allows_half_day, is_active)
VALUES
    ('00000000-0000-0000-0000-000000000001', 'CL',  'Casual Leave',      true,  false, true,  true),
    ('00000000-0000-0000-0000-000000000001', 'SL',  'Sick Leave',        true,  false, true,  true),
    ('00000000-0000-0000-0000-000000000001', 'PL',  'Privilege Leave',   true,  false, false, true),
    ('00000000-0000-0000-0000-000000000001', 'LWP', 'Leave Without Pay', false, false, true,  true)
ON CONFLICT (company_id, code) DO NOTHING;

-- ----------------------------------------------------------------
-- 11. LEAVE BALANCES (current year)
-- ----------------------------------------------------------------
INSERT INTO public.leave_balances (
    employee_id, leave_type_id, year,
    opening_balance, accrued, used, adjusted, encashed
)
SELECT
    e.id, lt.id,
    EXTRACT(YEAR FROM CURRENT_DATE)::smallint,
    0,
    CASE lt.code WHEN 'CL' THEN 12 WHEN 'SL' THEN 12 WHEN 'PL' THEN 18 ELSE 0 END,
    0, 0, 0
FROM public.employees e
JOIN public.leave_types lt ON lt.company_id = e.company_id
WHERE e.company_id = '00000000-0000-0000-0000-000000000001'
ON CONFLICT (employee_id, leave_type_id, year) DO NOTHING;

-- ----------------------------------------------------------------
-- 12. SYSTEM SETTINGS
-- ----------------------------------------------------------------
INSERT INTO public.system_settings (company_id, setting_key, setting_value, data_type, description, is_public)
VALUES
    ('00000000-0000-0000-0000-000000000001', 'attendance.radius',           '150',    'INTEGER', 'Attendance geo-fence radius in metres', true),
    ('00000000-0000-0000-0000-000000000001', 'attendance.grace_minutes',    '15',     'INTEGER', 'Late attendance grace period',          true),
    ('00000000-0000-0000-0000-000000000001', 'attendance.office_start',     '09:30',  'TIME',    'Standard office start time',            true),
    ('00000000-0000-0000-0000-000000000001', 'attendance.office_end',       '18:30',  'TIME',    'Standard office end time',              true),
    ('00000000-0000-0000-0000-000000000001', 'attendance.default_location', 'DEL-HO', 'STRING',  'Default attendance location',           true)
ON CONFLICT (company_id, setting_key) DO UPDATE SET
    setting_value = EXCLUDED.setting_value,
    updated_at    = now();

COMMIT;

-- ----------------------------------------------------------------
-- VERIFICATION
-- ----------------------------------------------------------------
SELECT
    e.employee_code,
    e.display_name,
    e.official_email,
    e.official_mobile,
    e.employment_status,
    d.name  AS department,
    dg.name AS designation,
    l.name  AS location
FROM public.employees e
LEFT JOIN public.departments  d  ON d.id  = e.department_id
LEFT JOIN public.designations dg ON dg.id = e.designation_id
LEFT JOIN public.locations    l  ON l.id  = e.location_id
WHERE e.company_id = '00000000-0000-0000-0000-000000000001'
ORDER BY e.employee_code;
