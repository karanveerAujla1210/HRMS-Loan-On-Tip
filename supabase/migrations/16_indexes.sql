-- 16_indexes.sql

-- ── Attendance ────────────────────────────────────────────────────────────────
create index idx_attendance_emp_date    on public.attendance (employee_id, attendance_date desc);
create index idx_attendance_company     on public.attendance (company_id,  attendance_date desc);
create index idx_attendance_location    on public.attendance (location_id, attendance_date desc);
create index idx_attendance_status      on public.attendance (status,      attendance_date);
create index idx_attendance_events_att  on public.attendance_events (attendance_id, event_at desc);
create index idx_attendance_exc_emp     on public.attendance_exceptions (employee_id, status);

-- ── Leave ─────────────────────────────────────────────────────────────────────
create index idx_leave_req_emp_date     on public.leave_requests (employee_id, from_date desc);
create index idx_leave_req_status       on public.leave_requests (status, from_date);
create index idx_leave_balance_emp_year on public.leave_balances (employee_id, year);

-- ── Payroll ───────────────────────────────────────────────────────────────────
create index idx_payroll_item_emp       on public.payroll_items (employee_id, payroll_run_id);
create index idx_payroll_item_run       on public.payroll_items (payroll_run_id, status);
create index idx_payslip_emp            on public.payslips (employee_id, payroll_run_id);

-- ── Assets ────────────────────────────────────────────────────────────────────
create index idx_asset_company_status   on public.assets (company_id, status);
create index idx_asset_current_emp      on public.assets (current_employee_id);
create index idx_asset_serial           on public.assets (serial_number) where serial_number is not null;
create index idx_asset_imei1            on public.assets (imei_1)        where imei_1 is not null;
create index idx_asset_mobile           on public.assets (mobile_number) where mobile_number is not null;

-- ── Employees ─────────────────────────────────────────────────────────────────
create index idx_employee_company       on public.employees (company_id, employment_status);
create index idx_employee_manager       on public.employees (manager_id);
create index idx_employee_location      on public.employees (location_id);
create index idx_employee_name_trgm     on public.employees using gin (display_name gin_trgm_ops);

-- ── Audit ─────────────────────────────────────────────────────────────────────
create index idx_audit_company_time     on public.audit_logs (company_id, created_at desc);
create index idx_audit_actor_time       on public.audit_logs (actor_employee_id, created_at desc);
create index idx_audit_entity           on public.audit_logs (entity_type, entity_id);

-- ── Notifications ─────────────────────────────────────────────────────────────
create index idx_notif_recipient        on public.notifications (recipient_employee_id, created_at desc);
create index idx_notif_unread           on public.notifications (recipient_employee_id) where read_at is null;

-- ── Idempotency ───────────────────────────────────────────────────────────────
create index idx_idempotency_expires    on public.idempotency_keys (expires_at);
