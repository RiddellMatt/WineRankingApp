-- In-app notification when a friend reacts to a milestone (badge / journey)

create or replace function public.notify_activity_milestone_reaction()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  milestone_label text;
begin
  select
    case ev.event_type
      when 'badge_unlock' then coalesce(ev.payload->>'badge_title', 'a badge')
      when 'journey_complete' then coalesce(ev.payload->>'journey_title', 'a journey')
      else 'a milestone'
    end
  into milestone_label
  from public.activity_events ev
  where ev.id = NEW.milestone_event_id;

  if milestone_label is null then
    milestone_label := 'a milestone';
  end if;

  insert into public.notifications (recipient_id, actor_id, type, payload)
  values (
    NEW.target_user_id,
    NEW.reactor_id,
    'reaction',
    jsonb_build_object(
      'reaction_type', NEW.reaction_type,
      'milestone_event_id', NEW.milestone_event_id,
      'event_type', 'logged',
      'wine_name', milestone_label
    )
  );
  return NEW;
end;
$$;

drop trigger if exists activity_milestone_reactions_notify on public.activity_milestone_reactions;

create trigger activity_milestone_reactions_notify
  after insert or update of reaction_type on public.activity_milestone_reactions
  for each row
  when (pg_trigger_depth() = 0)
  execute function public.notify_activity_milestone_reaction();
