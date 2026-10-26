-- Transactional integration test: no accounts, inbox rows, or pushes survive rollback.
begin;
create function pg_temp.announcement_check(ok boolean,message text) returns void language plpgsql as $$ begin if ok is distinct from true then raise exception '%',message; end if; end; $$;
insert into auth.users(id,raw_user_meta_data) values
 ('cd260000-0000-0000-0000-000000000001','{"username":"announcement.test.admin"}'),
 ('cd260000-0000-0000-0000-000000000002','{"username":"announcement.test.member"}'),
 ('cd260000-0000-0000-0000-000000000003','{"username":"announcement.test.other"}');
update public.profiles set role='admin' where id='cd260000-0000-0000-0000-000000000001';
select set_config('request.jwt.claim.sub','cd260000-0000-0000-0000-000000000002',true);
select public.register_push_device('cd260000-0000-0000-0000-000000000009','announcement-test-token-1234567890');
set local role authenticated;
do $$ begin
 begin perform public.send_admin_announcement(gen_random_uuid(),'Denied','Denied',array['cd260000-0000-0000-0000-000000000002'::uuid]); raise exception 'Member send was allowed'; exception when insufficient_privilege then null; end;
 begin perform public.list_announcement_recipients(); raise exception 'Member recipient access allowed'; exception when insufficient_privilege then null; end;
 begin perform public.list_admin_announcements(); raise exception 'Member history access allowed'; exception when insufficient_privilege then null; end;
end; $$;
select set_config('request.jwt.claim.sub','cd260000-0000-0000-0000-000000000001',true);
select public.send_admin_announcement('cd260000-0000-0000-0000-000000000010','  Test title  ',' Test body ',array['cd260000-0000-0000-0000-000000000002'::uuid,'cd260000-0000-0000-0000-000000000003'::uuid,'cd260000-0000-0000-0000-000000000002'::uuid]);
select public.send_admin_announcement('cd260000-0000-0000-0000-000000000010','Test title','Test body',array['cd260000-0000-0000-0000-000000000003'::uuid,'cd260000-0000-0000-0000-000000000002'::uuid]);
select pg_temp.announcement_check(jsonb_array_length(public.list_admin_announcements()->0->'recipients')=2,'History must include unique recipients');
do $$ declare rejected boolean:=false; begin
 begin perform public.send_admin_announcement('cd260000-0000-0000-0000-000000000010','Changed','Test body',array['cd260000-0000-0000-0000-000000000002'::uuid]); exception when raise_exception then rejected:=true; end;
 if not rejected then raise exception 'Request reuse must reject different content'; end if;
 rejected:=false;
 begin perform public.send_admin_announcement(gen_random_uuid(),'Title','Body',array[]::uuid[]); exception when raise_exception then rejected:=true; end;
 if not rejected then raise exception 'Empty recipients accepted'; end if;
 rejected:=false;
 begin perform public.send_admin_announcement(gen_random_uuid(),'Title','Body',array[null::uuid]); exception when raise_exception then rejected:=true; end;
 if not rejected then raise exception 'Null recipient accepted'; end if;
end; $$;
select set_config('request.jwt.claim.sub','cd260000-0000-0000-0000-000000000002',true);
select pg_temp.announcement_check((select count(*)=1 from public.assignment_notifications where announcement_id='cd260000-0000-0000-0000-000000000010'),'Member sees only their own inbox');
select public.mark_assignment_notification_read((select id from public.assignment_notifications where announcement_id='cd260000-0000-0000-0000-000000000010'));
reset role;
select pg_temp.announcement_check((select count(*)=2 from public.assignment_notifications where announcement_id='cd260000-0000-0000-0000-000000000010'),'Retry must not duplicate notifications');
select pg_temp.announcement_check((select count(*)=1 from qnlbc_private.push_deliveries d join public.assignment_notifications n on n.id=d.notification_id where n.announcement_id='cd260000-0000-0000-0000-000000000010'),'Only enabled devices queued');
select set_config('request.jwt.claim.role','service_role',true);
select pg_temp.announcement_check((select count(*)=1 from public.claim_assignment_pushes(50) where notification_id in(select id from public.assignment_notifications where announcement_id='cd260000-0000-0000-0000-000000000010') and setlist_id is null),'Standalone announcements must survive claiming without a setlist');
update public.profiles set active=false where id='cd260000-0000-0000-0000-000000000003';
select set_config('request.jwt.claim.sub','cd260000-0000-0000-0000-000000000001',true);
do $$ declare rejected boolean:=false; begin
 begin perform public.send_admin_announcement(gen_random_uuid(),'Title','Body',array['cd260000-0000-0000-0000-000000000003'::uuid]); exception when raise_exception then rejected:=true; end;
 if not rejected then raise exception 'Inactive recipient accepted'; end if;
end; $$;
set local role anon;
do $$ begin
 begin perform public.list_announcement_recipients(); raise exception 'Anonymous recipient access allowed'; exception when insufficient_privilege then null; end;
end; $$;
reset role;
rollback;
