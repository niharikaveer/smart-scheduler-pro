
-- Roles enum
create type public.app_role as enum ('admin', 'staff', 'student');
create type public.booking_status as enum ('pending', 'approved', 'rejected', 'cancelled', 'completed');

-- Profiles
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text,
  email text,
  created_at timestamptz not null default now()
);
alter table public.profiles enable row level security;

-- User roles
create table public.user_roles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  role app_role not null default 'student',
  unique(user_id, role)
);
alter table public.user_roles enable row level security;

-- has_role function
create or replace function public.has_role(_user_id uuid, _role app_role)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.user_roles where user_id = _user_id and role = _role)
$$;

-- get role priority (lower = higher priority)
create or replace function public.role_priority(_user_id uuid)
returns int language sql stable security definer set search_path = public as $$
  select coalesce(min(case role
    when 'admin' then 1
    when 'staff' then 2
    when 'student' then 3
  end), 3) from public.user_roles where user_id = _user_id;
$$;

-- Assets
create table public.assets (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text,
  category text not null default 'general',
  location text,
  image_url text,
  is_active boolean not null default true,
  auto_approve_role app_role default 'admin',
  created_at timestamptz not null default now()
);
alter table public.assets enable row level security;

-- Bookings
create table public.bookings (
  id uuid primary key default gen_random_uuid(),
  asset_id uuid not null references public.assets(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  start_time timestamptz not null,
  end_time timestamptz not null,
  status booking_status not null default 'pending',
  priority int not null default 3,
  purpose text,
  created_at timestamptz not null default now(),
  check (end_time > start_time)
);
alter table public.bookings enable row level security;
create index idx_bookings_asset_time on public.bookings(asset_id, start_time, end_time);

-- Waiting list
create table public.waiting_list (
  id uuid primary key default gen_random_uuid(),
  asset_id uuid not null references public.assets(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  desired_start timestamptz not null,
  desired_end timestamptz not null,
  priority int not null default 3,
  notified boolean not null default false,
  created_at timestamptz not null default now()
);
alter table public.waiting_list enable row level security;

-- Profile auto-create
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles(id, full_name, email)
  values (new.id, coalesce(new.raw_user_meta_data->>'full_name', new.email), new.email);
  insert into public.user_roles(user_id, role) values (new.id, 'student');
  return new;
end; $$;

create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_user();

-- Booking validation: conflict + auto-approve
create or replace function public.process_booking()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_priority int;
  v_conflict_id uuid;
  v_conflict_priority int;
  v_auto_role app_role;
begin
  -- set priority from user role
  v_priority := public.role_priority(new.user_id);
  new.priority := v_priority;

  -- find approved conflicts
  select id, priority into v_conflict_id, v_conflict_priority
  from public.bookings
  where asset_id = new.asset_id
    and id <> coalesce(new.id, '00000000-0000-0000-0000-000000000000'::uuid)
    and status = 'approved'
    and start_time < new.end_time
    and end_time > new.start_time
  limit 1;

  if v_conflict_id is not null then
    -- conflict with approved: reject this one (suggest waiting list via app)
    new.status := 'rejected';
    return new;
  end if;

  -- auto-approve based on asset rule
  select auto_approve_role into v_auto_role from public.assets where id = new.asset_id;
  if v_auto_role is not null and public.has_role(new.user_id, v_auto_role) then
    new.status := 'approved';
  end if;

  -- admins always auto-approved
  if public.has_role(new.user_id, 'admin') then
    new.status := 'approved';
  end if;

  return new;
end; $$;

create trigger trg_process_booking
before insert on public.bookings
for each row execute function public.process_booking();

-- RLS Policies
create policy "view own profile" on public.profiles for select using (auth.uid() = id);
create policy "admins view all profiles" on public.profiles for select using (public.has_role(auth.uid(), 'admin'));
create policy "update own profile" on public.profiles for update using (auth.uid() = id);

create policy "view own roles" on public.user_roles for select using (auth.uid() = user_id);
create policy "admins manage roles" on public.user_roles for all using (public.has_role(auth.uid(), 'admin'));

create policy "anyone authed views assets" on public.assets for select to authenticated using (true);
create policy "admins manage assets" on public.assets for all using (public.has_role(auth.uid(), 'admin'));

create policy "view own bookings" on public.bookings for select using (auth.uid() = user_id);
create policy "admins view all bookings" on public.bookings for select using (public.has_role(auth.uid(), 'admin'));
create policy "staff view all bookings" on public.bookings for select using (public.has_role(auth.uid(), 'staff'));
create policy "create own booking" on public.bookings for insert with check (auth.uid() = user_id);
create policy "cancel own booking" on public.bookings for update using (auth.uid() = user_id);
create policy "admins update bookings" on public.bookings for update using (public.has_role(auth.uid(), 'admin'));
create policy "admins delete bookings" on public.bookings for delete using (public.has_role(auth.uid(), 'admin'));

create policy "view own waiting" on public.waiting_list for select using (auth.uid() = user_id);
create policy "admins view waiting" on public.waiting_list for select using (public.has_role(auth.uid(), 'admin'));
create policy "create own waiting" on public.waiting_list for insert with check (auth.uid() = user_id);
create policy "delete own waiting" on public.waiting_list for delete using (auth.uid() = user_id);
