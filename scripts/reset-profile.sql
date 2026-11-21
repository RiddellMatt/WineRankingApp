-- Install once in the Supabase SQL editor, then reset a profile with:
--
--   select * from private.reset_profile('you@example.com');
--
-- Pass true to leave friendships in place:
--
--   select * from private.reset_profile('you@example.com', true);
--
-- Wipes the cellar, the wishlist, badges, journeys, and points, plus activity,
-- reactions, notifications, scan history, blocks this profile created, and
-- reports it filed. Points are not a stored number: they are calculated from
-- tried bottles, badge tiers, and finished journeys, so those rows are removed
-- and the result includes cellar, wishlist, and points.
-- Keeps the login, display name, email, avatar, Pro, Stripe ids, and push tokens.
-- Not granted to anon or authenticated.
-- After a reset, the database rejects the phone's old cellar and old points
-- if the app tries to upload them again. Bottles and points added after the
-- reset are kept.

create schema if not exists private;

alter table public.profiles
  add column if not exists progress_generation bigint not null default 0;

alter table public.profiles
  add column if not exists progress_reset_at timestamptz;

alter table public.user_badge_tiers
  add column if not exists earned_generation bigint not null default 0;

alter table public.user_journey_completions
  add column if not exists earned_generation bigint not null default 0;

drop policy if exists profiles_update on public.profiles;
create policy profiles_update on public.profiles
  for update to authenticated
  using (auth.uid() = id)
  with check (
    auth.uid() = id
    and is_pro is not distinct from (
      select p.is_pro from public.profiles p where p.id = auth.uid()
    )
    and progress_generation is not distinct from (
      select p.progress_generation from public.profiles p where p.id = auth.uid()
    )
    and progress_reset_at is not distinct from (
      select p.progress_reset_at from public.profiles p where p.id = auth.uid()
    )
  );

create or replace function private.reject_restored_cellar()
returns trigger
language plpgsql
security definer
set search_path = public
as $cellar$
declare
  reset_at timestamptz;
begin
  select p.progress_reset_at into reset_at
  from public.profiles p
  where p.id = NEW.user_id;

  if reset_at is null then
    return NEW;
  end if;

  if NEW.added_at is null
     or to_timestamp(NEW.added_at / 1000.0) < reset_at - interval '15 minutes' then
    raise exception 'Cellar was reset. This bottle was not added again.';
  end if;

  return NEW;
end
$cellar$;

create or replace function private.reject_restored_points()
returns trigger
language plpgsql
security definer
set search_path = public
as $points$
declare
  current_gen bigint;
begin
  select p.progress_generation into current_gen
  from public.profiles p
  where p.id = NEW.user_id;

  if coalesce(current_gen, 0) = 0 then
    return NEW;
  end if;

  if coalesce(NEW.earned_generation, 0) < current_gen then
    raise exception 'Points were reset. Open the app again before earning more.';
  end if;

  return NEW;
end
$points$;

drop trigger if exists wines_reject_restored_cellar on public.wines;
create trigger wines_reject_restored_cellar
  before insert or update on public.wines
  for each row execute function private.reject_restored_cellar();

drop trigger if exists user_badge_tiers_reject_restored_points on public.user_badge_tiers;
create trigger user_badge_tiers_reject_restored_points
  before insert or update on public.user_badge_tiers
  for each row execute function private.reject_restored_points();

drop trigger if exists user_journey_completions_reject_restored_points on public.user_journey_completions;
create trigger user_journey_completions_reject_restored_points
  before insert or update on public.user_journey_completions
  for each row execute function private.reject_restored_points();

create or replace function private.reset_profile(
  target_email text,
  keep_friends boolean default false
)
returns table (step text, detail text)
language plpgsql
security definer
set search_path = public
as $fn$
declare
  uid uuid;
  match_count int;
  deleted int;
  tried_count int := 0;
  wishlist_count int := 0;
  next_generation bigint;
  profile_label text;
