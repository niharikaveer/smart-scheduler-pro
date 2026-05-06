-- Prevent exact duplicate active slots on the same asset
create unique index if not exists uniq_asset_exact_active_slot
  on public.bookings(asset_id, start_time, end_time)
  where status in ('pending', 'approved');

-- Harden booking processing for overlap + maintenance checks
create or replace function public.process_booking()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_priority int;
  v_conflict_id uuid;
  v_auto_role app_role;
  v_status asset_status;
begin
  if new.end_time <= new.start_time then
    raise exception 'End time must be after start time';
  end if;

  select status into v_status
    from public.assets
   where id = new.asset_id;

  if v_status in ('under_maintenance', 'retired') then
    raise exception 'Asset is % and cannot be booked', v_status;
  end if;

  v_priority := public.role_priority(new.user_id);
  new.priority := v_priority;

  -- Reject overlap with any active booking (pending/approved)
  select id into v_conflict_id
    from public.bookings
   where asset_id = new.asset_id
     and id <> coalesce(new.id, '00000000-0000-0000-0000-000000000000'::uuid)
     and status in ('approved', 'pending')
     and start_time < new.end_time
     and end_time > new.start_time
   limit 1;

  if v_conflict_id is not null then
    new.status := 'rejected';
    return new;
  end if;

  select auto_approve_role into v_auto_role from public.assets where id = new.asset_id;
  if v_auto_role is not null and public.has_role(new.user_id, v_auto_role) then
    new.status := 'approved';
  end if;

  if public.has_role(new.user_id, 'admin') then
    new.status := 'approved';
  end if;

  return new;
end $$;
