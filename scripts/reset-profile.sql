-- Install once in the Supabase SQL editor, then reset a profile with:
--
--   select * from private.reset_profile('you@example.com');
--
-- Pass true to leave friendships in place:
--
--   select * from private.reset_profile('you@example.com', true);
--
-- Wipes cellar, wishlist, badges, journeys, and points (those are computed from
-- wines, badge tiers, and journeys), plus activity, reactions, notifications,
-- scan history, blocks this profile created, and reports it filed.
-- Keeps the login, display name, email, avatar, Pro, Stripe ids, and push tokens.
-- Not granted to anon or authenticated.

create schema if not exists private;

create or replace function private.reset_profile(
  target_email text,
  keep_friends boolean default false
)
returns table (step text, detail text)
language plpgsql
security invoker
set search_path = public
as $fn$
declare
  uid uuid;
  match_count int;
  deleted int;
  next_generation bigint;
  profile_label text;
begin
  if target_email is null or btrim(target_email) = '' then
    raise exception 'Pass the account email.';
  end if;

  alter table public.profiles
    add column if not exists progress_generation bigint not null default 0;

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
    delete from public.wines where user_id = uid;
    get diagnostics deleted = row_count;
    step := 'wines';
    detail := deleted::text;
    return next;
  end if;

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

  update public.profiles
  set ranking_preference = null,
      progress_generation = progress_generation + 1
  where id = uid
  returning progress_generation into next_generation;

  step := 'progress_generation';
  detail := next_generation::text;
  return next;
end
$fn$;

revoke all on function private.reset_profile(text, boolean) from public;

do $grants$
begin
  if exists (select 1 from pg_roles where rolname = 'anon') then
    execute 'revoke all on function private.reset_profile(text, boolean) from anon';
  end if;
  if exists (select 1 from pg_roles where rolname = 'authenticated') then
    execute 'revoke all on function private.reset_profile(text, boolean) from authenticated';
  end if;
end
$grants$;

comment on function private.reset_profile(text, boolean) is
  'Wipes one profile cellar, badges, journeys, and points. Callable from the SQL editor, not from anon or authenticated.';
