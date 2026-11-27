-- Public wine-card shares, and a notice when an invite is accepted but not yet rated.

create table if not exists public.wine_shares (
  id uuid primary key,
  user_id uuid not null references public.profiles (id) on delete cascade,
  referral_code text,
  wine_name text not null,
  winery text not null default '',
  vintage text not null default '',
  score_label text not null,
  image_path text not null,
  created_at timestamptz not null default now()
);

alter table public.wine_shares enable row level security;

revoke all on public.wine_shares from anon, authenticated;
grant select, insert on public.wine_shares to authenticated;

drop policy if exists wine_shares_select_own on public.wine_shares;
create policy wine_shares_select_own on public.wine_shares
  for select
  to authenticated
  using ((select auth.uid()) = user_id);

drop policy if exists wine_shares_insert_own on public.wine_shares;
create policy wine_shares_insert_own on public.wine_shares
  for insert
  to authenticated
  with check ((select auth.uid()) = user_id);

insert into storage.buckets (id, name, public)
values ('share-cards', 'share-cards', true)
on conflict (id) do update set public = true;

drop policy if exists share_cards_insert on storage.objects;
create policy share_cards_insert on storage.objects
  for insert
  to authenticated
  with check (
    bucket_id = 'share-cards'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

alter table public.notifications drop constraint if exists notifications_type_check;

alter table public.notifications add constraint notifications_type_check
  check (type in (
    'reaction',
    'friend_request',
    'friend_accepted',
    'friend_badge_unlock',
    'friend_journey_complete',
    'wine_with_friend',
    'referral_qualified',
    'referral_joined'
  ));

create or replace function private.notify_referral_joined()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.referred_by is null or new.referral_status is distinct from 'pending' then
    return new;
  end if;

  if tg_op = 'UPDATE'
     and old.referral_status is not distinct from 'pending'
     and old.referred_by is not distinct from new.referred_by then
    return new;
  end if;

  begin
    insert into public.notifications (recipient_id, actor_id, type, payload)
    values (
      new.referred_by,
      new.id,
      'referral_joined',
      jsonb_build_object('role', 'referrer')
    );
  exception
    when others then
      raise warning 'referral join notice failed: %', sqlerrm;
  end;

  return new;
end;
$$;

revoke all on function private.notify_referral_joined() from public, anon, authenticated;

drop trigger if exists profiles_notify_referral_joined on public.profiles;

create trigger profiles_notify_referral_joined
  after insert or update of referral_status, referred_by
  on public.profiles
  for each row
  execute function private.notify_referral_joined();
