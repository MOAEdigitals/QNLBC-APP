-- Run AFTER 20261003_sermon_outlines.sql in the Supabase SQL Editor.
begin;
alter table public.sermon_outlines
  add column if not exists outline_html text,
  add column if not exists attachments jsonb not null default '[]'::jsonb,
  add column if not exists is_done boolean not null default false;
alter table public.sermon_outlines drop constraint if exists sermon_outlines_outline_check;
alter table public.sermon_outlines drop constraint if exists sermon_content_check;
alter table public.sermon_outlines add constraint sermon_content_check check (
  length(btrim(outline)) > 0 or (jsonb_typeof(attachments) = 'array' and jsonb_array_length(attachments) > 0)
);
-- Keep every file under the immutable author and sermon IDs.
create or replace function public.validate_sermon_attachments()
returns trigger language plpgsql set search_path = '' as $$
declare item jsonb;
begin
  if jsonb_typeof(NEW.attachments) <> 'array' or jsonb_array_length(NEW.attachments) > 10 then
    raise exception 'A sermon may have up to 10 attachments';
  end if;
  for item in select value from jsonb_array_elements(NEW.attachments) loop
    if coalesce(item->>'kind', '') not in ('pdf', 'docx')
       or coalesce(item->>'path', '') not like NEW.author_id::text || '/' || NEW.id::text || '/%'
       or coalesce(item->>'name', '') = '' then
      raise exception 'Invalid sermon attachment';
    end if;
  end loop;
  return NEW;
end;
$$;
drop trigger if exists validate_sermon_attachments on public.sermon_outlines;
create trigger validate_sermon_attachments before insert or update on public.sermon_outlines
for each row execute function public.validate_sermon_attachments();

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('sermon-files', 'sermon-files', false, 20971520,
  array['application/pdf', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'])
on conflict (id) do update set public = false, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists sermon_files_read on storage.objects;
create policy sermon_files_read on storage.objects for select to authenticated using (
  bucket_id = 'sermon-files'
  and exists (select 1 from public.sermon_outlines s
    where s.id::text = (storage.foldername(name))[2]
      and s.author_id::text = (storage.foldername(name))[1]
      and exists (select 1 from jsonb_array_elements(s.attachments) item where item->>'path' = name)
  )
);
-- SELECT on sermon_outlines above respects its RLS, so AVP can read published
-- files while drafts remain visible only to the author and administrators.
drop policy if exists sermon_files_insert on storage.objects;
create policy sermon_files_insert on storage.objects for insert to authenticated with check (
  bucket_id = 'sermon-files'
  and array_length(storage.foldername(name), 1) = 2
  and (lower(storage.extension(name)) in ('pdf', 'docx'))
  and (
    ((storage.foldername(name))[1] = (select auth.uid())::text
      and (public.has_permission('add') or public.has_permission('edit')))
    or (public.has_permission('edit') and exists (
      select 1 from public.profiles p join public.sermon_outlines s on s.author_id::text = (storage.foldername(name))[1]
      where p.id = (select auth.uid()) and p.role = 'admin' and p.active
        and s.id::text = (storage.foldername(name))[2]
    ))
  )
);
drop policy if exists sermon_files_delete_unused on storage.objects;
create policy sermon_files_delete_unused on storage.objects for delete to authenticated using (
  bucket_id = 'sermon-files'
  and (
    ((storage.foldername(name))[1] = (select auth.uid())::text and (public.has_permission('add') or public.has_permission('edit')))
    or exists (select 1 from public.profiles p where p.id = (select auth.uid()) and p.active and p.role = 'admin')
  )
  and not exists (
    select 1 from public.sermon_outlines s, jsonb_array_elements(s.attachments) item where item->>'path' = name
  )
);
commit;
