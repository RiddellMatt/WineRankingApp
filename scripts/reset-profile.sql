-- Edit the email, then run this whole file in the Supabase SQL editor.
-- One transaction. Wipes cellar, badges, journeys, and points for that profile.
-- keep_friends true leaves friendships in place. Login, name, avatar, and Pro stay.

do $reset$
declare
  target_email text := 'CHANGE_ME@example.com';
  keep_friends boolean := false;
  uid uuid;
  match_count int;
  deleted int;
  next_generation bigint;
  profile_label text;
begin
  if target_email is null
    or btrim(target_email) = ''
    or lower(btrim(target_email)) = 'change_me@example.com'
  then
    raise exception 'Set target_email at the top of this file before running it.';
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

  raise notice 'Resetting % (%)', profile_label, uid;

  if to_regclass('public.notifications') is not null then
    delete from public.notifications where recipient_id = uid or actor_id = uid;
    get diagnostics deleted = row_count;
    raise notice 'notifications: %', deleted;
  end if;

  if to_regclass('public.activity_reactions') is not null then
    delete from public.activity_reactions where reactor_id = uid or target_user_id = uid;
    get diagnostics deleted = row_count;
    raise notice 'activity_reactions: %', deleted;
  end if;

  if to_regclass('public.activity_milestone_reactions') is not null then
    delete from public.activity_milestone_reactions where reactor_id = uid or target_user_id = uid;
    get diagnostics deleted = row_count;
    raise notice 'activity_milestone_reactions: %', deleted;
  end if;

  if to_regclass('public.activity_events') is not null then
    delete from public.activity_events where user_id = uid;
    get diagnostics deleted = row_count;
    raise notice 'activity_events: %', deleted;
  end if;

  if to_regclass('public.user_badge_tiers') is not null then
    delete from public.user_badge_tiers where user_id = uid;
    get diagnostics deleted = row_count;
    raise notice 'user_badge_tiers: %', deleted;
  end if;

  if to_regclass('public.user_journey_completions') is not null then
    delete from public.user_journey_completions where user_id = uid;
    get diagnostics deleted = row_count;
    raise notice 'user_journey_completions: %', deleted;
  end if;

  if to_regclass('public.user_reports') is not null then
    delete from public.user_reports where reporter_id = uid;
    get diagnostics deleted = row_count;
    raise notice 'user_reports: %', deleted;
  end if;

  if to_regclass('public.wines') is not null then
    delete from public.wines where user_id = uid;
    get diagnostics deleted = row_count;
    raise notice 'wines: %', deleted;
  end if;

  if to_regclass('public.menu_scan_usage') is not null then
    delete from public.menu_scan_usage where user_id = uid;
    get diagnostics deleted = row_count;
    raise notice 'menu_scan_usage: %', deleted;
  end if;

  if to_regclass('public.label_scan_usage') is not null then
    delete from public.label_scan_usage where user_id = uid;
    get diagnostics deleted = row_count;
    raise notice 'label_scan_usage: %', deleted;
  end if;

  if to_regclass('public.ai_scan_events') is not null then
    delete from public.ai_scan_events where user_id = uid;
    get diagnostics deleted = row_count;
    raise notice 'ai_scan_events: %', deleted;
  end if;

  if to_regclass('public.ai_scan_corrections') is not null then
    delete from public.ai_scan_corrections where user_id = uid;
    get diagnostics deleted = row_count;
    raise notice 'ai_scan_corrections: %', deleted;
  end if;

  if not keep_friends and to_regclass('public.friendships') is not null then
    delete from public.friendships where requester_id = uid or addressee_id = uid;
    get diagnostics deleted = row_count;
    raise notice 'friendships: %', deleted;
  end if;

  if to_regclass('public.user_blocks') is not null then
    delete from public.user_blocks where blocker_id = uid;
    get diagnostics deleted = row_count;
    raise notice 'user_blocks: %', deleted;
  end if;

  begin
    delete from storage.objects
    where bucket_id = 'ai-scan-uploads'
      and (storage.foldername(name))[1] = uid::text;
    get diagnostics deleted = row_count;
    raise notice 'ai-scan-uploads: %', deleted;
  exception
    when undefined_table or undefined_function then
      raise notice 'ai-scan-uploads: skipped (%)', sqlerrm;
  end;

  update public.profiles
  set ranking_preference = null,
      progress_generation = progress_generation + 1
  where id = uid
  returning progress_generation into next_generation;

  raise notice 'Done. % is reset. progress_generation is now %. Reload the app on each device.',
    profile_label, next_generation;
end
$reset$;
