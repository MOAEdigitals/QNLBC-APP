-- Transaction only: no pushes can leave the queue before rollback.
begin;
select set_config('qnlbc.schedule_admin',(select id::text from public.profiles where active and role='admin' limit 1),true);
select set_config('qnlbc.schedule_member',(select id::text from public.profiles where active and role<>'admin' and directory_member_id is null limit 1),true);
-- CI already has unlinked accounts; production has pastor and team accounts.
do $$ begin assert nullif(current_setting('qnlbc.schedule_member'),'') is not null,'Unlinked test recipient required'; end $$;
select set_config('qnlbc.schedule_sunday',gen_random_uuid()::text,true);
select set_config('qnlbc.schedule_prayer',gen_random_uuid()::text,true);
insert into public.church_activities(id,title,activity_date) values
 (current_setting('qnlbc.schedule_sunday')::uuid,'Sunday Service','2031-01-05'),
 (current_setting('qnlbc.schedule_prayer')::uuid,'Midweek Prayer Meeting','2031-01-08');
do $$ declare n integer; begin
 perform qnlbc_private.queue_service_reminders('2031-01-05 05:59+08');
 assert not exists(select 1 from public.assignment_notifications where activity_id=current_setting('qnlbc.schedule_sunday')::uuid),'Sunday fired early';
 perform qnlbc_private.queue_service_reminders('2031-01-05 06:00+08');
 select count(*) into n from public.assignment_notifications where activity_id=current_setting('qnlbc.schedule_sunday')::uuid;
 assert n=(select count(*) from public.profiles where active),'Sunday missed accounts';
 assert exists(select 1 from public.assignment_notifications where activity_id=current_setting('qnlbc.schedule_sunday')::uuid and user_id=current_setting('qnlbc.schedule_member')::uuid),'Unlinked account missed service';
 perform qnlbc_private.queue_service_reminders('2031-01-05 06:01+08');
 assert n=(select count(*) from public.assignment_notifications where activity_id=current_setting('qnlbc.schedule_sunday')::uuid),'Duplicate Sunday reminders';
 perform qnlbc_private.queue_service_reminders('2031-01-08 15:59+08');
 assert not exists(select 1 from public.assignment_notifications where activity_id=current_setting('qnlbc.schedule_prayer')::uuid),'Prayer fired early';
 perform qnlbc_private.queue_service_reminders('2031-01-08 16:00+08');
 assert (select count(*) from public.assignment_notifications where activity_id=current_setting('qnlbc.schedule_prayer')::uuid)=(select count(*) from public.profiles where active),'Prayer missed accounts';
 update public.notification_schedule_settings set local_time='17:15',weekdays=array[4] where kind='prayer';
 assert not qnlbc_private.reminder_due('prayer','2031-01-08 17:15+08'),'Deselected weekday fired';
 assert qnlbc_private.reminder_due('prayer','2031-01-09 17:15+08'),'Selected weekday did not fire';
 update public.notification_schedule_settings set enabled=false where kind='prayer';
 assert not qnlbc_private.reminder_due('prayer','2031-01-09 17:15+08'),'Disabled reminder fired';
end $$;
select set_config('qnlbc.schedule_notice',(select id::text from public.assignment_notifications where activity_id=current_setting('qnlbc.schedule_sunday')::uuid and user_id=current_setting('qnlbc.schedule_admin')::uuid),true);
select set_config('request.jwt.claim.sub',current_setting('qnlbc.schedule_member'),true);
set local role authenticated;
do $$ declare n integer; begin
 n:=public.mark_notifications_read(array[current_setting('qnlbc.schedule_notice')::uuid]); assert n=0,'Read another account notification';
 update public.notification_schedule_settings set local_time='11:00' where kind='sunday'; get diagnostics n=row_count; assert n=0,'Member changed admin schedule';
 assert public.mark_notifications_read(array[]::uuid[])=0,'Empty IDs marked all read';
 begin perform public.list_scheduled_announcements(); raise exception 'Member accessed schedules'; exception when insufficient_privilege then null; end;
end $$;
select set_config('request.jwt.claim.sub',current_setting('qnlbc.schedule_admin'),true);
do $$ begin
 assert public.mark_notifications_read(array[current_setting('qnlbc.schedule_notice')::uuid])=1,'Owner read failed';
 assert public.mark_notifications_read(array[current_setting('qnlbc.schedule_notice')::uuid])=0,'Read was not idempotent';
end $$;
reset role;
select set_config('qnlbc.custom_schedule',gen_random_uuid()::text,true);
select set_config('qnlbc.cancel_schedule',gen_random_uuid()::text,true);
select public.schedule_admin_announcement(current_setting('qnlbc.custom_schedule')::uuid,'TEST scheduled rollback','No real message sent',array[current_setting('qnlbc.schedule_member')::uuid],now()+interval '1 day');
select public.schedule_admin_announcement(current_setting('qnlbc.custom_schedule')::uuid,'TEST scheduled rollback','No real message sent',array[current_setting('qnlbc.schedule_member')::uuid],now()+interval '1 day');
select public.schedule_admin_announcement(current_setting('qnlbc.cancel_schedule')::uuid,'TEST cancelled rollback','No real message sent',array[current_setting('qnlbc.schedule_member')::uuid],now()+interval '1 day');
select public.cancel_scheduled_announcement(current_setting('qnlbc.cancel_schedule')::uuid);
do $$ begin
 assert not exists(select 1 from public.assignment_notifications where announcement_id=current_setting('qnlbc.custom_schedule')::uuid),'Scheduled message visible before due';
 perform qnlbc_private.queue_scheduled_announcements(now()+interval '1 day 1 minute');
 assert exists(select 1 from public.assignment_notifications where announcement_id=current_setting('qnlbc.custom_schedule')::uuid and user_id=current_setting('qnlbc.schedule_member')::uuid),'Due message missing';
 assert not exists(select 1 from public.assignment_notifications where announcement_id=current_setting('qnlbc.cancel_schedule')::uuid),'Cancelled message sent';
 assert qnlbc_private.queue_scheduled_announcements(now()+interval '1 day 2 minutes')=0,'Scheduled message duplicated';
end $$;
select 'Service times, independent accounts, weekday controls, read ownership, custom scheduling and cancellation verified' as verified;
rollback;
