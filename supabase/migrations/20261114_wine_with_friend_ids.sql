-- Tag accepted friends on a wine log ("tried this with you")

alter table public.wines
  add column if not exists with_friend_ids uuid[] not null default '{}';

create or replace function public.validate_wine_with_friend_ids()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  fid uuid;
  cnt int;
begin
  cnt := coalesce(array_length(NEW.with_friend_ids, 1), 0);
  if cnt > 8 then
    raise exception 'with_friend_ids: at most 8 friends';
  end if;
  if cnt = 0 then
    return NEW;
  end if;
  foreach fid in array NEW.with_friend_ids loop
    if fid is null or fid = NEW.user_id then
      raise exception 'with_friend_ids: invalid friend';
    end if;
    if not public.are_friends(NEW.user_id, fid) then
      raise exception 'with_friend_ids: not friends with %', fid;
    end if;
  end loop;
  return NEW;
end;
$$;

drop trigger if exists wines_validate_with_friend_ids on public.wines;
create trigger wines_validate_with_friend_ids
  before insert or update of with_friend_ids on public.wines
  for each row
  execute function public.validate_wine_with_friend_ids();

alter table public.notifications drop constraint if exists notifications_type_check;

alter table public.notifications add constraint notifications_type_check
  check (type in (
    'reaction',
    'friend_request',
    'friend_accepted',
    'friend_badge_unlock',
    'friend_journey_complete',
    'wine_with_friend'
  ));

create or replace function public.notify_wine_with_friend()
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

drop trigger if exists wines_notify_with_friend on public.wines;
create trigger wines_notify_with_friend
  after insert or update of with_friend_ids on public.wines
  for each row
  when (pg_trigger_depth() = 0)
  execute function public.notify_wine_with_friend();