-- Directory identity, assignment notifications and durable per-device delivery.
begin;
create schema if not exists qnlbc_private;
revoke all on schema qnlbc_private from public, anon, authenticated;

create table public.directory_members (
  id uuid primary key default gen_random_uuid(),
  name text not null check (length(trim(name)) between 1 and 160),
  active boolean not null default true,
  created_at timestamptz not null default now()
);
create unique index directory_members_name_uidx on public.directory_members(lower(trim(name)));
alter table public.directory_members enable row level security;
alter table public.profiles add column directory_member_id uuid unique references public.directory_members(id);
create index profiles_directory_member_idx on public.profiles(directory_member_id) where directory_member_id is not null;

insert into public.directory_members(name)
select distinct on (lower(trim(n))) trim(n)
from public.app_settings a cross join lateral jsonb_array_elements_text(
  case when jsonb_typeof(a.value)='array' then a.value else '[]'::jsonb end) n
where a.key='ministry_saved_names' and length(trim(n)) between 1 and 160
on conflict do nothing;

create or replace function qnlbc_private.is_active_account()
returns boolean language sql stable security definer set search_path='' as $$
  select exists(select 1 from public.profiles where id=auth.uid() and active);
$$;
create or replace function qnlbc_private.require_admin()
returns void language plpgsql security definer set search_path='' as $$
begin
  if not exists(select 1 from public.profiles where id=auth.uid() and active and role='admin') then
    raise exception 'Administrator access required' using errcode='42501';
  end if;
end; $$;

create policy directory_members_read on public.directory_members for select to authenticated
using (qnlbc_private.is_active_account());
grant usage on schema qnlbc_private to authenticated, service_role;
grant execute on function qnlbc_private.is_active_account() to authenticated;
grant select on public.directory_members to authenticated;
revoke insert,update,delete on public.directory_members from anon, authenticated;

create function public.list_directory_members()
returns table(id uuid,name text,active boolean,linked_user_id uuid,account_active boolean)
language sql stable security definer set search_path='' as $$
  select d.id,d.name,d.active,p.id,coalesce(p.active,false) from public.directory_members d
  left join public.profiles p on p.directory_member_id=d.id
  where qnlbc_private.is_active_account() order by lower(d.name);
$$;

create function qnlbc_private.sync_directory_names()
returns void language sql security definer set search_path='' as $$
  insert into public.app_settings(key,value)
  values('ministry_saved_names',coalesce((select jsonb_agg(name order by lower(name)) from public.directory_members where active),'[]'::jsonb))
  on conflict(key) do update set value=excluded.value;
$$;

create function public.save_directory_member(member_id uuid, member_name text, is_active boolean default true)
returns uuid language plpgsql security definer set search_path='' as $$
declare result uuid;
begin
  perform qnlbc_private.require_admin();
  if length(trim(member_name)) not between 1 and 160 then raise exception 'Name must contain 1–160 characters'; end if;
  if member_id is null then
    insert into public.directory_members(name,active) values(trim(member_name),is_active) returning id into result;
  else
    update public.directory_members set name=trim(member_name),active=is_active where id=member_id returning id into result;
    if result is null then raise exception 'Directory person not found'; end if;
  end if;
  perform qnlbc_private.sync_directory_names();
  return result;
end; $$;

create function public.save_directory_names(names jsonb)
returns void language plpgsql security definer set search_path='' as $$
declare n text;
begin
  perform qnlbc_private.require_admin();
  if jsonb_typeof(names) is distinct from 'array' then raise exception 'Names must be an array'; end if;
  for n in select jsonb_array_elements_text(names) loop
    if length(trim(n)) not between 1 and 160 then raise exception 'Invalid directory name'; end if;
    insert into public.directory_members(name) values(trim(n))
    on conflict(lower(trim(name))) do update set active=true;
  end loop;
  update public.directory_members set active=false
    where active and lower(trim(name)) not in (select lower(trim(value)) from jsonb_array_elements_text(names));
  perform qnlbc_private.sync_directory_names();
end; $$;

alter table public.setlists
  add column presider_member_id uuid references public.directory_members(id),
  add column sunday_school_leader_member_id uuid references public.directory_members(id),
  add column worship_leader_member_id uuid references public.directory_members(id),
  add column program_leader_member_id uuid references public.directory_members(id);
create index setlists_recognition_date_idx on public.setlists(service_date) where deleted_at is null;

create function qnlbc_private.resolve_member(person_name text)
returns uuid language sql stable security definer set search_path='' as $$
  select id from public.directory_members where active and lower(trim(name))=lower(trim(person_name));
