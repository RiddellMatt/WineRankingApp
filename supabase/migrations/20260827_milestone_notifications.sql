-- Notify friends when someone unlocks a badge or completes a journey

alter table public.notifications drop constraint if exists notifications_type_check;

alter table public.notifications add constraint notifications_type_check
  check (type in (
    'reaction',
    'friend_request',
    'friend_accepted',
    'friend_badge_unlock',
    'friend_journey_complete'
  ));

create or replace function public.notify_friend_milestone()
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
    and (f.requester_id = NEW.user_id or f.addressee_id = NEW.user_id);

  return NEW;
end;
$$;

create trigger activity_events_notify_friends
  after insert on public.activity_events
  for each row
  execute function public.notify_friend_milestone();
