-- Invite codes. A new account can attach one code before they rate a wine.
-- When they rate a tried bottle, both people get 30 days of Pro.
-- Months stack with no cap. A second account on a device that already
-- has a Decanti account does not qualify.
-- Paid subscribers bank the days and receive them when the subscription ends.

create schema if not exists private;

alter table public.profiles
  add column if not exists referral_code text,
  add column if not exists referred_by uuid references public.profiles (id) on delete set null,
  add column if not exists referral_status text,
  add column if not exists signup_device_id text,
  add column if not exists pro_until timestamptz,
  add column if not exists bonus_pro_days integer not null default 0,
  add column if not exists qualified_referral_count integer not null default 0;

alter table public.profiles
  drop constraint if exists profiles_referral_status_check;

alter table public.profiles
  add constraint profiles_referral_status_check
  check (
    referral_status is null
    or referral_status in ('pending', 'qualified', 'rejected')
  );

comment on column public.profiles.referral_code is
  'Public invite code. Share it; the new account enters it at signup.';
comment on column public.profiles.referred_by is
  'Set once, at account creation. Existing accounts cannot attach a code later.';
comment on column public.profiles.referral_status is
  'pending until the invited account rates a wine. qualified grants Pro. rejected is a device collision.';
comment on column public.profiles.signup_device_id is
  'Device id from the install that created the account. A second account on that device cannot qualify.';
comment on column public.profiles.pro_until is
  'Invite Pro is active until this time when is_pro is false.';
comment on column public.profiles.bonus_pro_days is
  'Invite days saved while a paid subscription is active. Applied when that subscription ends.';
comment on column public.profiles.qualified_referral_count is
  'Invites that ended in a new account rating a wine. Host badge reads this.';

create unique index if not exists profiles_referral_code_idx
  on public.profiles (referral_code);

create index if not exists profiles_referred_by_idx
  on public.profiles (referred_by)
  where referred_by is not null;

create table if not exists public.profile_devices (
  device_id text not null,
  user_id uuid not null references auth.users (id) on delete cascade,
  first_seen_at timestamptz not null default now(),
  primary key (device_id, user_id)
);

create index if not exists profile_devices_user_idx
  on public.profile_devices (user_id);

alter table public.profile_devices enable row level security;

drop policy if exists profile_devices_select on public.profile_devices;
create policy profile_devices_select on public.profile_devices
  for select to authenticated
  using (auth.uid() = user_id);

-- Signed-in updates cannot grant Pro or rewrite invite state.
-- security definer functions set decanti.profile_guard = off for one transaction.
-- Service role and the SQL editor have no auth.uid() and may still update these columns.

create or replace function private.protect_profile_entitlements()
returns trigger
language plpgsql
as $$
begin
  if current_setting('decanti.profile_guard', true) = 'off' then
    return new;
  end if;
  if auth.uid() is null then
    return new;
  end if;

  new.is_pro := old.is_pro;
  new.pro_until := old.pro_until;
  new.bonus_pro_days := old.bonus_pro_days;
  new.referral_code := old.referral_code;
  new.referred_by := old.referred_by;
  new.referral_status := old.referral_status;
  new.signup_device_id := old.signup_device_id;
  new.qualified_referral_count := old.qualified_referral_count;
  new.progress_generation := old.progress_generation;
  new.progress_reset_at := old.progress_reset_at;
  return new;
end;
$$;

drop trigger if exists profiles_protect_entitlements on public.profiles;
create trigger profiles_protect_entitlements
  before update on public.profiles
  for each row execute function private.protect_profile_entitlements();

drop policy if exists profiles_update on public.profiles;
create policy profiles_update on public.profiles
  for update to authenticated
  using (auth.uid() = id)
  with check (
    auth.uid() = id
    and is_pro is not distinct from (
      select p.is_pro from public.profiles p where p.id = auth.uid()
    )
    and pro_until is not distinct from (
      select p.pro_until from public.profiles p where p.id = auth.uid()
    )
    and bonus_pro_days is not distinct from (
      select p.bonus_pro_days from public.profiles p where p.id = auth.uid()
    )
    and referral_code is not distinct from (
      select p.referral_code from public.profiles p where p.id = auth.uid()
    )
    and referred_by is not distinct from (
      select p.referred_by from public.profiles p where p.id = auth.uid()
    )
    and referral_status is not distinct from (
      select p.referral_status from public.profiles p where p.id = auth.uid()
    )
    and signup_device_id is not distinct from (
      select p.signup_device_id from public.profiles p where p.id = auth.uid()
    )
    and qualified_referral_count is not distinct from (
      select p.qualified_referral_count from public.profiles p where p.id = auth.uid()
    )
    and progress_generation is not distinct from (
      select p.progress_generation from public.profiles p where p.id = auth.uid()
    )
    and progress_reset_at is not distinct from (
      select p.progress_reset_at from public.profiles p where p.id = auth.uid()
    )
  );

create or replace function private.generate_referral_code()
returns text
language plpgsql
set search_path = public
as $$
declare
  alphabet constant text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  code text;
  i int;