$$;
-- Resolve legacy assignments without sending old notifications.
update public.setlists set
  presider_member_id=qnlbc_private.resolve_member(presider),
  sunday_school_leader_member_id=qnlbc_private.resolve_member(sunday_school_leader),
  worship_leader_member_id=qnlbc_private.resolve_member(worship_leader),
  program_leader_member_id=qnlbc_private.resolve_member(program_leader);

create function qnlbc_private.bind_setlist_people()
returns trigger language plpgsql security definer set search_path='' as $$
begin
  if tg_op='INSERT' then
    new.presider_member_id=qnlbc_private.resolve_member(new.presider);
    new.sunday_school_leader_member_id=qnlbc_private.resolve_member(new.sunday_school_leader);
    new.worship_leader_member_id=qnlbc_private.resolve_member(new.worship_leader);
    new.program_leader_member_id=qnlbc_private.resolve_member(new.program_leader);
  else
    new.presider_member_id=case when new.presider is distinct from old.presider then qnlbc_private.resolve_member(new.presider) else old.presider_member_id end;
    new.sunday_school_leader_member_id=case when new.sunday_school_leader is distinct from old.sunday_school_leader then qnlbc_private.resolve_member(new.sunday_school_leader) else old.sunday_school_leader_member_id end;
    new.worship_leader_member_id=case when new.worship_leader is distinct from old.worship_leader then qnlbc_private.resolve_member(new.worship_leader) else old.worship_leader_member_id end;
    new.program_leader_member_id=case when new.program_leader is distinct from old.program_leader then qnlbc_private.resolve_member(new.program_leader) else old.program_leader_member_id end;
  end if;
  return new;
end; $$;
create trigger bind_setlist_people before insert or update on public.setlists
for each row execute function qnlbc_private.bind_setlist_people();

create function qnlbc_private.directory_identity_changed()
returns trigger language plpgsql security definer set search_path='' as $$
begin
  if not new.active and old.active and (
    exists(select 1 from public.profiles where directory_member_id=new.id)
    or exists(select 1 from public.setlists where deleted_at is null and service_date >= (now() at time zone 'Asia/Manila')::date
      and new.id in (presider_member_id,sunday_school_leader_member_id,worship_leader_member_id,program_leader_member_id))
  ) then raise exception 'This person has an account or upcoming assignment. Reassign or unlink them first.'; end if;
  if new.name is distinct from old.name then
    update public.profiles set display_name=new.name where directory_member_id=new.id;
    update public.setlists set
      presider=case when presider_member_id=new.id then new.name else presider end,
      sunday_school_leader=case when sunday_school_leader_member_id=new.id then new.name else sunday_school_leader end,
      worship_leader=case when worship_leader_member_id=new.id then new.name else worship_leader end,
      program_leader=case when program_leader_member_id=new.id then new.name else program_leader end
    where new.id in (presider_member_id,sunday_school_leader_member_id,worship_leader_member_id,program_leader_member_id);
  end if;
  return new;
end; $$;
create trigger directory_identity_changed after update on public.directory_members
for each row execute function qnlbc_private.directory_identity_changed();

-- Only admin-controlled app_metadata may link an account to a directory identity.
create or replace function public.handle_new_auth_user()
returns trigger language plpgsql security definer set search_path='' as $$
declare
  handle text:=lower(trim(coalesce(new.raw_user_meta_data->>'username','')));
  person uuid:=nullif(new.raw_app_meta_data->>'directory_member_id','')::uuid;
  person_name text;
begin
  if handle='' then handle:='member_'||replace(new.id::text,'-','');
  elsif handle !~ '^[a-z0-9_.-]{3,40}$' then raise exception 'Invalid username'; end if;
  if person is not null then
    select name into person_name from public.directory_members where id=person and active for key share;
    if person_name is null then raise exception 'Choose an active directory person'; end if;
  end if;
  insert into public.profiles(id,username,display_name,directory_member_id)
    values(new.id,handle,coalesce(person_name,nullif(trim(new.raw_user_meta_data->>'display_name'),''),handle),person);
  return new;
end; $$;
create or replace function public.sync_auth_profile_identity()
returns trigger language plpgsql security definer set search_path='' as $$
declare
  handle text:=lower(trim(coalesce(new.raw_user_meta_data->>'username','')));
  person uuid:=nullif(new.raw_app_meta_data->>'directory_member_id','')::uuid;
  person_name text;
