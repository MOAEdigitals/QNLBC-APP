-- Run once in the Supabase SQL Editor to enable the Activities schedule subtab.
begin;
create table if not exists public.church_activities (
  id uuid primary key default gen_random_uuid(),
  title text not null check (length(btrim(title)) > 0),
  activity_date date not null,
  activity_time time,
  revision bigint not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists church_activities_date_idx on public.church_activities(activity_date, activity_time);
alter table public.church_activities enable row level security;
revoke all on public.church_activities from anon;
grant select, insert, update, delete on public.church_activities to authenticated;

create or replace function public.church_activity_before_write()
returns trigger language plpgsql set search_path = '' as $$
begin
  if TG_OP = 'INSERT' then
    NEW.revision := 1;
    NEW.created_at := now();
  else
    NEW.id := OLD.id;
    NEW.created_at := OLD.created_at;
    NEW.revision := OLD.revision + 1;
  end if;
  NEW.updated_at := now();
  return NEW;
end;
$$;
drop trigger if exists church_activity_before_write on public.church_activities;
create trigger church_activity_before_write before insert or update on public.church_activities
for each row execute function public.church_activity_before_write();

drop policy if exists church_activities_read on public.church_activities;
create policy church_activities_read on public.church_activities for select to authenticated using (
  exists (select 1 from public.profiles p where p.id = (select auth.uid()) and p.active)
);
drop policy if exists church_activities_insert on public.church_activities;
create policy church_activities_insert on public.church_activities for insert to authenticated with check (public.has_permission('add'));
drop policy if exists church_activities_update on public.church_activities;
create policy church_activities_update on public.church_activities for update to authenticated
using (public.has_permission('edit')) with check (public.has_permission('edit'));
drop policy if exists church_activities_delete on public.church_activities;
create policy church_activities_delete on public.church_activities for delete to authenticated using (public.has_permission('delete'));
commit;
