\set ON_ERROR_STOP on
begin;
create function pg_temp.check_result(ok boolean,message text) returns void language plpgsql as $$ begin if ok is distinct from true then raise exception '%',message; end if; end; $$;
insert into auth.users(id,raw_user_meta_data) values('00000000-0000-0000-0000-000000000001','{"username":"admin","display_name":"Admin"}');
update public.profiles set role='admin' where username='admin';
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000001',true);
select public.save_directory_member(null,'Bro. Juan',true) as person1 \gset
select public.save_directory_member(null,'Bro. Pedro',true) as person2 \gset
insert into auth.users(id,raw_user_meta_data,raw_app_meta_data) values
 ('00000000-0000-0000-0000-000000000002','{"username":"juan.login","display_name":"Wrong name"}',jsonb_build_object('directory_member_id',:'person1')),
 ('00000000-0000-0000-0000-000000000003','{"username":"pedro.login","display_name":"Pedro"}',jsonb_build_object('directory_member_id',:'person2'));
select pg_temp.check_result((select display_name='Bro. Juan' from public.profiles where username='juan.login'),'Directory name must override supplied account name');
select ((now() at time zone 'Asia/Manila')::date + ((6-extract(dow from now() at time zone 'Asia/Manila')::int+7)%7)+7)::text as saturday \gset
insert into public.setlists(service_date,presider,worship_leader) values(:'saturday'::date+1,'Bro. Juan','Bro. Pedro') returning id as setlist \gset
select pg_temp.check_result((select count(*)=2 from public.assignment_notifications),'Both assignees should receive notifications');
update public.setlists set title='Updated songs only' where id=:'setlist';
select pg_temp.check_result((select count(*)=2 from public.assignment_notifications),'Ordinary saves must not resend assignments');
select public.save_directory_member(:'person1','Bro. Juan Updated',true);
select pg_temp.check_result((select count(*)=2 from public.assignment_notifications),'Renames must not resend assignments');
select pg_temp.check_result((select presider_member_id=:'person1'::uuid and presider='Bro. Juan Updated' from public.setlists where id=:'setlist'),'Rename must preserve assignment identity');
select pg_temp.check_result(qnlbc_private.queue_practice_reminders((:'saturday'||' 08:59:59+08')::timestamptz)=0,'No reminder before Saturday 9AM');
select pg_temp.check_result(qnlbc_private.queue_practice_reminders((:'saturday'||' 09:00:00+08')::timestamptz)=2,'Saturday 9AM must remind both assignees');
select pg_temp.check_result(qnlbc_private.queue_practice_reminders((:'saturday'||' 09:01:00+08')::timestamptz)=0,'Reminder retries must not duplicate history');
update public.setlists set presider='Bro. Pedro' where id=:'setlist';
select pg_temp.check_result((select count(*)=1 from public.assignment_notifications where kind='removed' and user_id='00000000-0000-0000-0000-000000000002'),'Previous assignee must receive removal');
select pg_temp.check_result((select count(*)=2 from public.assignment_notifications where kind='assigned' and user_id='00000000-0000-0000-0000-000000000003'),'New assignee must receive assignment');
update auth.users set raw_user_meta_data=raw_user_meta_data||jsonb_build_object('directory_member_id',:'person2') where id='00000000-0000-0000-0000-000000000002';
select pg_temp.check_result((select directory_member_id=:'person1'::uuid from public.profiles where id='00000000-0000-0000-0000-000000000002'),'User metadata cannot change notification identity');
set local role authenticated;
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000002',true);
select pg_temp.check_result((select count(*)=0 from public.assignment_notifications where user_id<>'00000000-0000-0000-0000-000000000002'),'Inbox must enforce recipient ownership');
select public.register_push_device('00000000-0000-0000-0000-000000000010','test-token-for-juan-device-1234567890');
do $$ declare blocked boolean:=false; begin
  begin perform public.save_directory_member(null,'Intruder',true); exception when insufficient_privilege then blocked:=true; end;
  if not blocked then raise exception 'Members cannot administer directory'; end if;
end; $$;
do $$ declare blocked boolean:=false; begin
  begin update public.profiles set directory_member_id=null where id=auth.uid(); exception when raise_exception then blocked:=true; end;
  if not blocked then raise exception 'Direct profile writes must not unlink notification identity'; end if;
end; $$;
select public.mark_assignment_notification_read((select id from public.assignment_notifications limit 1));
select pg_temp.check_result((select count(*)>=1 from public.assignment_notifications where read_at is not null),'Own notifications can be marked read');
reset role;
select pg_temp.check_result((select count(*)=0 from public.assignment_notifications where read_at is not null and user_id<>'00000000-0000-0000-0000-000000000002'),'Mark read must not affect another account');
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000003',true);
select public.register_push_device('00000000-0000-0000-0000-000000000011','test-token-for-pedro-device-1234567890');
update public.setlists set service_date=service_date+7 where id=:'setlist';
select pg_temp.check_result((select count(*)=2 from public.assignment_notifications where kind='updated'),'Date change notifies each assigned role');
select set_config('request.jwt.claim.role','service_role',true);
select count(*) as claimed from public.claim_assignment_pushes(50) \gset
select pg_temp.check_result(:'claimed'::int=2,'Only current assignment/date deliveries should be claimed');
update public.push_devices set token='refreshed-token-for-pedro-device-1234567890' where user_id='00000000-0000-0000-0000-000000000003';
select public.finish_assignment_push(id,lease_id,'invalid') from qnlbc_private.push_deliveries where state='leased' limit 1;
select pg_temp.check_result((select count(*)=1 from public.push_devices where token='refreshed-token-for-pedro-device-1234567890'),'Invalid old token response must not delete a refreshed token');
select public.finish_assignment_push(id,lease_id,'retry') from qnlbc_private.push_deliveries where state='leased';
select pg_temp.check_result((select count(*)=2 from qnlbc_private.push_deliveries where state='pending'),'Failed deliveries are queued for retry');
select public.unregister_push_device('00000000-0000-0000-0000-000000000011');
select pg_temp.check_result((select count(*)=0 from qnlbc_private.push_deliveries),'Logout removes outstanding device deliveries');
rollback;