begin
  if new.raw_user_meta_data is not distinct from old.raw_user_meta_data
    and (new.raw_app_meta_data->>'directory_member_id') is not distinct from (old.raw_app_meta_data->>'directory_member_id') then return new; end if;
  if handle !~ '^[a-z0-9_.-]{3,40}$' then raise exception 'Invalid username'; end if;
  if person is not null then
    select name into person_name from public.directory_members where id=person and active for key share;
    if person_name is null then raise exception 'Choose an active directory person'; end if;
  end if;
  update public.profiles set username=handle,directory_member_id=person,
    display_name=coalesce(person_name,nullif(trim(new.raw_user_meta_data->>'display_name'),''),handle)
    where id=new.id;
  if not found then raise exception 'Account profile is missing'; end if;
  return new;
end; $$;
create or replace trigger sync_auth_profile_identity after update of raw_user_meta_data,raw_app_meta_data on auth.users
for each row execute function public.sync_auth_profile_identity();

-- Direct profile writes cannot relink an account or override its directory name.
create function qnlbc_private.guard_profile_directory_identity()
returns trigger language plpgsql security definer set search_path='' as $$
declare expected uuid; canonical text;
begin
  select nullif(raw_app_meta_data->>'directory_member_id','')::uuid into expected from auth.users where id=new.id;
  if new.directory_member_id is distinct from expected then raise exception 'Directory links must be changed through account administration'; end if;
  if new.directory_member_id is not null then
    select name into canonical from public.directory_members where id=new.directory_member_id;
    new.display_name:=canonical;
  end if;
  return new;
end; $$;
create trigger guard_profile_directory_identity before insert or update on public.profiles
for each row execute function qnlbc_private.guard_profile_directory_identity();

create table public.assignment_notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  setlist_id uuid not null references public.setlists(id) on delete cascade,
  kind text not null check(kind in ('assigned','updated','removed','practice')),
  slot text not null check(slot in ('presider','sunday_school','worship','program')),
  service_date date not null,
  title text not null, body text not null,
  event_key text not null,
  read_at timestamptz,
  created_at timestamptz not null default now(),
  unique(user_id,event_key)
);
create index assignment_notifications_inbox_idx on public.assignment_notifications(user_id,created_at desc);
alter table public.assignment_notifications enable row level security;
create policy notification_owner_read on public.assignment_notifications for select to authenticated
using (user_id=(select auth.uid()) and qnlbc_private.is_active_account());
grant select on public.assignment_notifications to authenticated;
revoke insert,update,delete on public.assignment_notifications from anon,authenticated;

create table public.push_devices (
  id uuid primary key default gen_random_uuid(),
  device_id uuid not null unique,
  user_id uuid not null references public.profiles(id) on delete cascade,
  token text not null unique check(length(token) between 20 and 4096),
  updated_at timestamptz not null default now()
);
create index push_devices_user_idx on public.push_devices(user_id);
alter table public.push_devices enable row level security;
revoke all on public.push_devices from anon,authenticated;
create table qnlbc_private.push_deliveries (
  id bigint generated always as identity primary key,
  notification_id uuid not null references public.assignment_notifications(id) on delete cascade,
  device_id uuid not null references public.push_devices(id) on delete cascade,
  state text not null default 'pending' check(state in ('pending','leased','sent','cancelled','failed')),
  attempts int not null default 0,
  available_at timestamptz not null default now(),
  lease_id uuid,
  leased_token text,
  unique(notification_id,device_id)
);
create index push_deliveries_due_idx on qnlbc_private.push_deliveries(available_at) where state in ('pending','leased');

create function public.register_push_device(device_id uuid, registration_token text)
returns void language plpgsql security definer set search_path='' as $$
begin
  if not qnlbc_private.is_active_account() then raise exception 'Active account required' using errcode='42501'; end if;
  if register_push_device.device_id is null or length(registration_token) not between 20 and 4096 then raise exception 'Invalid device registration'; end if;
  -- Cancel every queued delivery before changing this installation's account.
  delete from qnlbc_private.push_deliveries where push_deliveries.device_id in
    (select id from public.push_devices d where d.device_id=register_push_device.device_id and d.user_id<>auth.uid());
  delete from public.push_devices where token=registration_token and push_devices.device_id<>register_push_device.device_id;
  insert into public.push_devices(device_id,user_id,token) values(device_id,auth.uid(),registration_token)
  on conflict on constraint push_devices_device_id_key do update set user_id=auth.uid(),token=excluded.token,updated_at=now();
end; $$;
create function public.unregister_push_device(installation_id uuid)
returns void language sql security definer set search_path='' as $$
  delete from public.push_devices where device_id=installation_id and user_id=auth.uid();
