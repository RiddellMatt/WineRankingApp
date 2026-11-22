-- Optional tried-on date and cellar photos. Photos live in a public bucket so
-- friends can see them on a shared cellar card; writes stay in the owner's folder.

alter table public.wines
  add column if not exists tried_on date,
  add column if not exists photo_urls text[] not null default '{}';

insert into storage.buckets (id, name, public)
values ('wine-photos', 'wine-photos', true)
on conflict (id) do update set public = true;

drop policy if exists wine_photos_select on storage.objects;
create policy wine_photos_select on storage.objects
  for select
  using (bucket_id = 'wine-photos');

drop policy if exists wine_photos_insert on storage.objects;
create policy wine_photos_insert on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'wine-photos'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists wine_photos_update on storage.objects;
create policy wine_photos_update on storage.objects
  for update to authenticated
  using (
    bucket_id = 'wine-photos'
    and (storage.foldername(name))[1] = auth.uid()::text
  )
  with check (
    bucket_id = 'wine-photos'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists wine_photos_delete on storage.objects;
create policy wine_photos_delete on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'wine-photos'
    and (storage.foldername(name))[1] = auth.uid()::text
  );
