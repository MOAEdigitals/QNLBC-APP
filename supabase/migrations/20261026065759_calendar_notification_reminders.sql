alter table public.assignment_notifications
  add column birthday_id uuid references public.birthdays(id) on delete cascade,
  add column activity_id uuid references public.church_activities(id) on delete cascade,
  add column dismissed_at timestamptz;
alter table public.assignment_notifications drop constraint assignment_notifications_kind_check;
alter table public.assignment_notifications add constraint assignment_notifications_kind_check
  check(kind in ('assigned','updated','removed','practice','announcement','birthday','event'));
alter table public.assignment_notifications drop constraint notification_target_check;
alter table public.assignment_notifications add constraint notification_target_check check (
  (kind='announcement' and announcement_id is not null and setlist_id is null and slot is null and service_date is null and birthday_id is null and activity_id is null)
  or (kind in ('assigned','updated','removed','practice') and announcement_id is null and setlist_id is not null and slot is not null and service_date is not null and birthday_id is null and activity_id is null)
  or (kind='birthday' and birthday_id is not null and activity_id is null and announcement_id is null and setlist_id is null and slot is null and service_date is not null)
  or (kind='event' and activity_id is not null and birthday_id is null and announcement_id is null and setlist_id is null and slot is null and service_date is not null)
);
create index notification_birthday_idx on public.assignment_notifications(birthday_id) where birthday_id is not null;
create index notification_activity_idx on public.assignment_notifications(activity_id) where activity_id is not null;
drop policy notification_owner_read on public.assignment_notifications;
create policy notification_owner_read on public.assignment_notifications for select to authenticated using (
  user_id=(select auth.uid()) and dismissed_at is null and qnlbc_private.is_active_account()
);
create function public.set_notification_dismissed(notification_id uuid, dismissed boolean)
returns void language plpgsql security definer set search_path='' as $$
begin
  if not qnlbc_private.is_active_account() or dismissed is null then raise exception 'Active account required' using errcode='42501'; end if;
  update public.assignment_notifications set dismissed_at=case when dismissed then now() else null end
    where id=notification_id and user_id=auth.uid();
  if not found then raise exception 'Notification not found' using errcode='42501'; end if;
  if dismissed then
    update qnlbc_private.push_deliveries set state='cancelled'
      where push_deliveries.notification_id=set_notification_dismissed.notification_id and state in ('pending','leased');
  end if;
end; $$;
revoke all on function public.set_notification_dismissed(uuid,boolean) from public,anon,authenticated;
grant execute on function public.set_notification_dismissed(uuid,boolean) to authenticated;

