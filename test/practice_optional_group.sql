-- Run in the Supabase SQL editor; all fixture changes are rolled back.
begin;
do $test$
declare actor uuid; practice_id uuid;
begin
  select id into actor from public.profiles where active and role='admin' limit 1;
  if actor is null then raise exception 'An active admin is required'; end if;
  perform set_config('request.jwt.claim.sub',actor::text,true);
  set local role authenticated;
  insert into public.practice_entries(group_name,song_title,target_date,practice_date,lyrics_mode)
    values('','Optional group test','2099-01-04','2099-01-04','live') returning id into practice_id;
  update public.practice_entries set group_name='Choir' where id=practice_id;
  update public.practice_entries set group_name='' where id=practice_id;
  if not exists(select 1 from public.practice_entries where id=practice_id and group_name='') then
    raise exception 'Optional group was not saved';
  end if;
  reset role;
end;
$test$;
rollback;
select 'PASS: practice can be created without a group, named, then cleared; test rows rolled back' as verification;
