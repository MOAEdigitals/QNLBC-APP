-- Account owners may change only their own compressed profile image.
create or replace function public.update_my_avatar(new_avatar text)
returns void language plpgsql security definer set search_path='' as $$
begin
  if not qnlbc_private.is_active_account() then raise exception 'An active account is required.'; end if;
  if new_avatar is not null and (length(new_avatar)>100000 or new_avatar !~ '^data:image/jpeg;base64,[A-Za-z0-9+/]+={0,2}$') then
    raise exception 'Choose a compressed JPEG profile picture.';
  end if;
  update public.profiles set avatar_url=new_avatar where id=(select auth.uid()) and active;
  if not found then raise exception 'Account unavailable.'; end if;
end;
$$;
revoke all on function public.update_my_avatar(text) from public, anon;
grant execute on function public.update_my_avatar(text) to authenticated;

-- Only directory-linked active accounts appear beside assignment names.
create or replace function public.list_directory_avatars()
returns table(member_id uuid, name text, avatar_url text)
language sql stable security definer set search_path='' as $$
  select d.id,d.name,p.avatar_url from public.directory_members d
  join public.profiles p on p.directory_member_id=d.id
  where qnlbc_private.is_active_account() and d.active and p.active and p.avatar_url is not null;
$$;
revoke all on function public.list_directory_avatars() from public, anon;
grant execute on function public.list_directory_avatars() to authenticated;

do $$ begin
  if exists(select 1 from pg_publication where pubname='supabase_realtime') and not exists(select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename='assignment_notifications') then
    alter publication supabase_realtime add table public.assignment_notifications;
  end if;
end $$;
