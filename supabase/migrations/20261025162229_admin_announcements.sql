begin;
create table public.admin_announcements (
 id uuid primary key, sender_id uuid not null references public.profiles(id),
 title text not null check(length(title) between 1 and 120),
 body text not null check(length(body) between 1 and 2000),
 created_at timestamptz not null default now()
);
alter table public.admin_announcements enable row level security;
revoke all on public.admin_announcements from anon,authenticated;
alter table public.assignment_notifications alter column setlist_id drop not null,
 alter column slot drop not null, alter column service_date drop not null,
 add column announcement_id uuid references public.admin_announcements(id);
alter table public.assignment_notifications drop constraint assignment_notifications_kind_check;
alter table public.assignment_notifications add constraint assignment_notifications_kind_check check(kind in ('assigned','updated','removed','practice','announcement'));
alter table public.assignment_notifications add constraint notification_target_check check (
 (kind='announcement' and announcement_id is not null and setlist_id is null and slot is null and service_date is null)
 or (kind<>'announcement' and announcement_id is null and setlist_id is not null and slot is not null and service_date is not null));
create index notification_announcement_idx on public.assignment_notifications(announcement_id) where announcement_id is not null;

-- These RPCs deliberately use definer rights for the outbox and private device data.
-- Every entry point checks the signed-in, active admin from the database, never JWT metadata.
create function public.list_announcement_recipients()
returns table(id uuid,name text,username text,push_enabled boolean)
language plpgsql security definer set search_path='' as $$
begin
 if not exists(select 1 from public.profiles where profiles.id=auth.uid() and active and role='admin') then raise insufficient_privilege using message='Administrator access required'; end if;
 return query select p.id,p.display_name,p.username,exists(select 1 from public.push_devices d where d.user_id=p.id)
 from public.profiles p where p.active order by lower(p.display_name),p.username;
end; $$;

create function public.send_admin_announcement(request_id uuid,message_title text,message_body text,recipient_ids uuid[])
returns uuid language plpgsql security definer set search_path='' as $$
declare targets uuid[]; previous public.admin_announcements; old_targets uuid[];
begin
 if not exists(select 1 from public.profiles where id=auth.uid() and active and role='admin') then raise insufficient_privilege using message='Administrator access required'; end if;
 if request_id is null or nullif(trim(message_title),'') is null or length(trim(message_title))>120 or nullif(trim(message_body),'') is null or length(trim(message_body))>2000 then raise exception 'Enter a title (up to 120 characters) and message (up to 2000 characters).'; end if;
 select array_agg(distinct x order by x) into targets from unnest(recipient_ids) x;
 if coalesce(cardinality(targets),0)=0 or array_position(targets,null) is not null then raise exception 'Select at least one active account.'; end if;
 perform pg_advisory_xact_lock(hashtextextended(request_id::text,0));
 select * into previous from public.admin_announcements where id=request_id;
 if found then
  select array_agg(user_id order by user_id) into old_targets from public.assignment_notifications where announcement_id=request_id;
  if previous.sender_id<>auth.uid() or previous.title<>trim(message_title) or previous.body<>trim(message_body) or old_targets is distinct from targets then raise exception 'This send request was already used. Refresh history before sending again.'; end if;
  return request_id;
 end if;
 -- Lock recipients; reject stale selections instead of silently omitting people.
 perform 1 from public.profiles where id=any(targets) and active for share;
 if (select count(*) from public.profiles where id=any(targets) and active)<>cardinality(targets) then raise exception 'A selected account is no longer active. Refresh the recipients.'; end if;
 insert into public.admin_announcements(id,sender_id,title,body) values(request_id,auth.uid(),trim(message_title),trim(message_body));
 insert into public.assignment_notifications(user_id,kind,title,body,event_key,announcement_id)
 select x,'announcement',trim(message_title),trim(message_body),'announcement:'||request_id::text,request_id from unnest(targets) x;
 insert into qnlbc_private.push_deliveries(notification_id,device_id)
 select n.id,d.id from public.assignment_notifications n join public.push_devices d on d.user_id=n.user_id where n.announcement_id=request_id;
 return request_id;
end; $$;

create function public.list_admin_announcements()
returns jsonb language plpgsql security definer set search_path='' as $$
begin
 if not exists(select 1 from public.profiles where id=auth.uid() and active and role='admin') then raise insufficient_privilege using message='Administrator access required'; end if;
 return coalesce((select jsonb_agg(item order by created_at desc) from (
 select a.created_at,jsonb_build_object('id',a.id,'title',a.title,'body',a.body,'created_at',a.created_at,'sender_name',p.display_name,
 'recipients',coalesce((select jsonb_agg(jsonb_build_object('id',n.user_id,'name',r.display_name,'username',r.username,'read_at',n.read_at,
 'status',case when exists(select 1 from qnlbc_private.push_deliveries d where d.notification_id=n.id and d.state='sent') then 'accepted'
 when exists(select 1 from qnlbc_private.push_deliveries d where d.notification_id=n.id and d.state in ('pending','leased')) then 'queued'
 when exists(select 1 from qnlbc_private.push_deliveries d where d.notification_id=n.id) then 'failed' else 'inbox_only' end) order by r.display_name)
 from public.assignment_notifications n join public.profiles r on r.id=n.user_id where n.announcement_id=a.id),'[]'::jsonb)) as item
 from public.admin_announcements a join public.profiles p on p.id=a.sender_id order by a.created_at desc limit 50
 ) recent),'[]'::jsonb);
end; $$;
revoke all on function public.list_announcement_recipients(),public.send_admin_announcement(uuid,text,text,uuid[]),public.list_admin_announcements() from public,anon,authenticated;
grant execute on function public.list_announcement_recipients(),public.send_admin_announcement(uuid,text,text,uuid[]),public.list_admin_announcements() to authenticated;
create or replace function public.claim_assignment_pushes(batch_size int default 50)
returns table(delivery_id bigint,lease_id uuid,notification_id uuid,token text,user_id uuid,setlist_id uuid,title text,body text)
language plpgsql security definer set search_path='' as $$
begin
  if coalesce(auth.role(),'')<>'service_role' then raise exception 'Service access required' using errcode='42501'; end if;
  update qnlbc_private.push_deliveries set state='failed' where state='leased' and attempts>=8 and available_at<=now();
  -- Discard messages made obsolete by account switches, deactivation, reassignment or rescheduling.
  update qnlbc_private.push_deliveries q set state='cancelled'
  from public.assignment_notifications n join public.profiles p on p.id=n.user_id left join public.setlists s on s.id=n.setlist_id,public.push_devices d
  where q.notification_id=n.id and q.device_id=d.id and p.id=n.user_id
    and q.state in ('pending','leased') and (not p.active or d.user_id<>n.user_id or
      (n.kind<>'announcement' and (s.id is null or (n.kind<>'removed' and (s.service_date<>n.service_date or s.service_date<(now() at time zone 'Asia/Manila')::date
        or not exists(select 1 from qnlbc_private.assignment_people(s) a where a.slot=n.slot and a.member_id=p.directory_member_id))))));
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

commit;


