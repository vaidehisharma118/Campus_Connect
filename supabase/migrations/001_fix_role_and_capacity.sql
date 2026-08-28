-- ============================================================
--Stop users from self-assigning role = 'admin'
-- ============================================================
-- Even with the role dropdown removed from the UI, anyone can still
-- call supabase.from("profiles").insert({..., role: "admin"}) directly
-- via the client SDK. The only real fix is a DB-level rule.
--
-- This trigger forces role to 'student' on any row a user inserts
-- into their OWN profile, no matter what the client sends. Granting
-- admin becomes a manual/trusted operation (e.g. run directly in the
-- SQL editor, or via a service-role script) rather than something the
-- public API can ever produce.

create or replace function public.enforce_default_role()
returns trigger
language plpgsql
security definer
as $$
begin
  if new.id = auth.uid() then
    new.role := 'student';
  end if;
  return new;
end;
$$;

drop trigger if exists trg_enforce_default_role on public.profiles;

create trigger trg_enforce_default_role
before insert on public.profiles
for each row
execute function public.enforce_default_role();

-- Make sure RLS is on and users can only insert/read their own profile
-- (adjust if you already have equivalent policies).
alter table public.profiles enable row level security;

drop policy if exists "Users can insert own profile" on public.profiles;
create policy "Users can insert own profile"
  on public.profiles for insert
  with check (auth.uid() = id);

drop policy if exists "Users can read profiles" on public.profiles;
create policy "Users can read profiles"
  on public.profiles for select
  using (true);

-- ============================================================
-- Atomic event registration (no more overbooking race)
-- ============================================================
-- Old flow: client reads registrations count, compares to capacity,
-- THEN inserts. Two concurrent requests can both pass the check
-- before either insert lands.
--
-- New flow: a single Postgres function does the count-check-and-insert
-- inside one transaction, with the events row locked (FOR UPDATE) so
-- concurrent calls for the same event queue up instead of racing.

create or replace function public.register_for_event(p_event_id uuid, p_user_id uuid)
returns void
language plpgsql
security definer
as $$
declare
  v_capacity int;
  v_count int;
begin
  -- Lock the event row so a second concurrent call has to wait here
  -- until this transaction commits or rolls back.
  select capacity into v_capacity
  from public.events
  where id = p_event_id
  for update;

  if v_capacity is null then
    raise exception 'Event not found';
  end if;

  select count(*) into v_count
  from public.event_registrations
  where event_id = p_event_id;

  if v_count >= v_capacity then
    raise exception 'Event is full';
  end if;

  insert into public.event_registrations (event_id, user_id)
  values (p_event_id, p_user_id)
  on conflict do nothing;
end;
$$;

grant execute on function public.register_for_event(uuid, uuid) to authenticated;

-- ============================================================
--  Promote an existing student to admin (admin-only action)
-- ============================================================
-- Only an existing admin can promote someone else. The function checks
-- the CALLER's own role (auth.uid()) server-side before touching the
-- target row -- a student calling this directly, even by guessing the
-- RPC name, gets rejected. This is the same "never trust the client,
-- re-check on the server" pattern as register_for_event above.

create or replace function public.promote_to_admin(p_target_id uuid)
returns void
language plpgsql
security definer
as $$
declare
  v_caller_role text;
begin
  select role into v_caller_role
  from public.profiles
  where id = auth.uid();

  if v_caller_role is distinct from 'admin' then
    raise exception 'Only admins can promote other users';
  end if;

  update public.profiles
  set role = 'admin'
  where id = p_target_id;
end;
$$;

grant execute on function public.promote_to_admin(uuid) to authenticated;