begin
  if target_email is null or btrim(target_email) = '' then
    raise exception 'Pass the account email.';
  end if;

  alter table public.profiles
    add column if not exists progress_generation bigint not null default 0;

  alter table public.profiles
    add column if not exists progress_reset_at timestamptz;

  drop policy if exists profiles_update on public.profiles;
  create policy profiles_update on public.profiles
    for update to authenticated
    using (auth.uid() = id)
    with check (
      auth.uid() = id
      and is_pro is not distinct from (
        select p.is_pro from public.profiles p where p.id = auth.uid()
      )
      and progress_generation is not distinct from (
        select p.progress_generation from public.profiles p where p.id = auth.uid()
      )
      and progress_reset_at is not distinct from (
        select p.progress_reset_at from public.profiles p where p.id = auth.uid()
      )
    );

  select count(*) into match_count
  from auth.users u
  where lower(u.email) = lower(btrim(target_email));

  if match_count > 1 then
    raise exception 'More than one auth user matches %', target_email;
  elsif match_count = 1 then
    select u.id into uid
    from auth.users u
    where lower(u.email) = lower(btrim(target_email));
  else
    select count(*) into match_count
    from public.profiles p
    where lower(p.email) = lower(btrim(target_email));
    if match_count = 0 then
      raise exception 'No auth user or profile matches %', target_email;
    elsif match_count > 1 then
      raise exception 'More than one profile matches %', target_email;
    end if;
    select p.id into uid
    from public.profiles p
    where lower(p.email) = lower(btrim(target_email));
  end if;

  if not exists (select 1 from public.profiles p where p.id = uid) then
    raise exception 'Auth user % has no profiles row', uid;
  end if;

  select p.display_name || ' <' || p.email || '>' into profile_label
  from public.profiles p
  where p.id = uid;

  step := 'profile';
  detail := profile_label;
  return next;

  if to_regclass('public.notifications') is not null then
    delete from public.notifications where recipient_id = uid or actor_id = uid;
    get diagnostics deleted = row_count;
    step := 'notifications';
    detail := deleted::text;
    return next;
  end if;

  if to_regclass('public.activity_reactions') is not null then
    delete from public.activity_reactions where reactor_id = uid or target_user_id = uid;
    get diagnostics deleted = row_count;
    step := 'activity_reactions';
    detail := deleted::text;
    return next;
  end if;

  if to_regclass('public.activity_milestone_reactions') is not null then
    delete from public.activity_milestone_reactions where reactor_id = uid or target_user_id = uid;
    get diagnostics deleted = row_count;
    step := 'activity_milestone_reactions';
    detail := deleted::text;
    return next;
  end if;

  if to_regclass('public.activity_events') is not null then
    delete from public.activity_events where user_id = uid;
    get diagnostics deleted = row_count;
    step := 'activity_events';
    detail := deleted::text;
    return next;
  end if;

  if to_regclass('public.user_badge_tiers') is not null then
    delete from public.user_badge_tiers where user_id = uid;
    get diagnostics deleted = row_count;
    step := 'user_badge_tiers';
    detail := deleted::text;
    return next;
  end if;

  if to_regclass('public.user_journey_completions') is not null then
    delete from public.user_journey_completions where user_id = uid;
    get diagnostics deleted = row_count;
    step := 'user_journey_completions';
    detail := deleted::text;
    return next;
  end if;

  if to_regclass('public.user_reports') is not null then
    delete from public.user_reports where reporter_id = uid;
    get diagnostics deleted = row_count;
    step := 'user_reports';
    detail := deleted::text;
    return next;
  end if;

  if to_regclass('public.wines') is not null then
    select
      count(*) filter (where status = 'tried'),
      count(*) filter (where status is distinct from 'tried')
    into tried_count, wishlist_count
    from public.wines
    where user_id = uid;

    delete from public.wines where user_id = uid;
    get diagnostics deleted = row_count;
    if deleted is distinct from tried_count + wishlist_count then
      raise exception 'Cellar was not fully cleared for %', target_email;
    end if;
  end if;

  step := 'cellar';
  detail := tried_count::text;
  return next;

  step := 'wishlist';
  detail := wishlist_count::text;
  return next;

  if to_regclass('public.menu_scan_usage') is not null then
    delete from public.menu_scan_usage where user_id = uid;
    get diagnostics deleted = row_count;
    step := 'menu_scan_usage';
    detail := deleted::text;
    return next;
  end if;

  if to_regclass('public.label_scan_usage') is not null then
    delete from public.label_scan_usage where user_id = uid;
    get diagnostics deleted = row_count;
    step := 'label_scan_usage';
    detail := deleted::text;
    return next;
  end if;

  if to_regclass('public.ai_scan_events') is not null then
    delete from public.ai_scan_events where user_id = uid;
    get diagnostics deleted = row_count;
    step := 'ai_scan_events';
    detail := deleted::text;
    return next;
  end if;

  if to_regclass('public.ai_scan_corrections') is not null then
    delete from public.ai_scan_corrections where user_id = uid;
    get diagnostics deleted = row_count;
    step := 'ai_scan_corrections';
    detail := deleted::text;
    return next;
  end if;

  if not keep_friends and to_regclass('public.friendships') is not null then
    delete from public.friendships where requester_id = uid or addressee_id = uid;
    get diagnostics deleted = row_count;
    step := 'friendships';
    detail := deleted::text;
    return next;
  end if;

  if to_regclass('public.user_blocks') is not null then
    delete from public.user_blocks where blocker_id = uid;
    get diagnostics deleted = row_count;
    step := 'user_blocks';
    detail := deleted::text;
    return next;
  end if;

  step := 'ai-scan-uploads';
  detail := 'skipped';
  return next;

  if to_regclass('public.wines') is not null
     and exists (select 1 from public.wines where user_id = uid) then
    raise exception 'Cellar was not fully cleared for %', target_email;
  end if;

  if to_regclass('public.user_badge_tiers') is not null
     and exists (select 1 from public.user_badge_tiers where user_id = uid) then
    raise exception 'Points were not fully cleared for %', target_email;
  end if;

  if to_regclass('public.user_journey_completions') is not null
     and exists (select 1 from public.user_journey_completions where user_id = uid) then
    raise exception 'Points were not fully cleared for %', target_email;
  end if;

  step := 'points';
  detail := '0';
  return next;

  update public.profiles
  set ranking_preference = null,
      progress_generation = progress_generation + 1,
      progress_reset_at = now()
  where id = uid
  returning progress_generation into next_generation;

  step := 'progress_generation';
  detail := next_generation::text;
  return next;
end
$fn$;

revoke all on function private.reset_profile(text, boolean) from public;
revoke all on function private.reject_restored_cellar() from public;
revoke all on function private.reject_restored_points() from public;

do $grants$
begin
  if exists (select 1 from pg_roles where rolname = 'anon') then
    execute 'revoke all on function private.reset_profile(text, boolean) from anon';
    execute 'revoke all on function private.reject_restored_cellar() from anon';
    execute 'revoke all on function private.reject_restored_points() from anon';
  end if;
  if exists (select 1 from pg_roles where rolname = 'authenticated') then
    execute 'revoke all on function private.reset_profile(text, boolean) from authenticated';
    execute 'revoke all on function private.reject_restored_cellar() from authenticated';
    execute 'revoke all on function private.reject_restored_points() from authenticated';
  end if;
end
$grants$;

update public.profiles
set progress_reset_at = now()
where progress_generation > 0
  and progress_reset_at is null;

comment on function private.reset_profile(text, boolean) is
  'Wipes one profile cellar, wishlist, badges, journeys, and points. Callable from the SQL editor, not from anon or authenticated.';