$$;
create function public.mark_assignment_notification_read(notification_id uuid)
returns void language sql security definer set search_path='' as $$
  update public.assignment_notifications set read_at=coalesce(read_at,now())
  where id=notification_id and user_id=auth.uid() and qnlbc_private.is_active_account();
$$;

create function qnlbc_private.assignment_people(s public.setlists)
returns table(slot text, member_id uuid) language sql stable set search_path='' as $$
  select v.slot,v.member_id from (values
    ('presider',s.presider_member_id),
    ('sunday_school',case when coalesce(s.type,'sunday')='sunday' then s.sunday_school_leader_member_id end),
    ('worship',case when coalesce(s.type,'sunday')='sunday' then s.worship_leader_member_id end),
    ('program',case when coalesce(s.type,'sunday')<>'sunday' then s.program_leader_member_id end)
  ) v(slot,member_id) where v.member_id is not null and s.deleted_at is null;
$$;
create function qnlbc_private.queue_assignment_notification(person uuid, target_setlist uuid, event_kind text, event_slot text, event_date date, event_key text)
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
      when 'practice' then 'Saturday practice reminder: ' else 'Assignment updated: ' end || label,
    case event_kind when 'removed' then 'You are no longer assigned as '
      when 'practice' then 'Practice day today. You are assigned as ' else 'You are assigned as ' end
      || label || ' for ' || to_char(event_date,'FMMonth FMDD, YYYY') || '. Tap to view the setlist.',event_key)
  on conflict on constraint assignment_notifications_user_id_event_key_key do nothing returning id into notification;
  if notification is not null then
    insert into qnlbc_private.push_deliveries(notification_id,device_id)
      select notification,id from public.push_devices where user_id=recipient on conflict do nothing;
  end if;
end; $$;

create function qnlbc_private.setlist_assignment_changed()
returns trigger language plpgsql security definer set search_path='' as $$
declare old_people jsonb:='{}'; new_people jsonb:='{}'; slot text; old_id uuid; new_id uuid; day date:=(now() at time zone 'Asia/Manila')::date; event text;
begin
  if tg_op='UPDATE' then select coalesce(jsonb_object_agg(p.slot,p.member_id),'{}') into old_people from qnlbc_private.assignment_people(old) p; end if;
  select coalesce(jsonb_object_agg(p.slot,p.member_id),'{}') into new_people from qnlbc_private.assignment_people(new) p;
  foreach slot in array array['presider','sunday_school','worship','program'] loop
    old_id:=(old_people->>slot)::uuid; new_id:=(new_people->>slot)::uuid;
    event:=new.id::text||':'||coalesce(new.revision,1)::text||':'||slot||':'||txid_current()::text;
    if old_id is distinct from new_id then
      if old_id is not null and old.service_date>=day then
        perform qnlbc_private.queue_assignment_notification(old_id,new.id,'removed',slot,old.service_date,event||':removed');
      end if;
      if new_id is not null and new.service_date>=day then
        perform qnlbc_private.queue_assignment_notification(new_id,new.id,'assigned',slot,new.service_date,event||':assigned');
      end if;
    elsif new_id is not null and tg_op='UPDATE' and new.service_date is distinct from old.service_date then
      if new.service_date>=day then
        perform qnlbc_private.queue_assignment_notification(new_id,new.id,'updated',slot,new.service_date,event||':updated');
      elsif old.service_date>=day then
        perform qnlbc_private.queue_assignment_notification(old_id,new.id,'removed',slot,old.service_date,event||':past');
      end if;
    end if;
  end loop;
  return new;
end; $$;
create trigger setlist_assignment_changed after insert or update on public.setlists
for each row execute function qnlbc_private.setlist_assignment_changed();

create function qnlbc_private.queue_practice_reminders(clock timestamptz default now())
returns int language plpgsql security definer set search_path='' as $$
declare local_time timestamp:=clock at time zone 'Asia/Manila'; s public.setlists; p record; count_before bigint;
begin
  if extract(isodow from local_time)<>6 or local_time::time<'09:00' then return 0; end if;
  select count(*) into count_before from public.assignment_notifications where kind='practice';
  for s in select * from public.setlists where deleted_at is null and coalesce(type,'sunday')='sunday' and service_date=local_time::date+1 loop
    for p in select * from qnlbc_private.assignment_people(s) loop
      perform qnlbc_private.queue_assignment_notification(p.member_id,s.id,'practice',p.slot,s.service_date,
        'practice:'||s.id::text||':'||s.service_date::text||':'||p.slot||':'||p.member_id::text);
    end loop;
  end loop;
  return (select count(*) from public.assignment_notifications where kind='practice')-count_before;
