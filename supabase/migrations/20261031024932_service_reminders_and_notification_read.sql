create table public.notification_schedule_settings (
  kind text primary key check(kind in ('birthday','event','prayer','sunday','practice')),
  enabled boolean not null default true,
  local_time time not null check(extract(second from local_time)=0),
  days_before integer not null check(days_before between 0 and 30),
  weekdays integer[] not null default array[0,1,2,3,4,5,6] check(weekdays <@ array[0,1,2,3,4,5,6] and (not enabled or cardinality(weekdays)>0))
);
insert into public.notification_schedule_settings(kind,local_time,days_before) values
 ('birthday','07:00',0),('event','08:00',1),('prayer','16:00',0),('sunday','06:00',0),('practice','09:00',1);
update public.notification_schedule_settings set weekdays=array[3] where kind='prayer';
update public.notification_schedule_settings set weekdays=array[0] where kind='sunday';
update public.notification_schedule_settings set weekdays=array[6] where kind='practice';
alter table public.notification_schedule_settings enable row level security;
revoke all on public.notification_schedule_settings from anon,authenticated;
grant select,update on public.notification_schedule_settings to authenticated;
create policy schedule_admin_read on public.notification_schedule_settings for select to authenticated
using(exists(select 1 from public.profiles where id=(select auth.uid()) and active and role='admin'));
create policy schedule_admin_update on public.notification_schedule_settings for update to authenticated
using(exists(select 1 from public.profiles where id=(select auth.uid()) and active and role='admin'))
with check(exists(select 1 from public.profiles where id=(select auth.uid()) and active and role='admin'));

create function qnlbc_private.reminder_due(reminder_kind text, clock timestamptz)
returns boolean language sql stable set search_path='' as $$
 select coalesce((select enabled and extract(dow from clock at time zone 'Asia/Manila')::integer=any(weekdays) and (clock at time zone 'Asia/Manila')::time>=local_time
   and (clock at time zone 'Asia/Manila')::timestamp < ((clock at time zone 'Asia/Manila')::date+local_time+interval '1 hour')
 from public.notification_schedule_settings where kind=reminder_kind),false);
$$;
create function qnlbc_private.reminder_day(reminder_kind text, clock timestamptz)
returns date language sql stable set search_path='' as $$
 select (clock at time zone 'Asia/Manila')::date+days_before from public.notification_schedule_settings where kind=reminder_kind;
$$;
revoke all on function qnlbc_private.reminder_due(text,timestamptz),qnlbc_private.reminder_day(text,timestamptz) from public,anon,authenticated;

-- Account-owned read state; null IDs explicitly means every unread notification.
create function public.mark_notifications_read(notification_ids uuid[] default null)
returns integer language plpgsql security definer set search_path='' as $$
declare changed integer;
begin
  if not qnlbc_private.is_active_account() then raise exception 'Active account required' using errcode='42501'; end if;
  update public.assignment_notifications set read_at=now()
  where user_id=auth.uid() and read_at is null and dismissed_at is null
    and (notification_ids is null or id=any(notification_ids));
  get diagnostics changed=row_count;
  return changed;
end; $$;
revoke all on function public.mark_notifications_read(uuid[]) from public,anon,authenticated;
grant execute on function public.mark_notifications_read(uuid[]) to authenticated;

create function qnlbc_private.queue_service_reminders(clock timestamptz default now())
returns integer language plpgsql security definer set search_path='' as $$
declare local_clock timestamp:=clock at time zone 'Asia/Manila'; added integer;
begin
  with created as (
    insert into public.assignment_notifications(user_id,kind,activity_id,service_date,title,body,event_key)
    select p.id,'event',a.id,a.activity_date,'Service reminder: '||a.title,
      a.title||' is on '||to_char(a.activity_date,'FMMonth FMDD')||case when a.activity_time is null then '.' else ' at '||to_char(a.activity_time,'FMHH12:MI AM')||'.' end,
      'service:'||a.id::text||':'||a.activity_date::text
    from public.church_activities a cross join public.profiles p
    where p.active and (
      (a.title ~* '(prayer\s*meeting|midweek\s*prayer)' and a.activity_date=qnlbc_private.reminder_day('prayer',clock) and qnlbc_private.reminder_due('prayer',clock))
      or (a.title ~* 'sunday\s*service' and extract(dow from a.activity_date)=0 and a.activity_date=qnlbc_private.reminder_day('sunday',clock) and qnlbc_private.reminder_due('sunday',clock))
    )
    on conflict(user_id,event_key) do nothing returning id,user_id
  ), deliveries as (
    insert into qnlbc_private.push_deliveries(notification_id,device_id)
    select c.id,d.id from created c join public.push_devices d on d.user_id=c.user_id
    on conflict do nothing returning id
  ) select count(*) into added from created;
  return added;
