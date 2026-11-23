-- A social post can name the person a friend drank with, even when the
-- viewer is not friends with that person. Only the display name is returned,
-- and only when it appears on a wine the viewer can already see.

create or replace function public.tagged_friend_names(ids uuid[])
returns table (id uuid, display_name text)
language sql
stable
security definer
set search_path = public
as $$
  select p.id, p.display_name
  from public.profiles p
  where auth.uid() is not null
    and ids is not null
    and p.id = any(ids[1:64])
    and not private.users_are_blocked(auth.uid(), p.id)
    and (
      private.can_view_profile(auth.uid(), p.id)
      or exists (
        select 1
        from public.wines w
        where p.id = any(w.with_friend_ids)
          and (
            w.user_id = auth.uid()
            or (
              private.are_friends(auth.uid(), w.user_id)
              and not private.users_are_blocked(auth.uid(), w.user_id)
            )
          )
      )
    );
$$;

revoke all on function public.tagged_friend_names(uuid[]) from public;
grant execute on function public.tagged_friend_names(uuid[]) to authenticated;
