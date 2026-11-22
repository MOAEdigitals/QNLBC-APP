begin;

create or replace function qnlbc_private.notification_metadata()
returns trigger language plpgsql security definer set search_path='' as $$
declare source text; source_kind text; role_name text; relative_day text; event_time time; extra text;
begin
 if new.kind='announcement' then
   new.expires_at=coalesce(new.created_at,now())+interval '7 days';
   if new.expires_at<=now() then new.completed_at=coalesce(new.completed_at,now()); end if;
   return new;
 end if;
 if new.service_date is null then return new; end if;
 if new.setlist_id is not null then
   select coalesce(title,''),type into source,source_kind from public.setlists where id=new.setlist_id;
 elsif new.activity_id is not null then
   select title,activity_time into source,event_time from public.church_activities where id=new.activity_id;
 elsif new.special_number_id is not null then
   select performer_name,case when extract(dow from scheduled_date)=0 then 'sunday' else '' end
     into source,source_kind from public.special_numbers where id=new.special_number_id;
 end if;
 if new.birthday_id is not null then select name into source from public.birthdays where id=new.birthday_id;
 elsif new.anniversary_id is not null then select title,type into source,extra from public.anniversaries where id=new.anniversary_id;
 elsif new.recognition_id is not null then select name,case when recognition_type='Custom' then coalesce(custom_type,'Recognition') else recognition_type end into source,extra from public.recognitions where id=new.recognition_id; end if;
 new.source_title=coalesce(source,new.source_title);
 new.expires_at=qnlbc_private.service_end(new.service_date,coalesce(source,''),coalesce(source_kind,''));
 if new.expires_at<=now() then new.completed_at=coalesce(new.completed_at,now()); end if;
 -- Keep push copy short too; reading a card later recalculates relative dates in the app.
 if tg_op='INSERT' or new.kind in ('birthday','anniversary','recognition') then
   relative_day=case new.service_date when (now() at time zone 'Asia/Manila')::date then 'today'
     when (now() at time zone 'Asia/Manila')::date+1 then 'tomorrow'
     else 'on '||to_char(new.service_date,'Mon FMDD, YYYY') end;
   role_name=case new.slot when 'presider' then 'Presider' when 'sunday_school' then 'Sunday School Song Leader'
     when 'worship' then 'Worship Song Leader' when 'program' then 'Song Leader' end;
   if new.kind in ('assigned','practice') then
     new.title=case when relative_day in ('today','tomorrow') then 'You’re on '||relative_day||'’s setlist!' else 'You’re on the setlist!' end;
     new.body='You’re assigned as '||coalesce(role_name,'Song Leader')||case when relative_day in ('today','tomorrow') then '.' else ' '||relative_day||'.' end;
     if new.kind='assigned' and new.slot in ('sunday_school','worship','program') then new.body=new.body||' Listen and rehearse.'; end if;
   elsif new.kind='updated' then new.title='Your service date changed'; new.body='You’re still on the setlist as '||coalesce(role_name,'Song Leader')||' '||relative_day||'.';
   elsif new.kind='removed' then new.title='Your assignment was removed'; new.body='Setlist '||relative_day||'.';
   elsif new.kind='backup_setlist' then new.title='Setlist ready for practice'; new.body=relative_day||' · Listen and rehearse.';
   elsif new.kind='missing_lyrics' then new.title='Lyrics needed'; new.body=coalesce(source,'The singer/group')||'’s song number lyrics needed. '||to_char(new.service_date,'Mon FMDD, YYYY')||'.';
   elsif new.kind='birthday' then
     new.title='It’s '||source||'’s birthday '||relative_day||'!';
     new.body='Let’s greet them a blessed birthday!';
   elsif new.kind='anniversary' then
     new.title=case when extra='Wedding' then 'It’s ' else '' end||source||case when extra='Wedding' and source !~* 'wedding anniversary' then '’s wedding anniversary ' else ' is ' end||relative_day||'!';
     new.body=case when extra='Wedding' then 'Let’s greet them a blessed wedding anniversary!' else 'Let’s give thanks together!' end;
   elsif new.kind='recognition' then
     new.title='Congratulations, '||source||'!'; new.body='Let’s celebrate '||extra||'!';
   elsif new.kind='event' and source is not null then
     new.title=source||case when relative_day in ('today','tomorrow') then ' is '||relative_day||'!' else '' end;
     new.body=case when relative_day in ('today','tomorrow') then '' else relative_day end||case when event_time is not null then case when relative_day in ('today','tomorrow') then '' else ' · ' end||'See you at '||to_char(event_time,'FMHH12:MI AM')||'!' else '' end;
   end if;
 end if;
 return new;