end; $$;

create function public.claim_assignment_pushes(batch_size int default 50)
returns table(delivery_id bigint,lease_id uuid,notification_id uuid,token text,user_id uuid,setlist_id uuid,title text,body text)
language plpgsql security definer set search_path='' as $$
begin
  if coalesce(auth.role(),'')<>'service_role' then raise exception 'Service access required' using errcode='42501'; end if;
  update qnlbc_private.push_deliveries set state='failed' where state='leased' and attempts>=8 and available_at<=now();
  -- Discard messages made obsolete by account switches, deactivation, reassignment or rescheduling.
  update qnlbc_private.push_deliveries q set state='cancelled'
  from public.assignment_notifications n,public.push_devices d,public.profiles p,public.setlists s
  where q.notification_id=n.id and q.device_id=d.id and p.id=n.user_id and s.id=n.setlist_id
    and q.state in ('pending','leased') and (not p.active or d.user_id<>n.user_id or
      (n.kind<>'removed' and (s.service_date<>n.service_date or s.service_date<(now() at time zone 'Asia/Manila')::date
        or not exists(select 1 from qnlbc_private.assignment_people(s) a where a.slot=n.slot and a.member_id=p.directory_member_id))));
  return query
  with due as (
    select q.id from qnlbc_private.push_deliveries q
    where q.state in ('pending','leased') and q.available_at<=now() and q.attempts<8
    order by q.available_at for update skip locked limit least(greatest(batch_size,1),100)
  ), claimed as (
    update qnlbc_private.push_deliveries q set state='leased',attempts=q.attempts+1,available_at=now()+interval '2 minutes',lease_id=gen_random_uuid(),leased_token=(select pd.token from public.push_devices pd where pd.id=q.device_id)
    from due where q.id=due.id returning q.*
  )
  select c.id,c.lease_id,n.id,c.leased_token,n.user_id,n.setlist_id,n.title,n.body
    from claimed c join public.assignment_notifications n on n.id=c.notification_id join public.push_devices d on d.id=c.device_id
    where d.user_id=n.user_id;
end; $$;
create function public.finish_assignment_push(delivery bigint, lease uuid, result text)
returns void language plpgsql security definer set search_path='' as $$
begin
  if coalesce(auth.role(),'')<>'service_role' then raise exception 'Service access required' using errcode='42501'; end if;
  if result not in ('sent','retry','invalid') then raise exception 'Invalid delivery result'; end if;
  if result='invalid' then
    delete from public.push_devices d where exists(select 1 from qnlbc_private.push_deliveries q
      where q.id=delivery and q.lease_id=lease and q.state='leased' and q.device_id=d.id and q.leased_token=d.token);
    -- A token refreshed while the old request was in flight must remain registered.
    update qnlbc_private.push_deliveries set state=case when attempts>=8 then 'failed' else 'pending' end,available_at=now()
      where id=delivery and lease_id=lease and state='leased';
  else
    update qnlbc_private.push_deliveries set
      state=case when result='sent' then 'sent' when attempts>=8 then 'failed' else 'pending' end,
      available_at=now()+make_interval(secs=>least(3600,10*power(2,attempts)::int))
      where id=delivery and lease_id=lease and state='leased';
  end if;
end; $$;

revoke all on all functions in schema qnlbc_private from public,anon,authenticated;
grant execute on function qnlbc_private.is_active_account() to authenticated;
revoke all on function public.handle_new_auth_user(),public.sync_auth_profile_identity() from public,anon,authenticated;
revoke all on function public.list_directory_members(),public.save_directory_member(uuid,text,boolean),public.save_directory_names(jsonb),
  public.register_push_device(uuid,text),public.unregister_push_device(uuid),public.mark_assignment_notification_read(uuid),
  public.claim_assignment_pushes(int),public.finish_assignment_push(bigint,uuid,text) from public,anon,authenticated;
grant execute on function public.list_directory_members(),public.save_directory_member(uuid,text,boolean),public.save_directory_names(jsonb),
  public.register_push_device(uuid,text),public.unregister_push_device(uuid),public.mark_assignment_notification_read(uuid) to authenticated;
grant execute on function public.claim_assignment_pushes(int),public.finish_assignment_push(bigint,uuid,text) to service_role;
grant all on public.directory_members,public.assignment_notifications,public.push_devices to service_role;
commit;

