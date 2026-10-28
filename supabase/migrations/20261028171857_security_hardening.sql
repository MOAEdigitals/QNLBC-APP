-- Restrict API privileges without changing current accounts or content.
do $$ declare t record; f record; begin
 for t in select schemaname,tablename from pg_tables where schemaname='public' loop
  execute format('revoke truncate, references, trigger on table %I.%I from anon, authenticated',t.schemaname,t.tablename);
 end loop;
 for f in select p.oid::regprocedure as signature, has_function_privilege('authenticated',p.oid,'execute') as allowed, p.prorettype from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.prosecdef loop
  execute format('revoke execute on function %s from public, anon',f.signature);
  if f.allowed and f.prorettype not in ('trigger'::regtype,'event_trigger'::regtype) then execute format('grant execute on function %s to authenticated',f.signature); end if;
  if f.prorettype in ('trigger'::regtype,'event_trigger'::regtype) then execute format('revoke execute on function %s from authenticated',f.signature); end if;
 end loop;
end; $$;
alter table public.profiles alter column can_upload set default false;

-- Short-lived, bounded login counters. Never store passwords or raw usernames.
create table qnlbc_private.username_login_limits(
 bucket text primary key,
 window_start timestamptz not null,
 attempts integer not null
);
alter table qnlbc_private.username_login_limits enable row level security;
revoke all on qnlbc_private.username_login_limits from public,anon,authenticated;

create function public.consume_username_login_limit(handle_hash text)
returns boolean language plpgsql security definer set search_path='' as $$
declare n integer; stamp timestamptz:=clock_timestamp(); key text;
begin
 if handle_hash !~ '^[0-9a-f]{64}$' then return false; end if;
 delete from qnlbc_private.username_login_limits where window_start < stamp-interval '10 minutes';
 -- Global first bounds the number of new per-handle rows created.
 foreach key in array array['global','handle:'||handle_hash] loop
  insert into qnlbc_private.username_login_limits as limits(bucket,window_start,attempts)
   values(key,stamp,1)
   on conflict(bucket) do update set
    attempts=case when limits.window_start <= stamp-interval '1 minute' then 1 else limits.attempts+1 end,
    window_start=case when limits.window_start <= stamp-interval '1 minute' then stamp else limits.window_start end
   returning attempts into n;
  if n > (case when key='global' then 120 else 8 end) then return false; end if;
 end loop;
 return true;
end; $$;
revoke all on function public.consume_username_login_limit(text) from public,anon,authenticated;
grant execute on function public.consume_username_login_limit(text) to service_role;
