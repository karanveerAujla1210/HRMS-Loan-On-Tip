-- ==============================================================================
-- MIGRATION 38: Atomic leave approval
--
-- Replaces the multi-step approval in the API (insert approval, bump balance,
-- insert transaction, flip status) with a single atomic, idempotent function.
-- The status re-check happens inside the row lock so a retry after a partial
-- failure cannot double-count leave balance.
-- ==============================================================================

create or replace function public.apply_leave_approval(
  p_leave_request_id uuid,
  p_actor_id uuid,
  p_action text,
  p_comments text default null
) returns uuid language plpgsql as $$
declare
  v_leave record;
begin
  if p_action not in ('APPROVED', 'REJECTED') then
    raise exception 'HRMS:INVALID_ACTION:%', p_action;
  end if;

  select id, employee_id, leave_type_id, from_date, total_days, status
    into v_leave
    from public.leave_requests
   where id = p_leave_request_id
     for update;

  if not found then
    return null;
  end if;

  -- Idempotent: if already decided, do nothing further.
  if v_leave.status <> 'PENDING' then
    return v_leave.id;
  end if;

  insert into public.leave_approvals (leave_request_id, approver_id, action, comments)
  values (v_leave.id, p_actor_id, p_action, p_comments);

  if p_action = 'APPROVED' then
    insert into public.leave_balances (employee_id, leave_type_id, year, used)
    values (
      v_leave.employee_id,
      v_leave.leave_type_id,
      extract(year from v_leave.from_date)::smallint,
      v_leave.total_days
    )
    on conflict (employee_id, leave_type_id, year)
    do update set used = public.leave_balances.used + excluded.used, updated_at = now();

    insert into public.leave_transactions (
      employee_id, leave_type_id, transaction_type, quantity, reference_id, reason, transaction_date, created_by
    ) values (
      v_leave.employee_id, v_leave.leave_type_id, 'CONSUMPTION', v_leave.total_days,
      v_leave.id, 'Leave approved', v_leave.from_date, p_actor_id
    );
  end if;

  update public.leave_requests
     set status = p_action, updated_at = now()
   where id = v_leave.id;

  return v_leave.id;
end;
$$;

select 'Migration 38 completed' as status;
