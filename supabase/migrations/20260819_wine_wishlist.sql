-- Want-to-try wishlist: same wines table, status distinguishes tried vs bookmarked.

alter table public.wines
  add column if not exists status text not null default 'tried'
  check (status in ('tried', 'wishlist'));
