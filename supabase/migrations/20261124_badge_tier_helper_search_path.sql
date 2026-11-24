-- The first version of these helpers omitted a fixed search_path.
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

revoke all on function private.badge_tier_rank(text) from public;
revoke all on function private.badge_tier_requirement(text, text) from public;

do $grants$
begin
  if exists (select 1 from pg_roles where rolname = 'anon') then
    execute 'revoke all on function private.badge_tier_rank(text) from anon';
    execute 'revoke all on function private.badge_tier_requirement(text, text) from anon';
  end if;
  if exists (select 1 from pg_roles where rolname = 'authenticated') then
    execute 'revoke all on function private.badge_tier_rank(text) from authenticated';
    execute 'revoke all on function private.badge_tier_requirement(text, text) from authenticated';
  end if;
end
$grants$;