end; $$;
revoke all on function qnlbc_private.queue_service_reminders(timestamptz) from public,anon,authenticated;
-- Existing minute-by-minute dispatcher delivers these with the same FCM queue.
-- UTC 08:00 = 4 PM Manila; Saturday UTC 22:00 = Sunday 6 AM Manila.

create or replace function qnlbc_private.queue_calendar_reminders(clock timestamptz default now())
returns integer language plpgsql security definer set search_path='' as $$
declare local_clock timestamp:=clock at time zone 'Asia/Manila'; local_day date:=local_clock::date; added integer:=0; n integer;
begin
  if qnlbc_private.reminder_due('birthday',clock) then
    with created as (
      insert into public.assignment_notifications(user_id,kind,birthday_id,service_date,title,body,event_key)
      select p.id,'birthday',b.id,qnlbc_private.reminder_day('birthday',clock),'Birthday reminder: '||b.name,
        'Let’s greet '||b.name||' a happy birthday on '||to_char(qnlbc_private.reminder_day('birthday',clock),'FMMonth FMDD')||'!', 'birthday:'||b.id::text||':'||qnlbc_private.reminder_day('birthday',clock)::text
      from public.birthdays b cross join public.profiles p
      where p.active and b.deleted_at is null
        and extract(month from b.birth_date)=extract(month from qnlbc_private.reminder_day('birthday',clock))
        and extract(day from b.birth_date)=extract(day from qnlbc_private.reminder_day('birthday',clock))
      on conflict(user_id,event_key) do nothing returning id,user_id
    ), deliveries as (
      insert into qnlbc_private.push_deliveries(notification_id,device_id)
      select c.id,d.id from created c join public.push_devices d on d.user_id=c.user_id
      on conflict do nothing returning id
    ) select count(*) into n from created;
    added:=added+n;
  end if;
  if qnlbc_private.reminder_due('event',clock) then
    with created as (
      insert into public.assignment_notifications(user_id,kind,activity_id,service_date,title,body,event_key)
      select p.id,'event',a.id,a.activity_date,'Event reminder: '||a.title,
        a.title||' is on '||to_char(a.activity_date,'FMMonth FMDD, YYYY')||case when a.activity_time is null then '.' else ' at '||to_char(a.activity_time,'FMHH12:MI AM')||'.' end,
        'event:'||a.id::text||':'||a.activity_date::text
      from public.church_activities a cross join public.profiles p
      where p.active and a.activity_date=qnlbc_private.reminder_day('event',clock)
        and a.title !~* '(prayer\s*meeting|midweek\s*prayer|sunday\s*service|(song\s*leaders?|choir).*practice|practice.*(song\s*leaders?|choir)|saturday.*practice)'
      on conflict(user_id,event_key) do nothing returning id,user_id
    ), deliveries as (
      insert into qnlbc_private.push_deliveries(notification_id,device_id)
      select c.id,d.id from created c join public.push_devices d on d.user_id=c.user_id
      on conflict do nothing returning id
    ) select count(*) into n from created;
    added:=added+n;
  end if;
  return added;
end; $$;
revoke all on function qnlbc_private.queue_calendar_reminders(timestamptz) from public,anon,authenticated;


