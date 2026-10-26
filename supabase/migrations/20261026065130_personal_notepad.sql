create table public.personal_notes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  title text not null check (length(btrim(title)) between 1 and 200),
  body text not null default '' check (length(body) <= 200000),
  revision bigint not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);
create index personal_notes_user_updated_idx on public.personal_notes(user_id,updated_at desc,id);
alter table public.personal_notes enable row level security;
revoke all on public.personal_notes from public,anon,authenticated;
grant select,insert,update on public.personal_notes to authenticated;
create policy personal_notes_read on public.personal_notes for select to authenticated using (
  user_id=(select auth.uid()) and exists(select 1 from public.profiles p where p.id=(select auth.uid()) and p.active)
);
create policy personal_notes_add on public.personal_notes for insert to authenticated with check (
  user_id=(select auth.uid()) and exists(select 1 from public.profiles p where p.id=(select auth.uid()) and p.active)
);
create policy personal_notes_edit on public.personal_notes for update to authenticated using (
  user_id=(select auth.uid()) and exists(select 1 from public.profiles p where p.id=(select auth.uid()) and p.active)
) with check (
  user_id=(select auth.uid()) and exists(select 1 from public.profiles p where p.id=(select auth.uid()) and p.active)
);
create function public.personal_note_before_write() returns trigger language plpgsql set search_path='' as $$
begin
  if TG_OP='UPDATE' then
    if NEW.id<>OLD.id or NEW.user_id<>OLD.user_id then raise exception 'Note ownership cannot change'; end if;
    NEW.created_at:=OLD.created_at;
    NEW.revision:=OLD.revision+1;
  else
    NEW.created_at:=now();
    NEW.revision:=1;
  end if;
  NEW.updated_at:=now();
  return NEW;
end;
$$;
revoke all on function public.personal_note_before_write() from public;
create trigger personal_note_before_write before insert or update on public.personal_notes
  for each row execute function public.personal_note_before_write();
