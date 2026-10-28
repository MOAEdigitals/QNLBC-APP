begin;
do $$
declare results boolean[];
begin
  if has_function_privilege('anon','public.list_directory_members()','execute') then raise exception 'Anonymous directory access remains'; end if;
  if has_function_privilege('authenticated','public.consume_username_login_limit(text)','execute') then raise exception 'Login counter exposed to members'; end if;
  if exists(select 1 from information_schema.role_table_grants where table_schema='public' and grantee in ('anon','authenticated') and privilege_type='TRUNCATE') then raise exception 'TRUNCATE remains'; end if;
  select array_agg(public.consume_username_login_limit(repeat('a',64))) into results from generate_series(1,9);
  if results <> array[true,true,true,true,true,true,true,true,false] then raise exception 'Login throttle did not block attempt 9'; end if;
  update qnlbc_private.username_login_limits set window_start=now()-interval '61 seconds';
  if not public.consume_username_login_limit(repeat('a',64)) then raise exception 'Login throttle did not recover'; end if;
end;
$$;
rollback;
