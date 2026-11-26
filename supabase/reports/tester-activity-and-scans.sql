-- ═══════════════════════════════════════════════════════════════════════════
-- Decanti — Tester activity & AI scan reports (Supabase SQL Editor)
-- ═══════════════════════════════════════════════════════════════════════════
--
-- HOW TO RUN
--   Dashboard → SQL Editor → New query → paste ONE report section → Run
--   (SQL Editor uses the service role; it can read all rows despite RLS.)
--
-- PREREQS
--   • Migrations applied, especially `20261114_ai_scan_metrics.sql` (`ai_scan_events`,
--     `ai_scan_corrections`). If that migration is missing, scan reports return no rows.
--   • `auth.users` columns `last_sign_in_at`, `created_at` require Supabase Auth.
--
-- TIP: Each block below is independent. Comment/uncomment the CONFIG block when useful.
-- ═══════════════════════════════════════════════════════════════════════════


-- ── CONFIG (optional filters — used by reports that reference these CTEs) ───
-- Paste this once at the top of a query, then paste a report below it.

-- with config as (
--   select
--     -- Focus on known TestFlight emails (null = all users)
--     array[
--       'tester1@example.com',
--       'tester2@example.com'
--     ]::text[] as tester_emails,
--     -- Ignore team accounts in leaderboards
--     array['mriddell3495@yahoo.com']::text[] as exclude_emails,
--     interval '90 days' as lookback
-- ),
-- filtered_users as (
--   select u.id, u.email, u.created_at as auth_created_at, u.last_sign_in_at
--   from auth.users u
--   cross join config c
--   where (c.tester_emails is null or lower(u.email) = any (
--           select lower(x) from unnest(c.tester_emails) x))
--     and (c.exclude_emails is null or lower(u.email) <> all (
--           select lower(x) from unnest(c.exclude_emails) x))
-- )


-- ═══════════════════════════════════════════════════════════════════════════
-- REPORT 1 — Tester scorecard (one row per user)
-- Who is active, what they’ve logged, scans, social, Pro, push.
-- ═══════════════════════════════════════════════════════════════════════════

select
  p.display_name,
  u.email,
  u.created_at::date as signed_up,
  u.last_sign_in_at at time zone 'America/Detroit' as last_sign_in_et,
  p.is_pro,
  exists (select 1 from public.push_device_tokens t where t.user_id = p.id) as has_push_token,
  count(w.*) filter (where w.status = 'tried') as wines_tried,
  count(w.*) filter (where w.status = 'wishlist') as wishlist_count,
  max(to_timestamp(w.added_at / 1000.0)) as last_wine_added,
  (select count(*) from public.friendships f
   where f.status = 'accepted'
     and (f.requester_id = p.id or f.addressee_id = p.id)) as friend_count,
  (select count(*) from public.ai_scan_events e where e.user_id = p.id) as ai_scan_events,
  (select count(*) from public.ai_scan_events e
   where e.user_id = p.id and e.status = 'success') as ai_scan_success,
  (select count(*) from public.ai_scan_corrections c where c.user_id = p.id) as scan_corrections,
  (select count(*) from public.label_scan_usage lu where lu.user_id = p.id) as label_quota_rows,
  (select count(*) from public.menu_scan_usage mu where mu.user_id = p.id) as menu_quota_rows
from public.profiles p
join auth.users u on u.id = p.id
left join public.wines w on w.user_id = p.id
group by p.id, p.display_name, u.email, u.created_at, u.last_sign_in_at, p.is_pro
order by last_wine_added desc nulls last, u.last_sign_in_at desc nulls last;


-- ═══════════════════════════════════════════════════════════════════════════
-- REPORT 2 — Weekly active testers (WAU-style from real product actions)
-- Active = added/updated a wine OR ran an AI scan that week (America/Detroit).
-- ═══════════════════════════════════════════════════════════════════════════

