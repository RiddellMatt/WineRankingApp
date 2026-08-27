-- In-app notifications (reactions, friend requests, etc.)

create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  recipient_id uuid not null references auth.users (id) on delete cascade,
  actor_id uuid references auth.users (id) on delete set null,
  type text not null check (type in ('reaction', 'friend_request', 'friend_accepted')),
  payload jsonb not null default '{}',
  read_at timestamptz,
  created_at timestamptz not null default now()
);

create index notifications_recipient_created_idx
  on public.notifications (recipient_id, created_at desc);

create index notifications_recipient_unread_idx
  on public.notifications (recipient_id)
  where read_at is null;

alter table public.notifications enable row level security;

create policy notifications_select on public.notifications
  for select to authenticated
  using (recipient_id = auth.uid());

create policy notifications_update on public.notifications
  for update to authenticated
  using (recipient_id = auth.uid())
  with check (recipient_id = auth.uid());

-- ── Triggers: activity reactions ──────────────────────────────────────────

create or replace function public.notify_activity_reaction()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  wine_name text;
begin
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

create trigger activity_reactions_notify
  after insert or update of reaction_type on public.activity_reactions
  for each row
  when (pg_trigger_depth() = 0)
  execute function public.notify_activity_reaction();

-- ── Triggers: friendships ─────────────────────────────────────────────────

create or replace function public.notify_friendship_event()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
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

create trigger friendships_notify
  after insert or update of status on public.friendships
  for each row
  execute function public.notify_friendship_event();