create function qnlbc_private.queue_calendar_reminders(clock timestamptz default now())
returns integer language plpgsql security definer set search_path='' as $$
declare local_clock timestamp:=clock at time zone 'Asia/Manila'; local_day date:=local_clock::date; added integer:=0; n integer;
begin
  if local_clock::time >= time '07:00' and local_clock::time < time '08:00' then
    with created as (
      insert into public.assignment_notifications(user_id,kind,birthday_id,service_date,title,body,event_key)
      select p.id,'birthday',b.id,local_day,'Birthday today: '||b.name,
        'Let’s greet '||b.name||' a happy birthday today!', 'birthday:'||b.id::text||':'||local_day::text
      from public.birthdays b cross join public.profiles p
      where p.active and b.deleted_at is null
        and extract(month from b.birth_date)=extract(month from local_day)
        and extract(day from b.birth_date)=extract(day from local_day)
      on conflict(user_id,event_key) do nothing returning id,user_id
    ), deliveries as (
      insert into qnlbc_private.push_deliveries(notification_id,device_id)
      select c.id,d.id from created c join public.push_devices d on d.user_id=c.user_id
      on conflict do nothing returning id
    ) select count(*) into n from created;
    added:=added+n;
  end if;
  if local_clock::time >= time '08:00' and local_clock::time < time '09:00' then
    with created as (
      insert into public.assignment_notifications(user_id,kind,activity_id,service_date,title,body,event_key)
      select p.id,'event',a.id,a.activity_date,'Tomorrow: '||a.title,
        a.title||' is tomorrow, '||to_char(a.activity_date,'FMMonth FMDD, YYYY')||case when a.activity_time is null then '.' else ' at '||to_char(a.activity_time,'FMHH12:MI AM')||'.' end,
        'event:'||a.id::text||':'||a.activity_date::text
      from public.church_activities a cross join public.profiles p
      where p.active and a.activity_date=local_day+1
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

drop function public.claim_assignment_pushes(integer);
create function public.claim_assignment_pushes(batch_size integer default 50)
returns table(delivery_id bigint,lease_id uuid,notification_id uuid,token text,user_id uuid,setlist_id uuid,title text,body text,kind text)
language plpgsql security definer set search_path='' as $$
begin
  if coalesce(auth.role(),'')<>'service_role' then raise exception 'Service access required' using errcode='42501'; end if;
  update qnlbc_private.push_deliveries set state='failed' where state='leased' and attempts>=8 and available_at<=now();
  update qnlbc_private.push_deliveries q set state='cancelled'
  from public.assignment_notifications n join public.profiles p on p.id=n.user_id
    left join public.setlists s on s.id=n.setlist_id left join public.birthdays b on b.id=n.birthday_id
    left join public.church_activities a on a.id=n.activity_id,public.push_devices d
  where q.notification_id=n.id and q.device_id=d.id and q.state in ('pending','leased') and (
    n.dismissed_at is not null or not p.active or d.user_id<>n.user_id or
    (n.kind in ('assigned','updated','removed','practice') and (s.id is null or (n.kind<>'removed' and (
      s.service_date<>n.service_date or s.service_date<(now() at time zone 'Asia/Manila')::date
      or not exists(select 1 from qnlbc_private.assignment_people(s) who where who.slot=n.slot and who.member_id=p.directory_member_id))))) or
    (n.kind='birthday' and (b.id is null or b.deleted_at is not null or n.service_date<(now() at time zone 'Asia/Manila')::date
      or to_char(b.birth_date,'MM-DD')<>to_char(n.service_date,'MM-DD'))) or
    (n.kind='event' and (a.id is null or a.activity_date<>n.service_date or a.activity_date<(now() at time zone 'Asia/Manila')::date))
  );
  return query with due as (
    select q.id from qnlbc_private.push_deliveries q join public.assignment_notifications n on n.id=q.notification_id
    where q.state in ('pending','leased') and q.available_at<=now() and q.attempts<8 and n.dismissed_at is null
    order by q.available_at for update of q skip locked limit least(greatest(batch_size,1),100)
  ), claimed as (
    update qnlbc_private.push_deliveries q set state='leased',attempts=q.attempts+1,available_at=now()+interval '2 minutes',
      lease_id=gen_random_uuid(),leased_token=(select pd.token from public.push_devices pd where pd.id=q.device_id)
    from due where q.id=due.id returning q.*
  ) select c.id,c.lease_id,n.id,c.leased_token,n.user_id,n.setlist_id,n.title,n.body,n.kind
    from claimed c join public.assignment_notifications n on n.id=c.notification_id join public.push_devices d on d.id=c.device_id
    where d.user_id=n.user_id;
end; $$;
revoke all on function public.claim_assignment_pushes(integer) from public,anon,authenticated;
grant execute on function public.claim_assignment_pushes(integer) to service_role;

-- UTC cron times correspond to 7 AM and 8 AM in the Philippines.
select cron.schedule('qnlbc-birthday-reminders','0 23 * * *','select qnlbc_private.queue_calendar_reminders();');
select cron.schedule('qnlbc-event-reminders','0 0 * * *','select qnlbc_private.queue_calendar_reminders();');