with weeks as (
  select generate_series(
    date_trunc('week', (now() at time zone 'America/Detroit')::date - interval '12 weeks'),
    date_trunc('week', (now() at time zone 'America/Detroit')::date),
    interval '1 week'
  )::date as week_start
),
wine_weeks as (
  select distinct
    w.user_id,
    date_trunc('week', (to_timestamp(w.added_at / 1000.0) at time zone 'America/Detroit'))::date as week_start
  from public.wines w
),
scan_weeks as (
  select distinct
    e.user_id,
    date_trunc('week', (e.created_at at time zone 'America/Detroit'))::date as week_start
  from public.ai_scan_events e
),
active as (
  select user_id, week_start from wine_weeks
  union
  select user_id, week_start from scan_weeks
)
select
  w.week_start,
  count(distinct a.user_id) as active_testers,
  count(distinct a.user_id) filter (
    where exists (
      select 1 from wine_weeks ww
      where ww.user_id = a.user_id and ww.week_start = w.week_start
    )
  ) as with_wine_activity,
  count(distinct a.user_id) filter (
    where exists (
      select 1 from scan_weeks sw
      where sw.user_id = a.user_id and sw.week_start = w.week_start
    )
  ) as with_scan_activity
from weeks w
left join active a on a.week_start = w.week_start
group by w.week_start
order by w.week_start;


-- ═══════════════════════════════════════════════════════════════════════════
-- REPORT 3 — Daily scan volume & outcome mix
-- ═══════════════════════════════════════════════════════════════════════════

select
  (e.created_at at time zone 'America/Detroit')::date as day_et,
  e.scan_type,
  count(*) as attempts,
  count(*) filter (where e.status = 'success') as success,
  count(*) filter (where e.status = 'no_data') as no_data,
  count(*) filter (where e.status = 'error') as errors,
  round(100.0 * count(*) filter (where e.status = 'success') / nullif(count(*), 0), 1) as success_pct,
  round(percentile_cont(0.5) within group (order by e.duration_ms_total)) as p50_ms_total,
  round(percentile_cont(0.9) within group (order by e.duration_ms_total)) as p90_ms_total,
  round(avg(e.fields_extracted) filter (where e.scan_type = 'label'), 1) as avg_label_fields,
  round(avg(e.wines_count) filter (where e.scan_type = 'menu'), 1) as avg_menu_wines
from public.ai_scan_events e
where e.created_at >= now() - interval '30 days'
group by 1, 2
order by 1 desc, 2;


-- ═══════════════════════════════════════════════════════════════════════════
-- REPORT 4 — Scan errors & model health (last 30 days)
-- ═══════════════════════════════════════════════════════════════════════════

select
  e.scan_type,
  coalesce(e.error_code, '(none)') as error_code,
  e.model,
  count(*) as n,
  round(avg(e.duration_ms_total)) as avg_ms,
  round(avg(e.fallback_attempts), 2) as avg_fallbacks
from public.ai_scan_events e
where e.created_at >= now() - interval '30 days'
  and e.status = 'error'
group by 1, 2, 3
order by n desc;


-- ═══════════════════════════════════════════════════════════════════════════
-- REPORT 5 — Correction rate (users editing AI fields after label scan)
-- High correction % = model or UX friction worth tuning.
-- ═══════════════════════════════════════════════════════════════════════════

with per_user as (
  select
    e.user_id,
    count(*) filter (where e.scan_type = 'label' and e.status = 'success') as label_success,
    count(*) filter (where e.scan_type = 'label') as label_attempts
  from public.ai_scan_events e
  where e.created_at >= now() - interval '30 days'
  group by e.user_id
),
corrections as (
  select c.user_id, count(*) as correction_events
  from public.ai_scan_corrections c
  where c.created_at >= now() - interval '30 days'
    and c.scan_type = 'label'
  group by c.user_id
)
select
  p.display_name,
  u.email,
  coalesce(pu.label_attempts, 0) as label_attempts,
  coalesce(pu.label_success, 0) as label_success,
  coalesce(c.correction_events, 0) as corrections,
  round(
    100.0 * coalesce(c.correction_events, 0)
    / nullif(coalesce(pu.label_success, 0), 0),
    1
  ) as corrections_per_success_pct
from public.profiles p
join auth.users u on u.id = p.id
left join per_user pu on pu.user_id = p.id
left join corrections c on c.user_id = p.id
where coalesce(pu.label_attempts, 0) > 0 or coalesce(c.correction_events, 0) > 0
order by corrections desc, label_success desc;


-- ═══════════════════════════════════════════════════════════════════════════
-- REPORT 6 — Quota usage vs observability (label / menu)
-- `*_scan_usage` = billed Pro quota rows; `ai_scan_events` = all attempts with outcome.
-- ═══════════════════════════════════════════════════════════════════════════

