-- Optional admin-controlled reminders; no existing schedules or records are changed.
alter table public.notification_schedule_settings drop constraint notification_schedule_settings_kind_check;
alter table public.notification_schedule_settings add constraint notification_schedule_settings_kind_check
  check(kind in ('birthday','event','prayer','sunday','practice','anniversary','recognition'));
insert into public.notification_schedule_settings(kind,enabled,local_time,days_before)
values ('anniversary',false,'07:00',0),('recognition',false,'07:00',0);
alter table public.assignment_notifications add column anniversary_id uuid references public.anniversaries(id), add column recognition_id uuid references public.recognitions(id);
alter table public.assignment_notifications drop constraint assignment_notifications_kind_check;
alter table public.assignment_notifications add constraint assignment_notifications_kind_check
 check(kind in ('assigned','updated','removed','practice','announcement','birthday','event','anniversary','recognition'));
-- Preserve every existing target rule and add distinct targets for the new reminders.
do $$ declare old_rule text; begin
 select pg_get_expr(conbin,conrelid) into old_rule from pg_constraint where conrelid='public.assignment_notifications'::regclass and conname='notification_target_check';
 alter table public.assignment_notifications drop constraint notification_target_check;
 execute 'alter table public.assignment_notifications add constraint notification_target_check check (('||old_rule||') or (kind in (''anniversary'',''recognition'') and setlist_id is null and slot is null and announcement_id is null and birthday_id is null and activity_id is null and service_date is not null))';
end $$;
alter table public.assignment_notifications add constraint recognition_target_check check
 ((kind='anniversary')=(anniversary_id is not null) and (kind='recognition')=(recognition_id is not null));
create index assignment_notifications_anniversary_id_idx on public.assignment_notifications(anniversary_id) where anniversary_id is not null;
create index assignment_notifications_recognition_id_idx on public.assignment_notifications(recognition_id) where recognition_id is not null;

create function qnlbc_private.queue_recognition_reminders(clock timestamptz default now())
returns integer language plpgsql security definer set search_path='' as $$
declare added integer:=0; n integer;
begin
 if qnlbc_private.reminder_due('anniversary',clock) then
   with created as (
     insert into public.assignment_notifications(user_id,kind,anniversary_id,service_date,title,body,event_key)
     select p.id,'anniversary',a.id,qnlbc_private.reminder_day('anniversary',clock),'Anniversary reminder: '||a.title,
       a.title||' — '||a.type||' anniversary on '||to_char(qnlbc_private.reminder_day('anniversary',clock),'FMMonth FMDD')||'.',
       'anniversary:'||a.id::text||':'||qnlbc_private.reminder_day('anniversary',clock)::text
     from public.anniversaries a cross join public.profiles p
     where p.active and a.deleted_at is null
       and to_char(a.anniversary_date,'MM-DD')=to_char(qnlbc_private.reminder_day('anniversary',clock),'MM-DD')
     on conflict(user_id,event_key) do nothing returning id,user_id
   ), deliveries as (
     insert into qnlbc_private.push_deliveries(notification_id,device_id)
     select c.id,d.id from created c join public.push_devices d on d.user_id=c.user_id on conflict do nothing returning id
   ) select count(*) into n from created;
   added:=added+n;
 end if;
 if qnlbc_private.reminder_due('recognition',clock) then
   with created as (
     insert into public.assignment_notifications(user_id,kind,recognition_id,service_date,title,body,event_key)
     select p.id,'recognition',r.id,r.recognition_date,'Recognition reminder: '||r.name,
       r.name||' — '||case when r.recognition_type='Custom' then coalesce(r.custom_type,'Recognition') else r.recognition_type end||' on '||to_char(r.recognition_date,'FMMonth FMDD, YYYY')||'.',
       'recognition:'||r.id::text||':'||r.recognition_date::text
     from public.recognitions r cross join public.profiles p
     where p.active and r.deleted_at is null and r.recognition_date=qnlbc_private.reminder_day('recognition',clock)
     on conflict(user_id,event_key) do nothing returning id,user_id
   ), deliveries as (
     insert into qnlbc_private.push_deliveries(notification_id,device_id)
     select c.id,d.id from created c join public.push_devices d on d.user_id=c.user_id on conflict do nothing returning id
   ) select count(*) into n from created;
   added:=added+n;
 end if;
 return added;
end; $$;
revoke all on function qnlbc_private.queue_recognition_reminders(timestamptz) from public,anon,authenticated;
create or replace function qnlbc_private.queue_configured_notifications()
returns void language plpgsql security definer set search_path='' as $$
begin
 perform qnlbc_private.queue_calendar_reminders();
 perform qnlbc_private.queue_service_reminders();
 perform qnlbc_private.queue_practice_reminders();
 perform qnlbc_private.queue_scheduled_announcements();
 perform qnlbc_private.queue_recognition_reminders();
end; $$;
revoke all on function qnlbc_private.queue_configured_notifications() from public,anon,authenticated;
