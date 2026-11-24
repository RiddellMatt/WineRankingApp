-- A device can stamp earned_generation with the current reset and re-upload
-- tiers the cellar no longer supports. Raising a tier has to fit the cellar
-- that exists now. Keeping an already stored tier still survives deleted bottles.

create or replace function private.badge_tier_rank(tier text)
returns integer
language sql
immutable
set search_path = public
as $$
  select case tier
    when 'bronze' then 1
    when 'silver' then 2
    when 'gold' then 3
    when 'diamond' then 4
    else 0
  end
$$;

create or replace function private.badge_tier_requirement(badge_id text, tier text)
returns integer
language sql
immutable
set search_path = public
as $$
  select case
    when private.badge_tier_rank(tier) = 0 then 0
    when badge_id = 'host' then (array[1, 3, 10, 25])[private.badge_tier_rank(tier)]
    else (array[10, 25, 50, 100])[private.badge_tier_rank(tier)]
  end
$$;

create or replace function private.badge_progress_upper_bound(uid uuid, badge_id text)
returns integer
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  tried integer;
begin
  if badge_id = 'social' then
    return (
      select count(*)::integer
      from public.friendships f
      where f.status = 'accepted'
        and (f.requester_id = uid or f.addressee_id = uid)
    );
  elsif badge_id = 'host' then
    return coalesce(
      (select p.qualified_referral_count from public.profiles p where p.id = uid),
      0
    );
  elsif badge_id = 'pathfinder' then
    return (
      select count(*)::integer
      from public.user_journey_completions j
      where j.user_id = uid
    );
  elsif badge_id = 'curator' then
    return (
      select count(*)::integer
      from public.wines w
      where w.user_id = uid
        and w.status = 'wishlist'
    );
  end if;

  select count(*)::integer into tried
  from public.wines w
  where w.user_id = uid
    and w.status is distinct from 'wishlist';

  if badge_id = 'first_pour' then
    return tried;
  elsif badge_id = 'explorer' then
    return (
      select count(distinct lower(btrim(w.region)))::integer
      from public.wines w
      where w.user_id = uid
        and w.status is distinct from 'wishlist'
        and btrim(coalesce(w.region, '')) <> ''
    );
  elsif badge_id = 'traveler' then
    return (
      select count(distinct lower(btrim(w.purchased_at)))::integer
      from public.wines w
      where w.user_id = uid
        and w.status is distinct from 'wishlist'
        and btrim(coalesce(w.purchased_at, '')) <> ''
    );
  end if;

  return tried;
end
$$;

create or replace function private.reject_restored_badge_tier()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  current_gen bigint;
  previous_rank integer := 0;
  next_rank integer;
  needed integer;
  available integer;
begin
  select p.progress_generation into current_gen
  from public.profiles p
  where p.id = NEW.user_id;

  if coalesce(current_gen, 0) > 0
     and coalesce(NEW.earned_generation, 0) < current_gen then
    raise exception 'Points were reset. Open the app again before earning more.';
  end if;

  if TG_OP = 'UPDATE' then
    previous_rank := private.badge_tier_rank(OLD.tier);
  end if;
  next_rank := private.badge_tier_rank(NEW.tier);
  if next_rank > previous_rank then
    needed := private.badge_tier_requirement(NEW.badge_id, NEW.tier);
    available := private.badge_progress_upper_bound(NEW.user_id, NEW.badge_id);
    if needed > available then
      raise exception 'Badge tier is ahead of this cellar.';
    end if;
  end if;

  return NEW;
end
$$;

revoke all on function private.badge_tier_rank(text) from public;
revoke all on function private.badge_tier_requirement(text, text) from public;
revoke all on function private.badge_progress_upper_bound(uuid, text) from public;
revoke all on function private.reject_restored_badge_tier() from public;

do $grants$
begin
  if exists (select 1 from pg_roles where rolname = 'anon') then
    execute 'revoke all on function private.badge_tier_rank(text) from anon';
    execute 'revoke all on function private.badge_tier_requirement(text, text) from anon';
    execute 'revoke all on function private.badge_progress_upper_bound(uuid, text) from anon';
    execute 'revoke all on function private.reject_restored_badge_tier() from anon';
  end if;
  if exists (select 1 from pg_roles where rolname = 'authenticated') then
    execute 'revoke all on function private.badge_tier_rank(text) from authenticated';
    execute 'revoke all on function private.badge_tier_requirement(text, text) from authenticated';
    execute 'revoke all on function private.badge_progress_upper_bound(uuid, text) from authenticated';
    execute 'revoke all on function private.reject_restored_badge_tier() from authenticated';
  end if;
end
$grants$;

drop trigger if exists user_badge_tiers_reject_restored_points on public.user_badge_tiers;
create trigger user_badge_tiers_reject_restored_points
  before insert or update on public.user_badge_tiers
  for each row execute function private.reject_restored_badge_tier();