end $$;
revoke all on function qnlbc_private.notification_metadata() from public,anon,authenticated;
update public.assignment_notifications set service_date=service_date where kind in ('birthday','anniversary','recognition','missing_lyrics','announcement');

alter table public.notification_schedule_settings drop constraint notification_schedule_settings_kind_check;
alter table public.notification_schedule_settings add constraint notification_schedule_settings_kind_check
 check(kind in ('birthday','event','prayer','sunday','practice','anniversary','recognition','choir_practice','lyrics_saturday','lyrics_day'));
update public.notification_schedule_settings set enabled=true,local_time='07:00',days_before=0,weekdays=array[0,1,2,3,4,5,6] where kind in ('birthday','anniversary');
insert into public.notification_schedule_settings(kind,enabled,local_time,days_before,weekdays) values
 ('choir_practice',true,'09:00',0,array[0,1,2,3,4,5,6]),
 ('lyrics_saturday',true,'16:30',0,array[6]),
 ('lyrics_day',true,'07:30',0,array[0,1,2,3,4,5,6]);
alter table public.notification_schedule_settings add constraint same_day_notification_schedule
 check(kind not in ('birthday','anniversary','lyrics_saturday','lyrics_day') or days_before=0);

-- Explicit recipients supplement AVP and every current active admin. Eric remains a member.
insert into qnlbc_private.avp_lyrics_recipients(user_id)
 select id from public.profiles where active and username in ('qnlbcalma','qnlbceric') on conflict do nothing;
do $$ begin
 if (select count(*) from qnlbc_private.avp_lyrics_recipients r join public.profiles p on p.id=r.user_id and p.active)<>5 then
   raise exception 'Expected five verified QNLBC lyrics recipients plus admins';
 end if;
end $$;

-- Retain early alerts as Done; future alerts are created only at their scheduled times.
update public.assignment_notifications set completed_at=coalesce(completed_at,now()) where kind='missing_lyrics';
select qnlbc_private.refresh_notification_completion();
create or replace function qnlbc_private.refresh_missing_lyrics(target uuid)
returns void language plpgsql security definer set search_path='' as $$
declare item public.special_numbers; content text; missing boolean;
begin
 select * into item from public.special_numbers where id=target for update;
 if not found then return; end if;
 content=item.lyrics_snapshot;
 if item.lyrics_mode='live' and item.song_id is not null then
   select lyrics into content from public.songs where id=item.song_id and deleted_at is null;
 end if;
 missing=item.deleted_at is null and item.status is distinct from 'completed'
   and qnlbc_private.service_end(item.scheduled_date,'',case when extract(dow from item.scheduled_date)=0 then 'sunday' else '' end)>now()
   and nullif(btrim(coalesce(content,'')),'') is null;
 update public.assignment_notifications set completed_at=coalesce(completed_at,now())
   where special_number_id=target and kind='missing_lyrics' and completed_at is null
     and (not missing or service_date<>item.scheduled_date);
 update public.assignment_notifications set source_title=item.performer_name,
   body=item.performer_name||'’s song number lyrics needed. '||to_char(item.scheduled_date,'Mon FMDD, YYYY')||'.'
   where special_number_id=target and kind='missing_lyrics' and completed_at is null;
 perform qnlbc_private.refresh_notification_completion();
end $$;
revoke all on function qnlbc_private.refresh_missing_lyrics(uuid) from public,anon,authenticated;

create function qnlbc_private.lyrics_reminder_phase(performance_day date,local_day date)
returns text language sql immutable set search_path='' as $$
 select case when local_day=performance_day then 'lyrics_day'
   when local_day=performance_day-1-((extract(dow from performance_day-1)::integer+1)%7) then 'lyrics_saturday'
 end;
$$;
revoke all on function qnlbc_private.lyrics_reminder_phase(date,date) from public,anon,authenticated;
create function qnlbc_private.queue_missing_lyrics_reminders(clock timestamptz default now())
returns integer language plpgsql security definer set search_path='' as $$
declare local_day date:=(clock at time zone 'Asia/Manila')::date; item public.special_numbers;
 content text; phase text; added integer:=0; n integer;
