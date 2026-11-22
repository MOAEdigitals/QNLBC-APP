begin;
alter table public.assignment_notifications
  add column completed_at timestamptz,
  add column expires_at timestamptz,
  add column source_title text,
  add column special_number_id uuid references public.special_numbers(id) on delete cascade;

do $$ declare constraint_name text; old_rule text; begin
  foreach constraint_name in array array['assignment_notifications_kind_check','notification_target_check'] loop
    select pg_get_expr(conbin,conrelid) into strict old_rule from pg_constraint
      where conrelid='public.assignment_notifications'::regclass and conname=constraint_name;
    execute format('alter table public.assignment_notifications drop constraint %I',constraint_name);
    execute format('alter table public.assignment_notifications add constraint %I check ((%s) or (kind=''missing_lyrics'' and special_number_id is not null and service_date is not null and setlist_id is null and slot is null and announcement_id is null and birthday_id is null and activity_id is null and anniversary_id is null and recognition_id is null))',constraint_name,old_rule);
  end loop;
end $$;

create function qnlbc_private.service_end(d date,t text default '',k text default '')
returns timestamptz language sql immutable set search_path='' as $$
 select (d::timestamp + case
   when k='sunday' or t ~* 'sunday\s*service' then interval '12 hours'
   when k in ('prayer','prayer_meeting') or t ~* 'prayer\s*meeting|midweek\s*prayer' then interval '20 hours'
   when t ~* '(song\s*leaders?|choir).*practice|practice.*(song\s*leaders?|choir)|saturday.*practice' then interval '19 hours'
   else interval '24 hours' end) at time zone 'Asia/Manila';
$$;
revoke all on function qnlbc_private.service_end(date,text,text) from public,anon,authenticated;

create function qnlbc_private.notification_metadata()
returns trigger language plpgsql security definer set search_path='' as $$
declare source text; source_kind text; role_name text; relative_day text; event_time time;
begin
 if new.service_date is null then return new; end if;
 if new.setlist_id is not null then
   select coalesce(title,''),type into source,source_kind from public.setlists where id=new.setlist_id;
 elsif new.activity_id is not null then
   select title,activity_time into source,event_time from public.church_activities where id=new.activity_id;
 elsif new.special_number_id is not null then
   select coalesce(nullif(song_title,''),performer_name),case when extract(dow from scheduled_date)=0 then 'sunday' else '' end
     into source,source_kind from public.special_numbers where id=new.special_number_id;
 end if;
 new.source_title=coalesce(source,new.source_title);
 new.expires_at=qnlbc_private.service_end(new.service_date,coalesce(source,''),coalesce(source_kind,''));
 if new.expires_at<=now() then new.completed_at=coalesce(new.completed_at,now()); end if;
 -- Keep push copy short too; reading a card later recalculates relative dates in the app.
 if tg_op='INSERT' then
   relative_day=case new.service_date when (now() at time zone 'Asia/Manila')::date then 'today'
     when (now() at time zone 'Asia/Manila')::date+1 then 'tomorrow'
     else 'on '||to_char(new.service_date,'Mon FMDD, YYYY') end;
   role_name=case new.slot when 'presider' then 'Presider' when 'sunday_school' then 'Sunday School Song Leader'
     when 'worship' then 'Worship Song Leader' when 'program' then 'Song Leader' end;
   if new.kind in ('assigned','practice') then
     new.title=case when relative_day in ('today','tomorrow') then 'You’re on '||relative_day||'’s setlist!' else 'You’re on the setlist!' end;
     new.body='You’re assigned as '||coalesce(role_name,'Song Leader')||case when relative_day in ('today','tomorrow') then '.' else ' '||relative_day||'.' end;
   elsif new.kind='updated' then new.title='Your service date changed'; new.body='You’re still on the setlist as '||coalesce(role_name,'Song Leader')||' '||relative_day||'.';
   elsif new.kind='removed' then new.title='Your assignment was removed'; new.body='Setlist '||relative_day||'.';
   elsif new.kind='backup_setlist' then new.title='Setlist ready for practice'; new.body=relative_day||' · Listen and rehearse.';
   elsif new.kind='event' and source is not null then
     new.title=source||case when relative_day in ('today','tomorrow') then ' is '||relative_day||'!' else '' end;
     new.body=case when relative_day in ('today','tomorrow') then '' else relative_day end||case when event_time is not null then case when relative_day in ('today','tomorrow') then '' else ' · ' end||'See you at '||to_char(event_time,'FMHH12:MI AM')||'!' else '' end;
   end if;
 end if;
 return new;
