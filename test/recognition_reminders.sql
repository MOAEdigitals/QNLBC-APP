begin;
-- Transactional checks: generated notifications and deliveries are rolled back.
do $$
declare clock timestamptz; target date; expected integer; added integer;
begin
  update public.notification_schedule_settings set enabled=false where kind in ('anniversary','recognition');
  if qnlbc_private.queue_recognition_reminders(now()) <> 0 then raise exception 'Disabled reminders queued messages'; end if;
  select anniversary_date into target from public.anniversaries where deleted_at is null limit 1;
  if target is not null then
    clock := (target+time '07:00') at time zone 'Asia/Manila';
    update public.notification_schedule_settings set enabled=true,local_time='07:00',days_before=0,weekdays=array[0,1,2,3,4,5,6] where kind='anniversary';
    select count(*) into expected from public.anniversaries a cross join public.profiles p where p.active and a.deleted_at is null and to_char(a.anniversary_date,'MM-DD')=to_char(target,'MM-DD');
    added:=qnlbc_private.queue_recognition_reminders(clock);
    if added<>expected then raise exception 'Anniversary recipient count: % expected %',added,expected; end if;
    if qnlbc_private.queue_recognition_reminders(clock)<>0 then raise exception 'Anniversary reminders duplicated'; end if;
    if qnlbc_private.queue_recognition_reminders(clock+interval '1 year')<>expected then raise exception 'Anniversaries did not repeat next year'; end if;
  end if;
  update public.notification_schedule_settings set enabled=false where kind='anniversary';
  select recognition_date into target from public.recognitions where deleted_at is null limit 1;
  if target is not null then
    clock := (target+time '07:00') at time zone 'Asia/Manila';
    update public.notification_schedule_settings set enabled=true,local_time='07:00',days_before=0,weekdays=array[0,1,2,3,4,5,6] where kind='recognition';
    select count(*) into expected from public.recognitions r cross join public.profiles p where p.active and r.deleted_at is null and r.recognition_date=target;
    if qnlbc_private.queue_recognition_reminders(clock)<>expected then raise exception 'Recognition recipients incorrect'; end if;
    if qnlbc_private.queue_recognition_reminders(clock)<>0 then raise exception 'Recognition reminders duplicated'; end if;
    if qnlbc_private.queue_recognition_reminders(clock-interval '1 minute')<>0 then raise exception 'Reminder sent before configured time'; end if;
    update public.notification_schedule_settings set enabled=false where kind='recognition';
    if qnlbc_private.queue_recognition_reminders(clock)<>0 then raise exception 'Reminder ignores disabled state'; end if;
  end if;
  if has_function_privilege('authenticated','qnlbc_private.queue_recognition_reminders(timestamptz)','execute') or has_function_privilege('anon','qnlbc_private.queue_recognition_reminders(timestamptz)','execute') then raise exception 'Queue exposed to clients'; end if;
end $$;
rollback;
select 'Recognition reminders: yearly recurrence, deduplication, active recipients, disabled state, time and private access passed; no notifications sent' as result;
