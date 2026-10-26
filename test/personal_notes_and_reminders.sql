-- Run against the configured project in a transaction. Nothing is sent or saved.
begin;
select set_config('qnlbc.test_owner',(select id::text from public.profiles where active and role='admin' limit 1),true);
select set_config('qnlbc.test_other',(select id::text from public.profiles where active and id<>current_setting('qnlbc.test_owner')::uuid limit 1),true);
select set_config('qnlbc.test_note',gen_random_uuid()::text,true);
select set_config('request.jwt.claim.sub',current_setting('qnlbc.test_owner'),true);
set local role authenticated;
insert into public.personal_notes(id,user_id,title,body) values(current_setting('qnlbc.test_note')::uuid,auth.uid(),'PRAYER ADVANCE',E'First Part\n6:00 - 6:10 Singspiration\n\t6:10 - 6:20 Self Searching\n');
do $$ begin
  assert (select revision=1 and body=E'First Part\n6:00 - 6:10 Singspiration\n\t6:10 - 6:20 Self Searching\n' from public.personal_notes where id=current_setting('qnlbc.test_note')::uuid), 'Note formatting changed';
end $$;
select set_config('request.jwt.claim.sub',current_setting('qnlbc.test_other'),true);
do $$ declare n int; begin
  assert not exists(select 1 from public.personal_notes where id=current_setting('qnlbc.test_note')::uuid), 'Other account can read note';
  update public.personal_notes set body='Wrong account' where id=current_setting('qnlbc.test_note')::uuid;
  get diagnostics n=row_count; assert n=0, 'Other account can update note';
end $$;
select set_config('request.jwt.claim.sub',current_setting('qnlbc.test_owner'),true);
update public.personal_notes set deleted_at=now() where id=current_setting('qnlbc.test_note')::uuid and revision=1;
update public.personal_notes set deleted_at=null where id=current_setting('qnlbc.test_note')::uuid and revision=2;
do $$ begin assert (select revision=3 and deleted_at is null from public.personal_notes where id=current_setting('qnlbc.test_note')::uuid), 'Note restore failed'; end $$;
reset role;

select set_config('qnlbc.test_birthday',gen_random_uuid()::text,true);
select set_config('qnlbc.test_event',gen_random_uuid()::text,true);
select set_config('qnlbc.test_routine',gen_random_uuid()::text,true);
select set_config('qnlbc.test_device',gen_random_uuid()::text,true);
insert into public.birthdays(id,name,birth_date) values(current_setting('qnlbc.test_birthday')::uuid,'TEST birthday rollback only',make_date(2000,extract(month from now() at time zone 'Asia/Manila')::int,extract(day from now() at time zone 'Asia/Manila')::int));
insert into public.church_activities(id,title,activity_date,activity_time) values
  (current_setting('qnlbc.test_event')::uuid,'TEST special fellowship rollback only',(now() at time zone 'Asia/Manila')::date+1,'10:00'),
  (current_setting('qnlbc.test_routine')::uuid,'Sunday Service',(now() at time zone 'Asia/Manila')::date+1,'09:00');
insert into public.push_devices(device_id,user_id,token) values(current_setting('qnlbc.test_device')::uuid,current_setting('qnlbc.test_owner')::uuid,'test-only-calendar-notification-token-no-real-device');
do $$ declare day date:=(now() at time zone 'Asia/Manila')::date; n int; begin
  perform qnlbc_private.queue_calendar_reminders((day+time '06:59') at time zone 'Asia/Manila');
  assert not exists(select 1 from public.assignment_notifications where birthday_id=current_setting('qnlbc.test_birthday')::uuid), 'Birthday queued before 7 AM';
  perform qnlbc_private.queue_calendar_reminders((day+time '07:00') at time zone 'Asia/Manila');
  select count(*) into n from public.assignment_notifications where birthday_id=current_setting('qnlbc.test_birthday')::uuid;
  assert n=(select count(*) from public.profiles where active), 'Birthday must reach all active users';
  perform qnlbc_private.queue_calendar_reminders((day+time '07:10') at time zone 'Asia/Manila');
  assert n=(select count(*) from public.assignment_notifications where birthday_id=current_setting('qnlbc.test_birthday')::uuid), 'Repeated scheduler created duplicates';
  assert not exists(select 1 from public.assignment_notifications where activity_id=current_setting('qnlbc.test_event')::uuid), 'Event queued before 8 AM';
  perform qnlbc_private.queue_calendar_reminders((day+time '08:00') at time zone 'Asia/Manila');
  assert (select count(*) from public.assignment_notifications where activity_id=current_setting('qnlbc.test_event')::uuid)=(select count(*) from public.profiles where active), 'Tomorrow event must reach all active users';
  assert not exists(select 1 from public.assignment_notifications where activity_id=current_setting('qnlbc.test_routine')::uuid), 'Routine service incorrectly treated as special event';
  assert exists(select 1 from qnlbc_private.push_deliveries q join public.assignment_notifications a on a.id=q.notification_id where a.birthday_id=current_setting('qnlbc.test_birthday')::uuid), 'Birthday has no device delivery';
end $$;
select set_config('qnlbc.test_notification',(select id::text from public.assignment_notifications where birthday_id=current_setting('qnlbc.test_birthday')::uuid and user_id=current_setting('qnlbc.test_owner')::uuid),true);
select set_config('request.jwt.claim.sub',current_setting('qnlbc.test_other'),true);
set local role authenticated;
do $$ begin
  begin perform public.set_notification_dismissed(current_setting('qnlbc.test_notification')::uuid,true); raise exception 'Other user dismissed notification'; exception when insufficient_privilege then null; end;
end $$;
select set_config('request.jwt.claim.sub',current_setting('qnlbc.test_owner'),true);
select public.set_notification_dismissed(current_setting('qnlbc.test_notification')::uuid,true);
do $$ begin assert not exists(select 1 from public.assignment_notifications where id=current_setting('qnlbc.test_notification')::uuid), 'Dismissed log still visible'; end $$;
select public.set_notification_dismissed(current_setting('qnlbc.test_notification')::uuid,false);
do $$ begin assert exists(select 1 from public.assignment_notifications where id=current_setting('qnlbc.test_notification')::uuid), 'Undo did not restore log'; end $$;
reset role;
select jsonb_build_object('personal_note_isolation',true,'note_formatting_and_restore',true,'birthday_7am_and_idempotence',true,'special_event_8am_day_before',true,'notification_delete_owner_only_and_undo',true) verified;
rollback;