end $$;
revoke all on function qnlbc_private.notification_metadata() from public,anon,authenticated;
create trigger notification_metadata before insert or update of service_date on public.assignment_notifications
for each row execute function qnlbc_private.notification_metadata();
update public.assignment_notifications set service_date=service_date where service_date is not null;

create table qnlbc_private.avp_lyrics_recipients(user_id uuid primary key references public.profiles(id) on delete cascade);
alter table qnlbc_private.avp_lyrics_recipients enable row level security;
revoke all on qnlbc_private.avp_lyrics_recipients from public,anon,authenticated;
insert into qnlbc_private.avp_lyrics_recipients select id from public.profiles where active and username in ('avpjonah','avpdm','qnlbcaljoe');
do $$ begin if (select count(*) from qnlbc_private.avp_lyrics_recipients)<>3 then raise exception 'Expected three verified QNLBC AVP accounts'; end if; end $$;

create function qnlbc_private.refresh_notification_completion()
returns void language plpgsql security definer set search_path='' as $$
begin
 update public.assignment_notifications set completed_at=now() where completed_at is null and expires_at<=now();
 update qnlbc_private.push_deliveries q set state='cancelled' from public.assignment_notifications n
   where n.id=q.notification_id and n.completed_at is not null and q.state in ('pending','leased');
end $$;
revoke all on function qnlbc_private.refresh_notification_completion() from public,anon,authenticated;

create function qnlbc_private.refresh_missing_lyrics(target uuid)
returns void language plpgsql security definer set search_path='' as $$
declare item public.special_numbers; content text; missing boolean; cycle text;
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
 if not missing then
   update public.assignment_notifications set completed_at=coalesce(completed_at,now()) where special_number_id=target and kind='missing_lyrics' and completed_at is null;
   perform qnlbc_private.refresh_notification_completion(); return;
 end if;
 -- A new unresolved episode gets one alert; repeated saves keep the existing one.
 if exists(select 1 from public.assignment_notifications where special_number_id=target and kind='missing_lyrics' and completed_at is null) then
   update public.assignment_notifications set service_date=item.scheduled_date,
     source_title=coalesce(nullif(item.song_title,''),item.performer_name),body=coalesce(nullif(item.song_title,''),item.performer_name)
     where special_number_id=target and kind='missing_lyrics' and completed_at is null;
   return;
 end if;
 cycle='missing_lyrics:'||target::text||':'||gen_random_uuid()::text;
 with created as (
   insert into public.assignment_notifications(user_id,kind,special_number_id,service_date,title,body,source_title,event_key)
   select p.id,'missing_lyrics',target,item.scheduled_date,'Lyrics needed',coalesce(nullif(item.song_title,''),item.performer_name),coalesce(nullif(item.song_title,''),item.performer_name),cycle
   from public.profiles p where p.active and (p.role='admin' or exists(select 1 from qnlbc_private.avp_lyrics_recipients a where a.user_id=p.id))
   on conflict(user_id,event_key) do nothing returning id,user_id
 ) insert into qnlbc_private.push_deliveries(notification_id,device_id)
 select c.id,d.id from created c join public.push_devices d on d.user_id=c.user_id on conflict do nothing;
end $$;
revoke all on function qnlbc_private.refresh_missing_lyrics(uuid) from public,anon,authenticated;
create function qnlbc_private.special_lyrics_changed()
returns trigger language plpgsql security definer set search_path='' as $$
declare item_id uuid;
begin
 if tg_table_name='special_numbers' then perform qnlbc_private.refresh_missing_lyrics(new.id);
 else
   for item_id in select id from public.special_numbers where song_id=new.id and lyrics_mode='live' loop
     perform qnlbc_private.refresh_missing_lyrics(item_id);
   end loop;
 end if;
 return new;
end $$;
revoke all on function qnlbc_private.special_lyrics_changed() from public,anon,authenticated;
create trigger special_lyrics_changed after insert or update of lyrics_snapshot,lyrics_mode,song_id,scheduled_date,deleted_at,status,song_title,performer_name on public.special_numbers
for each row execute function qnlbc_private.special_lyrics_changed();
create trigger special_source_lyrics_changed after update of lyrics,deleted_at on public.songs
for each row execute function qnlbc_private.special_lyrics_changed();
create index notification_unread_active on public.assignment_notifications(user_id) where read_at is null and completed_at is null and dismissed_at is null;
select qnlbc_private.refresh_notification_completion();
select cron.schedule('qnlbc-notification-completion','* * * * *','select qnlbc_private.refresh_notification_completion();');
do $$ declare target uuid; begin
  for target in select id from public.special_numbers where deleted_at is null and scheduled_date>=(now() at time zone 'Asia/Manila')::date loop
    perform qnlbc_private.refresh_missing_lyrics(target);
  end loop;
end $$;
commit;
