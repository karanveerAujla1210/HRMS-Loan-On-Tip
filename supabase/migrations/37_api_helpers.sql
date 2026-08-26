-- ==============================================================================
-- MIGRATION 37: API helper functions
--
-- Small, SECURITY DEFINER helpers the Next.js API calls to keep id generation
-- and a couple of atomic operations inside the database.
-- ==============================================================================

create or replace function public.next_asset_code(p_prefix text)
returns text language sql volatile as $$
  select upper(p_prefix) || '-' || lpad(nextval('public.asset_code_seq')::text, 4, '0');
$$;

-- Prevents two employees being flagged as the current manager simultaneously,
-- and keeps employee_manager_history tidy when a manager changes.
create or replace function public.set_employee_manager(
  p_employee_id uuid,
  p_manager_id  uuid,
  p_changed_by uuid default null
) returns void language plpgsql as $$
begin
  update public.employee_manager_history
    set is_current = false, effective_to = current_date
    where employee_id = p_employee_id and is_current = true;

  insert into public.employee_manager_history
    (employee_id, manager_id, effective_from, is_current, changed_by)
  values (p_employee_id, p_manager_id, current_date, true, p_changed_by);
end;
$$;