create or replace function qnlbc_private.queue_assignment_notification(person uuid, target_setlist uuid, event_kind text, event_slot text, event_date date, event_key text)
returns void language plpgsql security definer set search_path='' as $$
declare recipient uuid; notification uuid; label text;
begin
  select p.id into recipient from public.profiles p join public.directory_members d on d.id=p.directory_member_id
    where p.directory_member_id=person and p.active and d.active;
  if recipient is null then return; end if;
  label:=case event_slot when 'presider' then 'Presider' when 'sunday_school' then 'Sunday School Song Leader'
    when 'worship' then 'Worship Service Song Leader' else 'Song Leader' end;
  insert into public.assignment_notifications(user_id,setlist_id,kind,slot,service_date,title,body,event_key)
  values(recipient,target_setlist,event_kind,event_slot,event_date,
    case event_kind when 'assigned' then 'New assignment: ' when 'removed' then 'Assignment removed: '
      when 'practice' then 'Assignment reminder: ' else 'Assignment updated: ' end || label,
    case event_kind when 'removed' then 'You are no longer assigned as '
      when 'practice' then 'Reminder: You are assigned as ' else 'You are assigned as ' end
      || label || ' for ' || to_char(event_date,'FMMonth FMDD, YYYY') || '. Tap to view the setlist.',event_key)
  on conflict on constraint assignment_notifications_user_id_event_key_key do nothing returning id into notification;
  if notification is not null then
    insert into qnlbc_private.push_deliveries(notification_id,device_id)
      select notification,id from public.push_devices where user_id=recipient on conflict do nothing;
  end if;
end; $$;


create or replace function qnlbc_private.queue_practice_reminders(clock timestamptz default now())
returns int language plpgsql security definer set search_path='' as $$
declare local_time timestamp:=clock at time zone 'Asia/Manila'; s public.setlists; p record; count_before bigint;
begin
  if not qnlbc_private.reminder_due('practice',clock) then return 0; end if;
  select count(*) into count_before from public.assignment_notifications where kind='practice';
  for s in select * from public.setlists where deleted_at is null and coalesce(type,'sunday')='sunday' and service_date=qnlbc_private.reminder_day('practice',clock) and extract(dow from service_date)=0 loop
    for p in select * from qnlbc_private.assignment_people(s) loop
      perform qnlbc_private.queue_assignment_notification(p.member_id,s.id,'practice',p.slot,s.service_date,
        'practice:'||s.id::text||':'||s.service_date::text||':'||p.slot||':'||p.member_id::text);
    end loop;
  end loop;
  return (select count(*) from public.assignment_notifications where kind='practice')-count_before;
end; $$;


-- Scheduled custom messages are private until their selected send time.
create table qnlbc_private.scheduled_announcements (
 id uuid primary key, sender_id uuid not null references public.profiles(id),
 title text not null check(length(title) between 1 and 120), body text not null check(length(body) between 1 and 2000),
 recipient_ids uuid[] not null, scheduled_at timestamptz not null,
 state text not null default 'pending' check(state in ('pending','sent','cancelled')),
 created_at timestamptz not null default now()
);
alter table qnlbc_private.scheduled_announcements enable row level security;
revoke all on qnlbc_private.scheduled_announcements from public,anon,authenticated;
create index scheduled_announcements_due on qnlbc_private.scheduled_announcements(scheduled_at) where state='pending';
create function public.schedule_admin_announcement(request_id uuid,message_title text,message_body text,recipient_ids uuid[],send_at timestamptz)
returns uuid language plpgsql security definer set search_path='' as $$
declare targets uuid[]; previous qnlbc_private.scheduled_announcements;
begin
 if not exists(select 1 from public.profiles where id=auth.uid() and active and role='admin') then raise insufficient_privilege using message='Administrator access required'; end if;
 if request_id is null or nullif(trim(message_title),'') is null or length(trim(message_title))>120 or nullif(trim(message_body),'') is null or length(trim(message_body))>2000 then raise exception 'Enter a title and message.'; end if;
 select array_agg(distinct x order by x) into targets from unnest(recipient_ids) x;
 if coalesce(cardinality(targets),0)=0 or array_position(targets,null) is not null then raise exception 'Select at least one active account.'; end if;
 perform pg_advisory_xact_lock(hashtextextended(request_id::text,0));
 select * into previous from qnlbc_private.scheduled_announcements where id=request_id;
 if found then
  if previous.sender_id<>auth.uid() or previous.title<>trim(message_title) or previous.body<>trim(message_body) or previous.recipient_ids is distinct from targets or previous.scheduled_at is distinct from send_at then raise exception 'Request already used. Refresh history.'; end if;
  return request_id;
 end if;
 if send_at is null or send_at<=now() then raise exception 'Choose a future date and time.'; end if;
 if exists(select 1 from public.admin_announcements where id=request_id) then raise exception 'Request already used.'; end if;
 perform 1 from public.profiles where id=any(targets) and active for share;
 if (select count(*) from public.profiles where id=any(targets) and active)<>cardinality(targets) then raise exception 'A selected account is no longer active. Refresh recipients.'; end if;
 insert into qnlbc_private.scheduled_announcements(id,sender_id,title,body,recipient_ids,scheduled_at) values(request_id,auth.uid(),trim(message_title),trim(message_body),targets,send_at);
 return request_id;