select
  date_trunc('week', x.day_et)::date as week_start,
  sum(x.label_usage) as label_quota_inserts,
  sum(x.menu_usage) as menu_quota_inserts,
  sum(x.label_events) as label_events_logged,
  sum(x.menu_events) as menu_events_logged
from (
  select
    (lu.created_at at time zone 'America/Detroit')::date as day_et,
    count(*)::int as label_usage,
    0 as menu_usage,
    0 as label_events,
    0 as menu_events
  from public.label_scan_usage lu
  where lu.created_at >= now() - interval '90 days'
  group by 1
  union all
  select
    (mu.created_at at time zone 'America/Detroit')::date,
    0,
    count(*)::int,
    0,
    0
  from public.menu_scan_usage mu
  where mu.created_at >= now() - interval '90 days'
  group by 1
  union all
  select
    (e.created_at at time zone 'America/Detroit')::date,
    0,
    0,
    count(*) filter (where e.scan_type = 'label')::int,
    count(*) filter (where e.scan_type = 'menu')::int
  from public.ai_scan_events e
  where e.created_at >= now() - interval '90 days'
  group by 1
) x
group by 1
order by 1 desc;


-- ═══════════════════════════════════════════════════════════════════════════
-- REPORT 7 — Cold / churned testers (need a nudge)
-- Signed up, no wine in 14d OR no sign-in in 21d (adjust thresholds as needed).
-- ═══════════════════════════════════════════════════════════════════════════

with wine_last as (
  select user_id, max(to_timestamp(added_at / 1000.0)) as last_wine
  from public.wines
  group by user_id
)
select
  p.display_name,
  u.email,
  u.created_at::date as signed_up,
  u.last_sign_in_at at time zone 'America/Detroit' as last_sign_in_et,
  wl.last_wine at time zone 'America/Detroit' as last_wine_et,
  case
    when wl.last_wine is null then 'never_logged_wine'
    when wl.last_wine < now() - interval '14 days' then 'no_wine_14d'
    else 'ok'
  end as wine_status,
  case
    when u.last_sign_in_at is null then 'never_signed_in'
    when u.last_sign_in_at < now() - interval '21 days' then 'no_sign_in_21d'
    else 'ok'
  end as auth_status
from public.profiles p
join auth.users u on u.id = p.id
left join wine_last wl on wl.user_id = p.id
where u.created_at < now() - interval '3 days'
  and (
    wl.last_wine is null
    or wl.last_wine < now() - interval '14 days'
    or u.last_sign_in_at is null
    or u.last_sign_in_at < now() - interval '21 days'
  )
order by u.last_sign_in_at nulls first, wl.last_wine nulls first;


-- ═══════════════════════════════════════════════════════════════════════════
-- REPORT 8 — Social graph & engagement (friends, reactions, milestones)
-- ═══════════════════════════════════════════════════════════════════════════

select
  p.display_name,
  u.email,
  (select count(*) from public.friendships f
   where f.status = 'accepted'
     and (f.requester_id = p.id or f.addressee_id = p.id)) as friends,
  (select count(*) from public.friendships f
   where f.status = 'pending'
     and (f.requester_id = p.id or f.addressee_id = p.id)) as pending_friend_links,
  (select count(*) from public.activity_reactions r where r.reactor_id = p.id) as reactions_given,
  (select count(*) from public.activity_events ev where ev.user_id = p.id) as milestone_events,
  (select count(*) from public.user_journey_completions jc where jc.user_id = p.id) as passport_journeys_done
from public.profiles p
join auth.users u on u.id = p.id
order by friends desc, reactions_given desc;


-- ═══════════════════════════════════════════════════════════════════════════
-- REPORT 9 — Recent AI scan drill-down (last 7 days, for debugging TestFlight)
-- ═══════════════════════════════════════════════════════════════════════════

select
  e.created_at at time zone 'America/Detroit' as at_et,
  p.display_name,
  u.email,
  e.scan_type,
  e.status,
  e.error_code,
  e.model,
  e.duration_ms_total,
  e.duration_ms_gemini,
  e.fallback_attempts,
  e.fields_extracted,
  e.wines_count,
  e.image_bytes
from public.ai_scan_events e
join public.profiles p on p.id = e.user_id
join auth.users u on u.id = e.user_id
where e.created_at >= now() - interval '7 days'
order by e.created_at desc
limit 200;