begin
  loop
    code := '';
    for i in 1..8 loop
      code := code || substr(alphabet, 1 + floor(random() * length(alphabet))::int, 1);
    end loop;
    exit when not exists (
      select 1 from public.profiles where referral_code = code
    );
  end loop;
  return code;
end;
$$;

create or replace function private.assign_referral_code()
returns trigger
language plpgsql
as $$
begin
  if new.referral_code is null or btrim(new.referral_code) = '' then
    new.referral_code := private.generate_referral_code();
  end if;
  return new;
end;
$$;

drop trigger if exists profiles_assign_referral_code on public.profiles;
create trigger profiles_assign_referral_code
  before insert on public.profiles
  for each row execute function private.assign_referral_code();

do $$
declare
  profile_id uuid;
begin
  for profile_id in
    select id from public.profiles where referral_code is null
  loop
    update public.profiles
    set referral_code = private.generate_referral_code()
    where id = profile_id
      and referral_code is null;
  end loop;
end
$$;

alter table public.profiles
  alter column referral_code set not null;

create or replace function private.normalize_referral_code(raw text)
returns text
language sql
immutable
as $$
  select nullif(
    upper(regexp_replace(coalesce(raw, ''), '[^A-Za-z0-9]', '', 'g')),
    ''
  );
$$;

create or replace function private.referral_device_ok(raw text)
returns boolean
language sql
immutable
as $$
  select lower(btrim(coalesce(raw, ''))) ~
    '^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$';
$$;

