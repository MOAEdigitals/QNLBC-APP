-- Run once in the Supabase SQL Editor. This creates only the sermon feature.
begin;
create table if not exists public.sermon_outlines (
  id uuid primary key default gen_random_uuid(),
  author_id uuid not null references public.profiles(id),
  service_date date not null,
  title text not null check (length(btrim(title)) > 0),
  preacher text not null check (length(btrim(preacher)) > 0),
  outline text not null check (length(btrim(outline)) > 0),
  status text not null default 'draft' check (status in ('draft', 'published')),
  revision bigint not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists sermon_outlines_service_date_idx on public.sermon_outlines(service_date);
alter table public.sermon_outlines enable row level security;
revoke all on public.sermon_outlines from anon;
grant select, insert, update on public.sermon_outlines to authenticated;

create or replace function public.sermon_outline_before_write()
returns trigger language plpgsql set search_path = '' as $$
begin
  if TG_OP = 'INSERT' then
    NEW.revision := 1;
    NEW.created_at := now();
  else
    NEW.id := OLD.id;
    NEW.author_id := OLD.author_id;
    NEW.created_at := OLD.created_at;
    NEW.revision := OLD.revision + 1;
  end if;
  NEW.updated_at := now();
  return NEW;
end;
$$;
drop trigger if exists sermon_outline_before_write on public.sermon_outlines;
create trigger sermon_outline_before_write before insert or update on public.sermon_outlines
for each row execute function public.sermon_outline_before_write();

drop policy if exists sermon_read on public.sermon_outlines;
create policy sermon_read on public.sermon_outlines for select to authenticated using (
  exists (select 1 from public.profiles p where p.id = (select auth.uid()) and p.active
    and (status = 'published' or author_id = p.id or p.role = 'admin'))
);
drop policy if exists sermon_insert on public.sermon_outlines;
create policy sermon_insert on public.sermon_outlines for insert to authenticated with check (
  author_id = (select auth.uid()) and public.has_permission('add')
);
drop policy if exists sermon_update on public.sermon_outlines;
create policy sermon_update on public.sermon_outlines for update to authenticated using (
  public.has_permission('edit') and exists (
    select 1 from public.profiles p where p.id = (select auth.uid()) and p.active
    and (author_id = p.id or p.role = 'admin')
  )
) with check (
  public.has_permission('edit') and exists (
    select 1 from public.profiles p where p.id = (select auth.uid()) and p.active
    and (author_id = p.id or p.role = 'admin')
  )
);
commit;