end; $$;
create function public.list_scheduled_announcements()
returns jsonb language plpgsql security definer set search_path='' as $$
begin
 if not exists(select 1 from public.profiles where id=auth.uid() and active and role='admin') then raise insufficient_privilege using message='Administrator access required'; end if;
 return coalesce((select jsonb_agg(to_jsonb(s) order by scheduled_at) from (select id,title,body,scheduled_at,state,cardinality(recipient_ids) recipient_count from qnlbc_private.scheduled_announcements order by scheduled_at desc limit 50) s),'[]'::jsonb);
end; $$;
create function public.cancel_scheduled_announcement(request_id uuid)
returns void language plpgsql security definer set search_path='' as $$
begin
 if not exists(select 1 from public.profiles where id=auth.uid() and active and role='admin') then raise insufficient_privilege using message='Administrator access required'; end if;
 update qnlbc_private.scheduled_announcements set state='cancelled' where id=request_id and state='pending';
 if not found then raise exception 'This notification was already sent or cancelled. Refresh the list.'; end if;
end; $$;
revoke all on function public.schedule_admin_announcement(uuid,text,text,uuid[],timestamptz),public.list_scheduled_announcements(),public.cancel_scheduled_announcement(uuid) from public,anon,authenticated;
grant execute on function public.schedule_admin_announcement(uuid,text,text,uuid[],timestamptz),public.list_scheduled_announcements(),public.cancel_scheduled_announcement(uuid) to authenticated;

create function qnlbc_private.queue_scheduled_announcements(clock timestamptz default now())
returns integer language plpgsql security definer set search_path='' as $$
declare a qnlbc_private.scheduled_announcements; added integer:=0;
begin
 for a in select * from qnlbc_private.scheduled_announcements where state='pending' and scheduled_at<=clock order by scheduled_at for update skip locked loop
  if not exists(select 1 from public.profiles where id=a.sender_id and active and role='admin') then
   update qnlbc_private.scheduled_announcements set state='cancelled' where id=a.id; continue;
  end if;
  insert into public.admin_announcements(id,sender_id,title,body) values(a.id,a.sender_id,a.title,a.body);
  insert into public.assignment_notifications(user_id,kind,title,body,event_key,announcement_id)
   select p.id,'announcement',a.title,a.body,'announcement:'||a.id::text,a.id from public.profiles p where p.id=any(a.recipient_ids) and p.active;
  insert into qnlbc_private.push_deliveries(notification_id,device_id)
   select n.id,d.id from public.assignment_notifications n join public.push_devices d on d.user_id=n.user_id where n.announcement_id=a.id;
  update qnlbc_private.scheduled_announcements set state='sent' where id=a.id; added:=added+1;
 end loop;
 return added;
end; $$;
revoke all on function qnlbc_private.queue_scheduled_announcements(timestamptz) from public,anon,authenticated;
create function qnlbc_private.queue_configured_notifications()
returns void language plpgsql security definer set search_path='' as $$
begin
 perform qnlbc_private.queue_calendar_reminders();
 perform qnlbc_private.queue_service_reminders();
 perform qnlbc_private.queue_practice_reminders();
 perform qnlbc_private.queue_scheduled_announcements();
end; $$;
revoke all on function qnlbc_private.queue_configured_notifications() from public,anon,authenticated;
-- One lightweight database schedule follows the admin's settings without changing cron jobs.
-- The existing FCM dispatcher still runs once per minute.
select cron.unschedule(jobid) from cron.job where jobname in ('qnlbc-birthday-reminders','qnlbc-event-reminders','qnlbc-saturday-practice');
select cron.schedule('qnlbc-configured-reminders','* * * * *','select qnlbc_private.queue_configured_notifications();');