-- 30 days, uncapped. Paid accounts bank the days instead of extending a clock
-- that would run out during the subscription.
create or replace function private.grant_referral_month(target uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  paying boolean;
begin
  perform set_config('decanti.profile_guard', 'off', true);

  select is_pro into paying
  from public.profiles
  where id = target
  for update;

  if not found then
    return;
  end if;

  if paying then
    update public.profiles
    set bonus_pro_days = bonus_pro_days + 30
    where id = target;
  else
    update public.profiles
    set pro_until = greatest(coalesce(pro_until, now()), now()) + interval '30 days'
    where id = target;
  end if;
end;
$$;

create or replace function private.apply_referral_qualification(target uuid)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  rec public.profiles%rowtype;
  qualified_id uuid;
  blocked boolean;
begin
  perform set_config('decanti.profile_guard', 'off', true);

  select * into rec
  from public.profiles
  where id = target
  for update;

  if not found then
    return 'missing';
  end if;

  if rec.referral_status is distinct from 'pending' or rec.referred_by is null then
    return 'skipped';
  end if;

  if rec.referred_by = target then
    update public.profiles
    set referral_status = 'rejected'
    where id = target;
    return 'rejected';
  end if;

  if rec.signup_device_id is null then
    return 'waiting_for_device';
  end if;

  select exists (
    select 1
    from public.profile_devices other
    where other.device_id = rec.signup_device_id
      and other.user_id <> target
  ) into blocked;

  if blocked then
    update public.profiles
    set referral_status = 'rejected'
    where id = target;
    return 'rejected';
  end if;

  if not exists (
    select 1
    from public.wines w
    where w.user_id = target
      and w.status = 'tried'
      and w.rating > 0
  ) then
    return 'waiting_for_rating';
  end if;

  update public.profiles
  set referral_status = 'qualified'
  where id = target
    and referral_status = 'pending'
  returning id into qualified_id;

  if qualified_id is null then
    return 'skipped';
  end if;

  perform private.grant_referral_month(target);
  perform private.grant_referral_month(rec.referred_by);

  update public.profiles
  set qualified_referral_count = qualified_referral_count + 1
  where id = rec.referred_by;

  begin
    if to_regclass('public.friendships') is not null then
      if exists (
        select 1
        from public.friendships f
        where (f.requester_id = rec.referred_by and f.addressee_id = target)
           or (f.requester_id = target and f.addressee_id = rec.referred_by)
      ) then
        update public.friendships
        set status = 'accepted'
        where (
          (requester_id = rec.referred_by and addressee_id = target)
          or (requester_id = target and addressee_id = rec.referred_by)
        )
          and status is distinct from 'accepted';
      elsif to_regclass('public.user_blocks') is null or not exists (
        select 1
        from public.user_blocks b
        where (b.blocker_id = rec.referred_by and b.blocked_id = target)
           or (b.blocker_id = target and b.blocked_id = rec.referred_by)
      ) then
        insert into public.friendships (requester_id, addressee_id, status)
        values (rec.referred_by, target, 'accepted');
      end if;
    end if;

    if to_regclass('public.notifications') is not null then
      insert into public.notifications (recipient_id, actor_id, type, payload)
      values
        (
          rec.referred_by,
          target,
          'referral_qualified',
          jsonb_build_object('role', 'referrer')
        ),
        (
          target,
          rec.referred_by,
          'referral_qualified',
          jsonb_build_object('role', 'invited')
        );
    end if;
  exception
    when others then
      raise warning 'referral side effects failed: %', sqlerrm;
  end;

  return 'qualified';
end;
$$;

create or replace function private.qualify_referral_from_wine()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.user_id is null then
    return new;
  end if;
  if new.status is distinct from 'tried' or coalesce(new.rating, 0) <= 0 then
    return new;
  end if;
  perform private.apply_referral_qualification(new.user_id);
  return new;
end;
$$;

drop trigger if exists wines_qualify_referral on public.wines;
create trigger wines_qualify_referral
  after insert or update of status, rating on public.wines
  for each row execute function private.qualify_referral_from_wine();

create or replace function public.register_my_device(device_id text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  cleaned text := lower(btrim(coalesce(device_id, '')));
begin
  if uid is null then
    raise exception 'Sign in required.';
  end if;
  if not private.referral_device_ok(cleaned) then
    raise exception 'Invalid device.';
  end if;

  perform set_config('decanti.profile_guard', 'off', true);

  insert into public.profile_devices (device_id, user_id)
  values (cleaned, uid)
  on conflict (device_id, user_id) do nothing;

  update public.profiles
  set signup_device_id = cleaned
  where id = uid
    and signup_device_id is null;
end;
$$;

create or replace function public.attach_referral_code(code text)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  cleaned text;
  me public.profiles%rowtype;
  referrer uuid;
begin
  if uid is null then
    raise exception 'Sign in required.';
  end if;

  cleaned := private.normalize_referral_code(code);
  if cleaned is null or length(cleaned) < 6 or length(cleaned) > 12 then
    return 'invalid';
  end if;

  perform set_config('decanti.profile_guard', 'off', true);

  select * into me
  from public.profiles
  where id = uid
  for update;

  if not found then
    return 'invalid';
  end if;

  if me.referred_by is not null or me.referral_status is not null then
    return 'already_set';
  end if;

  if me.created_at < now() - interval '7 days' then
    return 'closed';
  end if;

  if exists (
    select 1
    from public.wines w
    where w.user_id = uid
      and w.status = 'tried'
      and w.rating > 0
  ) then
    return 'closed';
  end if;

  select p.id into referrer
  from public.profiles p
  where p.referral_code = cleaned
  limit 1;

  if referrer is null or referrer = uid then
    return 'invalid';
  end if;

  update public.profiles
  set referred_by = referrer,
      referral_status = 'pending'
  where id = uid;

  return 'attached';
end;
$$;

create or replace function public.retry_referral_qualification()
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
begin
  if uid is null then
    raise exception 'Sign in required.';
  end if;
  return private.apply_referral_qualification(uid);
end;
$$;

revoke all on function private.generate_referral_code() from public, anon, authenticated;
revoke all on function private.grant_referral_month(uuid) from public, anon, authenticated;
revoke all on function private.apply_referral_qualification(uuid) from public, anon, authenticated;

revoke all on function public.register_my_device(text) from public;
revoke all on function public.attach_referral_code(text) from public;
revoke all on function public.retry_referral_qualification() from public;
grant execute on function public.register_my_device(text) to authenticated;
grant execute on function public.attach_referral_code(text) to authenticated;
grant execute on function public.retry_referral_qualification() to authenticated;

grant execute on function private.qualify_referral_from_wine() to authenticated;

create or replace function private.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  meta_name text := coalesce(
    nullif(trim(new.raw_user_meta_data->>'display_name'), ''),
    nullif(trim(new.raw_user_meta_data->>'full_name'), ''),
    nullif(trim(new.raw_user_meta_data->>'name'), '')
  );
  meta_avatar text := coalesce(
    nullif(trim(new.raw_user_meta_data->>'avatar_url'), ''),
    nullif(trim(new.raw_user_meta_data->>'picture'), '')
  );
  email_name text := nullif(split_part(coalesce(new.email, ''), '@', 1), '');
  raw_code text := private.normalize_referral_code(new.raw_user_meta_data->>'referral_code');
  raw_device text := lower(btrim(coalesce(new.raw_user_meta_data->>'device_id', '')));
  referrer uuid;
begin
  if raw_code is not null and length(raw_code) between 6 and 12 then
    select p.id into referrer
    from public.profiles p
    where p.referral_code = raw_code
    limit 1;
  end if;

  insert into public.profiles (
    id,
    display_name,
    email,
    avatar_url,
    referred_by,
    referral_status,
    signup_device_id
  )
  values (
    new.id,
    coalesce(meta_name, email_name, 'Wine lover'),
    coalesce(new.email, ''),
    meta_avatar,
    referrer,
    case when referrer is not null then 'pending' else null end,
    case when private.referral_device_ok(raw_device) then raw_device else null end
  );

  if private.referral_device_ok(raw_device) then
    insert into public.profile_devices (device_id, user_id)
    values (raw_device, new.id)
    on conflict (device_id, user_id) do nothing;
  end if;

  return new;
end;
$$;

alter table public.notifications drop constraint if exists notifications_type_check;

alter table public.notifications add constraint notifications_type_check
  check (type in (
    'reaction',
    'friend_request',
    'friend_accepted',
    'friend_badge_unlock',
    'friend_journey_complete',
    'wine_with_friend',
    'referral_qualified'
  ));
