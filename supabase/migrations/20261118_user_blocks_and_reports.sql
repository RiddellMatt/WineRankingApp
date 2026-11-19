-- Report, block, and a phrase filter.
-- Hosted helpers live in the private schema. Policies keep calling private.are_friends.

create table public.user_blocks (
  blocker_id uuid not null references auth.users (id) on delete cascade,
  blocked_id uuid not null references auth.users (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (blocker_id, blocked_id),
  check (blocker_id <> blocked_id)
);

create index user_blocks_blocked_idx on public.user_blocks (blocked_id);

alter table public.user_blocks enable row level security;

create policy user_blocks_select on public.user_blocks
  for select to authenticated
  using (blocker_id = auth.uid());

create policy user_blocks_insert on public.user_blocks
  for insert to authenticated
  with check (blocker_id = auth.uid());

create policy user_blocks_delete on public.user_blocks
  for delete to authenticated
  using (blocker_id = auth.uid());

grant select, insert, delete on public.user_blocks to authenticated;

create table public.user_reports (
  id uuid primary key default gen_random_uuid(),
  reporter_id uuid not null references auth.users (id) on delete cascade,
  target_user_id uuid not null references auth.users (id) on delete cascade,
  wine_id uuid references public.wines (id) on delete set null,
  reason text not null check (reason in ('spam', 'harassment', 'hate', 'sexual', 'other')),
  note text not null default '',
  created_at timestamptz not null default now(),
  check (reporter_id <> target_user_id),
  check (char_length(note) <= 500)
);

create index user_reports_target_idx on public.user_reports (target_user_id, created_at desc);

alter table public.user_reports enable row level security;

create policy user_reports_select on public.user_reports
  for select to authenticated
  using (reporter_id = auth.uid());

create policy user_reports_insert on public.user_reports
  for insert to authenticated
  with check (reporter_id = auth.uid());

grant select, insert on public.user_reports to authenticated;

create or replace function private.users_are_blocked(a uuid, b uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select auth.uid() is not null
    and a is not null
    and b is not null
    and (auth.uid() = a or auth.uid() = b)
    and exists (
      select 1
      from public.user_blocks ub
      where (ub.blocker_id = a and ub.blocked_id = b)
         or (ub.blocker_id = b and ub.blocked_id = a)
    );
$$;

revoke all on function private.users_are_blocked(uuid, uuid) from public;
grant execute on function private.users_are_blocked(uuid, uuid) to authenticated, service_role;

create or replace function public.list_my_blocks()
returns table (
  blocked_id uuid,
  display_name text,
  avatar_url text,
  created_at timestamptz
)
language sql
stable
security definer
set search_path = public
as $$
  select ub.blocked_id, p.display_name, p.avatar_url, ub.created_at
  from public.user_blocks ub
  left join public.profiles p on p.id = ub.blocked_id
  where auth.uid() is not null
    and ub.blocker_id = auth.uid()
  order by ub.created_at desc;
$$;

revoke all on function public.list_my_blocks() from public;
grant execute on function public.list_my_blocks() to authenticated;

create or replace function private.can_view_profile(viewer uuid, profile_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select auth.uid() is not null
    and viewer = auth.uid()
    and (
      viewer = profile_id
      or (
        not private.users_are_blocked(viewer, profile_id)
        and (
          private.are_friends(viewer, profile_id)
          or exists (
            select 1
            from public.friendships f
            where f.status = 'pending'
              and (
                (f.requester_id = viewer and f.addressee_id = profile_id)
                or (f.requester_id = profile_id and f.addressee_id = viewer)
              )
          )
        )
      )
    );
$$;

create or replace function private.find_profile_by_email(lookup_email text)
returns table (id uuid, display_name text, email text, avatar_url text)
language sql
stable
security definer
set search_path = public
as $$
  select p.id, p.display_name, p.email, p.avatar_url
  from public.profiles p
  where auth.uid() is not null
    and nullif(trim(lookup_email), '') is not null
    and lower(p.email) = lower(trim(lookup_email))
    and p.id <> auth.uid()
    and not private.users_are_blocked(auth.uid(), p.id)
  limit 1;
$$;

drop policy if exists wines_select on public.wines;
create policy wines_select on public.wines
  for select to authenticated
  using (
    auth.uid() = user_id
    or (
      private.are_friends(auth.uid(), user_id)
      and not private.users_are_blocked(auth.uid(), user_id)
    )
  );

drop policy if exists friendships_select on public.friendships;
create policy friendships_select on public.friendships
  for select to authenticated
  using (
    (auth.uid() = requester_id or auth.uid() = addressee_id)
    and not private.users_are_blocked(requester_id, addressee_id)
  );

drop policy if exists friendships_insert on public.friendships;
create policy friendships_insert on public.friendships
  for insert to authenticated
  with check (
    auth.uid() = requester_id
    and status = 'pending'
    and not private.users_are_blocked(requester_id, addressee_id)
  );

drop policy if exists friendships_update on public.friendships;
create policy friendships_update on public.friendships
  for update to authenticated
  using (
    (auth.uid() = addressee_id or auth.uid() = requester_id)
    and not private.users_are_blocked(requester_id, addressee_id)
  );

drop policy if exists notifications_select on public.notifications;
create policy notifications_select on public.notifications
  for select to authenticated
  using (
    recipient_id = auth.uid()
    and (
      actor_id is null
      or not private.users_are_blocked(recipient_id, actor_id)
    )
  );

drop policy if exists activity_events_select on public.activity_events;
create policy activity_events_select on public.activity_events
  for select to authenticated
  using (
    user_id = auth.uid()
    or (
      private.are_friends(auth.uid(), user_id)
      and not private.users_are_blocked(auth.uid(), user_id)
    )
  );

drop policy if exists user_journey_completions_select on public.user_journey_completions;
create policy user_journey_completions_select on public.user_journey_completions
  for select to authenticated
  using (
    user_id = auth.uid()
    or (
      private.are_friends(auth.uid(), user_id)
      and not private.users_are_blocked(auth.uid(), user_id)
    )
  );

drop policy if exists activity_reactions_select on public.activity_reactions;
create policy activity_reactions_select on public.activity_reactions
  for select to authenticated
  using (
    not private.users_are_blocked(auth.uid(), reactor_id)
    and not private.users_are_blocked(auth.uid(), target_user_id)
    and (
      private.are_friends(auth.uid(), target_user_id)
      or reactor_id = auth.uid()
    )
  );

drop policy if exists activity_reactions_insert on public.activity_reactions;
create policy activity_reactions_insert on public.activity_reactions
  for insert to authenticated
  with check (
    reactor_id = auth.uid()
    and reactor_id <> target_user_id
    and private.are_friends(reactor_id, target_user_id)
    and not private.users_are_blocked(reactor_id, target_user_id)
    and exists (
      select 1
      from public.wines w
      where w.id = target_wine_id
        and w.user_id = target_user_id
    )
  );

drop policy if exists activity_milestone_reactions_select on public.activity_milestone_reactions;
create policy activity_milestone_reactions_select on public.activity_milestone_reactions
  for select to authenticated
  using (
    not private.users_are_blocked(auth.uid(), reactor_id)
    and not private.users_are_blocked(auth.uid(), target_user_id)
    and (
      private.are_friends(auth.uid(), target_user_id)
      or reactor_id = auth.uid()
    )
  );

drop policy if exists activity_milestone_reactions_insert on public.activity_milestone_reactions;
create policy activity_milestone_reactions_insert on public.activity_milestone_reactions
  for insert to authenticated
  with check (
    reactor_id = auth.uid()
    and reactor_id <> target_user_id
    and private.are_friends(reactor_id, target_user_id)
    and not private.users_are_blocked(reactor_id, target_user_id)
    and exists (
      select 1
      from public.activity_events ev
      where ev.id = milestone_event_id
        and ev.user_id = target_user_id
        and ev.event_type in ('badge_unlock', 'journey_complete')
    )
  );

create or replace function private.notify_activity_reaction()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  wine_name text;
begin
  if private.users_are_blocked(NEW.target_user_id, NEW.reactor_id) then
    return NEW;
  end if;

  select w.name into wine_name
  from public.wines w
  where w.id = NEW.target_wine_id;

  insert into public.notifications (recipient_id, actor_id, type, payload)
  values (
    NEW.target_user_id,
    NEW.reactor_id,
    'reaction',
    jsonb_build_object(
      'reaction_type', NEW.reaction_type,
      'wine_id', NEW.target_wine_id,
      'wine_name', coalesce(wine_name, 'a wine'),
      'event_type', NEW.event_type
    )
  );
  return NEW;
end;
$$;

create or replace function private.notify_friendship_event()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if private.users_are_blocked(NEW.requester_id, NEW.addressee_id) then
    return NEW;
  end if;

  if TG_OP = 'INSERT' and NEW.status = 'pending' then
    insert into public.notifications (recipient_id, actor_id, type, payload)
    values (
      NEW.addressee_id,
      NEW.requester_id,
      'friend_request',
      jsonb_build_object('friendship_id', NEW.id)
    );
  elsif TG_OP = 'UPDATE' and OLD.status = 'pending' and NEW.status = 'accepted' then
    insert into public.notifications (recipient_id, actor_id, type, payload)
    values (
      NEW.requester_id,
      NEW.addressee_id,
      'friend_accepted',
      jsonb_build_object('friendship_id', NEW.id)
    );
  end if;
  return NEW;
end;
$$;

create or replace function private.notify_friend_milestone()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.notifications (recipient_id, actor_id, type, payload)
  select
    case
      when f.requester_id = NEW.user_id then f.addressee_id
      else f.requester_id
    end,
    NEW.user_id,
    case NEW.event_type
      when 'badge_unlock' then 'friend_badge_unlock'
      when 'journey_complete' then 'friend_journey_complete'
    end,
    NEW.payload
  from public.friendships f
  where f.status = 'accepted'
    and (f.requester_id = NEW.user_id or f.addressee_id = NEW.user_id)
    and not private.users_are_blocked(
      case
        when f.requester_id = NEW.user_id then f.addressee_id
        else f.requester_id
      end,
      NEW.user_id
    );

  return NEW;
end;
$$;

create or replace function private.notify_wine_with_friend()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  fid uuid;
  old_ids uuid[];
  new_ids uuid[];
begin
  old_ids := coalesce(OLD.with_friend_ids, '{}');
  new_ids := coalesce(NEW.with_friend_ids, '{}');
  for fid in
    select unnest(new_ids)
    except
    select unnest(old_ids)
  loop
    if private.users_are_blocked(fid, NEW.user_id) then
      continue;
    end if;
    insert into public.notifications (recipient_id, actor_id, type, payload)
    values (
      fid,
      NEW.user_id,
      'wine_with_friend',
      jsonb_build_object(
        'wine_id', NEW.id,
        'wine_name', NEW.name,
        'winery', NEW.winery
      )
    );
  end loop;
  return NEW;
end;
$$;

-- Same phrase list as src/lib/contentFilter.ts.
create or replace function private.reject_blocked_phrase()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  body text;
begin
  if TG_TABLE_NAME = 'profiles' then
    if TG_OP <> 'UPDATE' or NEW.display_name is not distinct from OLD.display_name then
      return NEW;
    end if;
    body := NEW.display_name;
  elsif TG_TABLE_NAME = 'wines' then
    if TG_OP = 'UPDATE' and NEW.notes is not distinct from OLD.notes then
      return NEW;
    end if;
    body := NEW.notes;
  else
    return NEW;
  end if;

  if coalesce(body, '') ~* '\y(kill yourself|nigger|nigga|faggot|retard|cunt|bitch|fuck|shit|porn|kys)\y' then
    raise exception 'That text isn''t allowed. Change it and try again.'
      using errcode = 'check_violation';
  end if;
  return NEW;
end;
$$;

revoke all on function private.reject_blocked_phrase() from public;
grant execute on function private.reject_blocked_phrase() to authenticated, service_role;

drop trigger if exists profiles_reject_blocked_phrase on public.profiles;
create trigger profiles_reject_blocked_phrase
  before update of display_name on public.profiles
  for each row
  execute function private.reject_blocked_phrase();

drop trigger if exists wines_reject_blocked_phrase on public.wines;
create trigger wines_reject_blocked_phrase
  before insert or update of notes on public.wines
  for each row
  execute function private.reject_blocked_phrase();
