-- OAuth profile metadata (Google / Apple sign-in)

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  meta_name text := coalesce(
    nullif(trim(new.raw_user_meta_data->>'display_name'), ''),
    nullif(trim(new.raw_user_meta_data->>'full_name'), ''),
    nullif(trim(new.raw_user_meta_data->>'name'), '')
  );
  meta_avatar text := coalesce(
    nullif(trim(new.raw_user_meta_data->>'avatar_url'), ''),
    nullif(trim(new.raw_user_meta_data->>'picture'), '')
  );
  email_name text := nullif(split_part(coalesce(new.email, ''), '@', 1), '');
begin
  insert into public.profiles (id, display_name, email, avatar_url)
  values (
    new.id,
    coalesce(meta_name, email_name, 'Wine lover'),
    coalesce(new.email, ''),
    meta_avatar
  );
  return new;
end;
$$;
