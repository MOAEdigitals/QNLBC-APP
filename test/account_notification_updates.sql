begin;
create temp table test_people as select id,row_number() over(order by id) n from public.profiles where active and role='user' limit 2;
create temp table test_notice as select gen_random_uuid() announcement, gen_random_uuid() own_notice,gen_random_uuid() other_notice;
insert into public.admin_announcements(id,sender_id,title,body) select announcement,(select id from public.profiles where active and role='admin' limit 1),'Transactional test','Not delivered' from test_notice;
insert into public.assignment_notifications(id,user_id,kind,title,body,event_key,announcement_id)
 select case when p.n=1 then t.own_notice else t.other_notice end,p.id,'announcement','Transactional test','Not delivered','verify:'||gen_random_uuid()::text,t.announcement from test_people p cross join test_notice t;
select set_config('request.jwt.claim.sub',(select id::text from test_people where n=1),true);
select set_config('request.jwt.claim.role','authenticated',true);
select set_config('qnlbc.test.own',(select own_notice::text from test_notice),true);
select set_config('qnlbc.test.other',(select other_notice::text from test_notice),true);
set local role authenticated;
select public.mark_notifications_read(array[current_setting('qnlbc.test.own')::uuid,current_setting('qnlbc.test.other')::uuid]);
reset role;
do $$begin
 if not exists(select 1 from public.assignment_notifications where id=current_setting('qnlbc.test.own')::uuid and read_at is not null) then raise exception 'Own unread badge was not cleared'; end if;
 if exists(select 1 from public.assignment_notifications where id=current_setting('qnlbc.test.other')::uuid and read_at is not null) then raise exception 'Other account was marked read'; end if;
end$$;
update public.assignment_notifications set read_at=null where id=current_setting('qnlbc.test.own')::uuid;
set local role authenticated;
select public.set_notification_dismissed(current_setting('qnlbc.test.own')::uuid,true);
select public.set_notification_dismissed(current_setting('qnlbc.test.own')::uuid,false);
reset role;
do $$begin
 if not exists(select 1 from public.assignment_notifications where id=current_setting('qnlbc.test.own')::uuid and read_at is not null and dismissed_at is null) then raise exception 'Delete/undo did not preserve read status'; end if;
end$$;
select jsonb_build_object('bulk_read_is_owner_only',true,'delete_clears_unread',true,'undo_restores_as_read',true,'anonymous_calls_blocked',not has_function_privilege('anon','public.mark_notifications_read(uuid[])','execute')) verification;
rollback;
