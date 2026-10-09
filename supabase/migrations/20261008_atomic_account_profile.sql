-- Keep Auth identity and its profile in the same database transaction.
-- Roles, active status, permissions and avatars never come from user metadata.
begin;
create unique index if not exists profiles_username_lower_uidx
  on public.profiles(lower(username));

create or replace function public.handle_new_auth_user()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  handle text := lower(trim(coalesce(new.raw_user_meta_data->>'username', '')));
begin
  if handle = '' then
    handle := 'member_' || replace(new.id::text, '-', '');
  elsif handle !~ '^[a-z0-9_.-]{3,40}$' then
    raise exception 'Invalid username';
  end if;
  insert into public.profiles(id, username, display_name)
  values(new.id, handle, coalesce(nullif(trim(new.raw_user_meta_data->>'display_name'), ''), handle));
  return new;
end;
$$;

create or replace function public.sync_auth_profile_identity()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  handle text := lower(trim(coalesce(new.raw_user_meta_data->>'username', '')));
begin
  if (new.raw_user_meta_data->>'username') is not distinct from (old.raw_user_meta_data->>'username')
    and (new.raw_user_meta_data->>'display_name') is not distinct from (old.raw_user_meta_data->>'display_name') then
    return new;
  end if;
  if handle !~ '^[a-z0-9_.-]{3,40}$' then raise exception 'Invalid username'; end if;
  update public.profiles set username = handle,
    display_name = coalesce(nullif(trim(new.raw_user_meta_data->>'display_name'), ''), handle)
    where id = new.id;
  if not found then raise exception 'Account profile is missing'; end if;
  return new;
end;
$$;
create or replace trigger sync_auth_profile_identity after update of raw_user_meta_data on auth.users
for each row execute function public.sync_auth_profile_identity();
revoke all on function public.handle_new_auth_user() from public;
revoke all on function public.sync_auth_profile_identity() from public;
commit;