begin
 for item in select * from public.special_numbers where deleted_at is null and status is distinct from 'completed'
   and scheduled_date between local_day and local_day+7 order by id for update loop
   phase=qnlbc_private.lyrics_reminder_phase(item.scheduled_date,local_day);
   if phase is null or not qnlbc_private.reminder_due(phase,clock) then continue; end if;
   if qnlbc_private.service_end(item.scheduled_date,'',case when extract(dow from item.scheduled_date)=0 then 'sunday' else '' end)<=clock then continue; end if;
   content=item.lyrics_snapshot;
   if item.lyrics_mode='live' and item.song_id is not null then
     select lyrics into content from public.songs where id=item.song_id and deleted_at is null;
   end if;
   if nullif(btrim(coalesce(content,'')),'') is not null then continue; end if;
   with created as (
     insert into public.assignment_notifications(user_id,kind,special_number_id,service_date,title,body,source_title,event_key)
     select p.id,'missing_lyrics',item.id,item.scheduled_date,'Lyrics needed',item.performer_name,item.performer_name,
       'lyrics_scheduled:'||item.id::text||':'||item.scheduled_date::text||':'||phase
     from public.profiles p where p.active and (p.role='admin' or exists(select 1 from qnlbc_private.avp_lyrics_recipients a where a.user_id=p.id))
     on conflict(user_id,event_key) do nothing returning id,user_id
   ), queued as (
     insert into qnlbc_private.push_deliveries(notification_id,device_id)
     select c.id,d.id from created c join public.push_devices d on d.user_id=c.user_id on conflict do nothing returning id
   ) select count(*) into n from created;
   added=added+n;
 end loop;
 return added;
end $$;
revoke all on function qnlbc_private.queue_missing_lyrics_reminders(timestamptz) from public,anon,authenticated;

create function qnlbc_private.queue_choir_practice_reminders(clock timestamptz default now())
returns integer language plpgsql security definer set search_path='' as $$
declare added integer;
begin
 if not qnlbc_private.reminder_due('choir_practice',clock) then return 0; end if;
 with created as (
   insert into public.assignment_notifications(user_id,kind,activity_id,service_date,title,body,event_key)
   select p.id,'event',a.id,a.activity_date,a.title,'', 'choir_practice:'||a.id::text||':'||a.activity_date::text
   from public.church_activities a cross join public.profiles p
   where p.active and a.activity_date=qnlbc_private.reminder_day('choir_practice',clock)
     and a.title ~* '(song\s*leaders?|choir).*practice|practice.*(song\s*leaders?|choir)|saturday.*practice'
     and qnlbc_private.service_end(a.activity_date,a.title)>clock
   on conflict(user_id,event_key) do nothing returning id,user_id
 ), queued as (
   insert into qnlbc_private.push_deliveries(notification_id,device_id)
   select c.id,d.id from created c join public.push_devices d on d.user_id=c.user_id on conflict do nothing returning id
 ) select count(*) into added from created;
 return added;
end $$;
revoke all on function qnlbc_private.queue_choir_practice_reminders(timestamptz) from public,anon,authenticated;
create or replace function qnlbc_private.queue_configured_notifications()
returns void language plpgsql security definer set search_path='' as $$
begin
 perform qnlbc_private.queue_calendar_reminders();
 perform qnlbc_private.queue_service_reminders();
 perform qnlbc_private.queue_practice_reminders();
 perform qnlbc_private.queue_scheduled_announcements();
 perform qnlbc_private.queue_recognition_reminders();
 perform qnlbc_private.queue_missing_lyrics_reminders();
 perform qnlbc_private.queue_choir_practice_reminders();
end $$;
revoke all on function qnlbc_private.queue_configured_notifications() from public,anon,authenticated;
create function public.complete_notifications(notification_ids uuid[] default null)
returns integer language plpgsql security definer set search_path='' as $$
declare changed integer;
begin
 if not qnlbc_private.is_active_account() then raise exception 'Active account required' using errcode='42501'; end if;
 update public.assignment_notifications set completed_at=now()
   where user_id=(select auth.uid()) and completed_at is null and dismissed_at is null
     and (notification_ids is null or id=any(notification_ids));
 get diagnostics changed=row_count;
 update qnlbc_private.push_deliveries q set state='cancelled'
   from public.assignment_notifications n where n.id=q.notification_id and n.user_id=(select auth.uid())
   and n.completed_at is not null and q.state in ('pending','leased');
 return changed;
end $$;
revoke all on function public.complete_notifications(uuid[]) from public,anon,authenticated;
grant execute on function public.complete_notifications(uuid[]) to authenticated;
commit;
